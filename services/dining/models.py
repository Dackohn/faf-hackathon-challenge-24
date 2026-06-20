import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ReservationStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cuisine: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    tables: Mapped[list["Table"]] = relationship(back_populates="restaurant")


class Table(Base):
    __tablename__ = "tables"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    seats: Mapped[int] = mapped_column(Integer, nullable=False)

    restaurant: Mapped["Restaurant"] = relationship(back_populates="tables")


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    guest_id: Mapped[str] = mapped_column(String(100), nullable=False)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    table_id: Mapped[str] = mapped_column(ForeignKey("tables.id"), nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    seating_slot: Mapped[int] = mapped_column(Integer, nullable=False)
    pre_order: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=ReservationStatus.CONFIRMED.value)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        # The capacity rule: at most one CONFIRMED reservation per table per seating slot.
        # Belt-and-suspenders backstop for the FOR UPDATE check in repository.book_table().
        Index(
            "uq_table_slot_active",
            "table_id",
            "seating_slot",
            unique=True,
            postgresql_where=text("status = 'CONFIRMED'"),
        ),
    )
