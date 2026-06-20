import base64
import json

from flask import request, jsonify
from marshmallow import ValidationError
from sqlalchemy import or_, and_
from models import Arrival
from schemas import ArrivalInputSchema, ArrivalSchema
from game_time import game_now
from stats import get_stats

arrival_input_schema = ArrivalInputSchema()
arrival_schema = ArrivalSchema()
arrivals_schema = ArrivalSchema(many=True)


def _encode_cursor(queued_at: float, arrival_id: int) -> str:
    """Opaque token capturing the last row of a page, in the (queued_at, id) sort key."""
    raw = json.dumps({"q": queued_at, "id": arrival_id}).encode()
    return base64.urlsafe_b64encode(raw).decode()


def _decode_cursor(token: str) -> tuple[float, int]:
    """Inverse of _encode_cursor. Raises on a malformed token."""
    raw = base64.urlsafe_b64decode(token.encode())
    data = json.loads(raw)
    return data["q"], data["id"]


def register_routes(app):

    @app.route("/arrivals", methods=["POST"])
    def create_arrival():
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Request body must be valid JSON"}), 400

        try:
            guest = arrival_input_schema.load(data)
        except ValidationError as err:
            return jsonify({"errors": err.messages}), 400

        result = app.gate_manager.assign_and_enqueue(guest)
        return jsonify(result), 202

    @app.route("/arrivals/<guest_id>", methods=["GET"])
    def get_arrival(guest_id):
        guest = app.gate_manager.get_guest(guest_id)
        if not guest:
            return jsonify({"error": "Guest not found"}), 404

        position = None
        if guest["status"] in ("queued", "processing"):
            position = app.gate_manager.get_guest_position(guest_id, guest["gate"])

        if guest["status"] == "processed":
            wait_time = guest["wait_time_seconds"]
        else:
            wait_time = game_now() - guest["queued_at"]

        return jsonify({
            "guest_id": guest["guest_id"],
            "status": guest["status"],
            "gate": guest["gate"],
            "position": position,
            "queued_at": guest["queued_at"],
            "processed_at": guest.get("processed_at"),
            "wait_time_seconds": wait_time,
        }), 200

    @app.route("/arrivals", methods=["GET"])
    def list_arrivals():
        query = Arrival.query

        status = request.args.get("status")
        if status:
            query = query.filter_by(status=status)

        passport_type = request.args.get("passport_type")
        if passport_type:
            query = query.filter_by(passport_type=passport_type)

        total = query.count()

        # Stable total order: newest first, with id as a unique tiebreaker so the
        # keyset cursor can never skip or repeat rows when queued_at values collide.
        ordered = query.order_by(Arrival.queued_at.desc(), Arrival.id.desc())

        limit_arg = request.args.get("limit")
        if limit_arg is None:
            # No limit: preserve the original behavior — every arrival in one response.
            arrivals = ordered.all()
            return jsonify({
                "arrivals": arrivals_schema.dump(arrivals),
                "next_cursor": None,
                "total": total,
            }), 200

        try:
            limit = int(limit_arg)
        except (TypeError, ValueError):
            return jsonify({"error": "limit must be an integer"}), 400
        if limit < 1:
            return jsonify({"error": "limit must be >= 1"}), 400

        cursor = request.args.get("cursor")
        if cursor:
            try:
                c_queued_at, c_id = _decode_cursor(cursor)
            except Exception:
                return jsonify({"error": "invalid cursor"}), 400
            # Keyset predicate matching the (queued_at desc, id desc) ordering.
            ordered = ordered.filter(
                or_(
                    Arrival.queued_at < c_queued_at,
                    and_(Arrival.queued_at == c_queued_at, Arrival.id < c_id),
                )
            )

        # Fetch one extra row to learn whether a further page exists.
        rows = ordered.limit(limit + 1).all()
        has_more = len(rows) > limit
        page = rows[:limit]

        next_cursor = None
        if has_more and page:
            last = page[-1]
            next_cursor = _encode_cursor(last.queued_at, last.id)

        return jsonify({
            "arrivals": arrivals_schema.dump(page),
            "next_cursor": next_cursor,
            "total": total,
        }), 200

    @app.route("/queue", methods=["GET"])
    def get_queue():
        return jsonify(app.gate_manager.get_all_gates_status()), 200

    @app.route("/stats", methods=["GET"])
    def get_stats_route():
        return jsonify(get_stats()), 200

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"}), 200
