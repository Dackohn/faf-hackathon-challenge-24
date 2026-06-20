import threading
import time

from models import db, Arrival
from config import EU_GATES, ALL_GATES, PROCESSING_TIME_EU, PROCESSING_TIME_ALL
from schemas import ArrivalSchema
from game_time import game_now, GAME_SPEED
from broadcast import BroadcastClient

_arrival_schema = ArrivalSchema()


PRIORITY_RANKS = {"fast": 1, "standard": 2}

# Guests strictly under this age are minors: they queue and advance normally but cannot
# enter the booth / clear control unless a same-surname adult clears together with them.
MINOR_AGE = 12


def _effective_rank(guest: dict) -> int:
    if guest.get("disability"):
        return 0
    return PRIORITY_RANKS.get(guest.get("priority", "standard"), 2)


def _is_minor(guest: dict) -> bool:
    return guest.get("age", MINOR_AGE) < MINOR_AGE


class Gate:

    def __init__(self, gate_id: str, gate_type: str, processing_time: float,
                 app, broadcast: BroadcastClient):
        self.gate_id = gate_id
        self.gate_type = gate_type
        self.processing_time = processing_time
        self.app = app
        self.broadcast = broadcast
        self.queue: list[dict] = []
        self.currently_processing: dict | None = None
        self.lock = threading.Lock()
        self.active = True

    def enqueue(self, guest: dict) -> int:
        rank = _effective_rank(guest)
        insert_at = len(self.queue)
        for i, existing in enumerate(self.queue):
            if _effective_rank(existing) >= rank:
                insert_at = i
                break
        self.queue.insert(insert_at, guest)
        return insert_at + 1  # 1-based position

    def start(self):
        thread = threading.Thread(target=self._run, daemon=True)
        thread.start()

    def _select_group(self) -> list[dict] | None:
        """Pick the next family unit to process, or None if nothing is clearable.

        Must be called while holding self.lock. Families are treated as a unit: the first
        adult (age >= 12) in queue order anchors the group, and every same-surname minor in
        the queue clears together with them. A minor with no same-surname adult in the queue
        is held — skipped and left in place — so it advances in line but never enters the
        booth alone. If the queue holds only such held minors, returns None (booth idles).
        """
        for guest in self.queue:
            if _is_minor(guest):
                continue  # minors only clear as part of an adult's group, never on their own
            surname = guest.get("surname")
            group = [guest] + [
                g for g in self.queue
                if g is not guest and _is_minor(g) and g.get("surname") == surname
            ]
            for member in group:
                self.queue.remove(member)
            return group
        return None

    def _run(self):
        while self.active:
            group = None
            with self.lock:
                group = self._select_group()
                if group:
                    for member in group:
                        member["status"] = "processing"
                    # The anchoring adult represents the family in the booth.
                    self.currently_processing = group[0]

            if not group:
                time.sleep(0.1)
                continue

            with self.app.app_context():
                for member in group:
                    arrival = db.session.get(Arrival, member["arrival_id"])
                    if arrival:
                        arrival.status = "processing"
                db.session.commit()

            # One booth visit clears the whole family together.
            real_delay = self.processing_time / GAME_SPEED
            time.sleep(real_delay)

            processed_at = game_now()
            with self.app.app_context():
                for member in group:
                    # Total wait is from joining the queue until processed, not just the
                    # processing slice — consistent with the in-queue metric in routes.py.
                    member["status"] = "processed"
                    member["processed_at"] = processed_at
                    member["wait_time_seconds"] = processed_at - member["queued_at"]
                    arrival = db.session.get(Arrival, member["arrival_id"])
                    if arrival:
                        arrival.status = "processed"
                        arrival.processed_at = processed_at
                        arrival.wait_time_seconds = member["wait_time_seconds"]
                db.session.commit()

            for member in group:
                self.broadcast.publish_event(member)

            with self.lock:
                self.currently_processing = None


