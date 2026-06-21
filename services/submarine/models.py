import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class DiveStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class Submarine(Base):
    __tablename__ = "submarines"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    depth_zone: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    portholes: Mapped[list["Porthole"]] = relationship(back_populates="submarine")


class Porthole(Base):
    __tablename__ = "portholes"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    submarine_id: Mapped[str] = mapped_column(ForeignKey("submarines.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    seats: Mapped[int] = mapped_column(Integer, nullable=False)

    submarine: Mapped["Submarine"] = relationship(back_populates="portholes")


class Dive(Base):
    __tablename__ = "dives"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    guest_id: Mapped[str] = mapped_column(String(100), nullable=False)
    submarine_id: Mapped[str] = mapped_column(ForeignKey("submarines.id"), nullable=False)
    porthole_id: Mapped[str] = mapped_column(ForeignKey("portholes.id"), nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    dive_slot: Mapped[int] = mapped_column(Integer, nullable=False)
    briefing: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=DiveStatus.CONFIRMED.value)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        # The capacity rule: at most one CONFIRMED dive per porthole per dive slot.
        # Belt-and-suspenders backstop for the FOR UPDATE check in repository.book_dive().
        Index(
            "uq_porthole_slot_active",
            "porthole_id",
            "dive_slot",
            unique=True,
            postgresql_where=text("status = 'CONFIRMED'"),
        ),
    )