class GateManager:

    def __init__(self, app, broadcast_client: BroadcastClient):
        self.app = app
        self.broadcast_client = broadcast_client
        self.gates: dict[str, Gate] = {}
        self.assignment_lock = threading.Lock()
        # Highest gate index ever issued per type. New gates opened at runtime take the
        # next index so their ids stay unique even after earlier gates have been closed.
        self._gate_counts = {"EU": EU_GATES, "ALL": ALL_GATES}

        eu_count = EU_GATES
        all_count = ALL_GATES
        eu_time = PROCESSING_TIME_EU
        all_time = PROCESSING_TIME_ALL

        for i in range(1, eu_count + 1):
            gid = f"EU-{i}"
            self.gates[gid] = Gate(gid, "EU", eu_time, app, broadcast_client)
        for i in range(1, all_count + 1):
            gid = f"ALL-{i}"
            self.gates[gid] = Gate(gid, "ALL", all_time, app, broadcast_client)

        self._rehydrate_from_db()

    def _rehydrate_from_db(self):
        with self.app.app_context():
            rows = Arrival.query.filter(
                Arrival.status.in_(["queued", "processing"])
            ).order_by(Arrival.queued_at).all()

            for row in rows:
                guest = _arrival_schema.dump(row)
                guest["arrival_id"] = row.id
                gate = self.gates.get(guest.get("gate"))
                if gate is None:
                    continue
                if guest["status"] == "processing":
                    guest["status"] = "queued"
                    row.status = "queued"
                    gate.queue.insert(0, guest)
                else:
                    gate.enqueue(guest)
            db.session.commit()

    def start_all(self):
        for gate in self.gates.values():
            gate.start()

    def stop_all(self):
        for gate in self.gates.values():
            gate.active = False

    def _select_gate_for(self, guest: dict) -> "Gate | None":
        """Pick the open gate a guest should queue at.

        non-EU guests can only use ALL gates. EU guests prefer the shortest EU gate but
        spill over to the shortest ALL gate when that ALL gate is strictly shorter (the
        existing cross-type load balancing). Returns None only if no compatible gate is open.
        """
        eu_gates = [g for g in self.gates.values() if g.gate_type == "EU"]
        all_gates = [g for g in self.gates.values() if g.gate_type == "ALL"]
        shortest = lambda gs: min(gs, key=lambda g: len(g.queue)) if gs else None

        all_short = shortest(all_gates)
        if guest["passport_type"] != "EU":
            return all_short

        eu_short = shortest(eu_gates)
        if eu_short and all_short:
            return all_short if len(all_short.queue) < len(eu_short.queue) else eu_short
        return eu_short or all_short

    def _gate_accepts(self, gate: Gate, guest: dict) -> bool:
        # ALL gates take any passport; EU gates take EU passports only.
        return gate.gate_type == "ALL" or guest["passport_type"] == "EU"

    def _family_gate(self, surname: str | None, guest: dict) -> Gate | None:
        """Gate already hosting a same-surname guest (queued or in the booth), if it can
        also take this guest — so families queue together and can clear as a unit."""
        if not surname:
            return None
        for gate in self.gates.values():
            if not self._gate_accepts(gate, guest):
                continue
            with gate.lock:
                cp = gate.currently_processing
                if cp and cp.get("surname") == surname:
                    return gate
                if any(g.get("surname") == surname for g in gate.queue):
                    return gate
        return None

    def assign_and_enqueue(self, guest: dict) -> dict:
        # Select the gate and enqueue under one lock so two concurrent arrivals
        # cannot both read the same shortest gate and pile onto it (TOCTOU).
        with self.assignment_lock:
            # Keep families together: prefer the gate where a same-surname member already
            # is. Fall back to the open/close-aware shortest-gate selection, which only
            # returns open, compatible gates (and None when none are open).
            gate = self._family_gate(guest.get("surname"), guest)
            if gate is None:
                gate = self._select_gate_for(guest)
            if gate is None:
                # Invariant: close_gate never removes the last gate able to serve a
                # passport type, so a compatible gate always exists here.
                raise RuntimeError("no open gate available for guest")

            guest["queued_at"] = game_now()
            guest["status"] = "queued"
            guest["gate"] = gate.gate_id

            with self.app.app_context():
                arrival = Arrival(
                    guest_id=guest["guest_id"],
                    name=guest["name"],
                    surname=guest["surname"],
                    age=guest["age"],
                    passport_type=guest["passport_type"],
                    priority=guest["priority"],
                    disability=guest.get("disability", False),
                    status="queued",
                    gate=gate.gate_id,
                    queued_at=guest["queued_at"],
                )
                db.session.add(arrival)
                db.session.commit()
                guest["arrival_id"] = arrival.id

            with gate.lock:
                position = gate.enqueue(guest)
                # Rough wait estimate in game-seconds. Everyone processed before this guest
                # finishes: the guest in the chair (if any, counted as a full slot since we
                # don't track partial progress) + those ahead in the queue + this guest. Times
                # the gate's per-guest processing time. Mirrors wait_time_seconds (queued -> processed).
                guests_before = (position - 1) + (1 if gate.currently_processing else 0)
                estimated_wait_seconds = (guests_before + 1) * gate.processing_time
                queue_size = len(gate.queue)

        return {
            "guest_id": guest["guest_id"],
            "gate": gate.gate_id,
            "position": position,
            "queue_size": queue_size,
            "queued_at": guest["queued_at"],
            "estimated_wait_seconds": estimated_wait_seconds,
        }

    def get_guest(self, guest_id: str) -> dict | None:
        with self.app.app_context():
            arrival = Arrival.query.filter_by(guest_id=guest_id)\
                .order_by(Arrival.queued_at.desc()).first()
            return _arrival_schema.dump(arrival) if arrival else None

    def get_guest_position(self, guest_id: str, gate_id: str) -> int | None:
        gate = self.gates.get(gate_id)
        if gate is None:
            return None
        with gate.lock:
            if gate.currently_processing and gate.currently_processing["guest_id"] == guest_id:
                return 0
            for i, g in enumerate(gate.queue):
                if g["guest_id"] == guest_id:
                    return i + 1
        return None

    def get_all_gates_status(self) -> dict:
        now = game_now()
        gates_list = []
        total_queued = 0
        # Snapshot the gate set: open_gate/close_gate may mutate self.gates concurrently.
        for gate in list(self.gates.values()):
            with gate.lock:
                queue_snapshot = []
                cp = gate.currently_processing
                if cp:
                    queue_snapshot.append({**cp, "position": 0, "wait_time_seconds": now - cp["queued_at"]})
                for i, g in enumerate(gate.queue):
                    queue_snapshot.append({**g, "position": i + 1, "wait_time_seconds": now - g["queued_at"]})
            # Single source of truth: every guest present at the gate lives in queue_snapshot
            # (the one being processed at position 0, plus everyone waiting). queue_size and
            # total_queued both derive from it, so they can't drift apart.
            queue_size = len(queue_snapshot)
            total_queued += queue_size
            gates_list.append({
                "gate_id": gate.gate_id,
                "gate_type": gate.gate_type,
                "queue_size": queue_size,
                "queue": queue_snapshot,
            })
        return {
            "gates": sorted(gates_list, key=lambda g: g["gate_id"]),
            "total_queued": total_queued,
            "current_game_time": now,
        }

    def open_gate(self, gate_type: str | None = None, gate_id: str | None = None,
                  processing_time: float | None = None) -> tuple[dict | None, str | None]:
        """Open a gate at runtime so it starts accepting guests.

        gate_type ("EU"/"ALL") is required for a brand-new gate; if only gate_id is given
        the type is inferred from its prefix. With no gate_id, the next free id for the type
        is allocated. Returns (gate_status, None) on success, or (None, error_code).
        """
        with self.assignment_lock:
            if gate_id and gate_id in self.gates:
                return None, "already_open"

            if gate_type is not None:
                gate_type = gate_type.upper()
            elif gate_id:
                gate_type = gate_id.split("-")[0].upper()
            if gate_type not in ("EU", "ALL"):
                return None, "invalid_type"

            if processing_time is None:
                processing_time = PROCESSING_TIME_EU if gate_type == "EU" else PROCESSING_TIME_ALL

            if gate_id is None:
                self._gate_counts[gate_type] += 1
                gate_id = f"{gate_type}-{self._gate_counts[gate_type]}"
            else:
                # Keep the counter ahead of any explicit id so future auto-ids don't collide.
                try:
                    idx = int(gate_id.split("-")[1])
                    self._gate_counts[gate_type] = max(self._gate_counts[gate_type], idx)
                except (IndexError, ValueError):
                    pass

            gate = Gate(gate_id, gate_type, processing_time, self.app, self.broadcast_client)
            self.gates[gate_id] = gate
            gate.start()

        return {
            "gate_id": gate_id,
            "gate_type": gate_type,
            "processing_time": processing_time,
            "queue_size": 0,
        }, None

    def close_gate(self, gate_id: str) -> tuple[dict | None, str | None]:
        """Close a gate at runtime, re-queueing its waiting guests onto other open gates.

        Refuses to close the last gate able to serve a passport type. The guest currently
        being processed (if any) is left to finish at this gate. Returns (summary, None) on
        success, or (None, error_code).
        """
        with self.assignment_lock:
            gate = self.gates.get(gate_id)
            if gate is None:
                return None, "not_found"

            others = [g for gid, g in self.gates.items() if gid != gate_id]
            if not others:
                return None, "last_gate"
            # non-EU guests can ONLY use ALL gates, so the last ALL gate must stay open.
            if gate.gate_type == "ALL" and not any(g.gate_type == "ALL" for g in others):
                return None, "last_all_gate"

            # Stop the worker and take the waiting guests under the gate lock so the worker
            # cannot pop one out from under us mid-drain.
            with gate.lock:
                gate.active = False
                displaced = list(gate.queue)
                gate.queue.clear()

            # Remove from the active set: no longer a queueing candidate, gone from /queue.
            del self.gates[gate_id]

            # Re-distribute displaced guests onto remaining open, compatible gates. They keep
            # their original queued_at and priority, so wait ordering is preserved.
            reassigned = []
            with self.app.app_context():
                for guest in displaced:
                    target = self._select_gate_for(guest)
                    if target is None:
                        # Guarded against above; skip defensively rather than lose the guest.
                        continue
                    guest["gate"] = target.gate_id
                    arrival = db.session.get(Arrival, guest["arrival_id"])
                    if arrival:
                        arrival.gate = target.gate_id
                    with target.lock:
                        target.enqueue(guest)
                    reassigned.append({"guest_id": guest["guest_id"], "gate": target.gate_id})
                db.session.commit()

        return {
            "closed": gate_id,
            "reassigned_count": len(reassigned),
            "reassigned": reassigned,
        }, None
