from pydantic import BaseModel, Field


class TableOut(BaseModel):
    id: str
    label: str
    seats: int


class TableAvailabilityOut(BaseModel):
    id: str
    label: str
    seats: int
    available: bool


class RestaurantListItemOut(BaseModel):
    id: str
    name: str
    cuisine: str
    description: str
    table_count: int
    total_seats: int


class RestaurantOut(BaseModel):
    id: str
    name: str
    cuisine: str
    description: str
    tables: list[TableOut]


class RestaurantListOut(BaseModel):
    restaurants: list[RestaurantListItemOut]


class AvailabilityOut(BaseModel):
    restaurant_id: str
    slot: int
    tables: list[TableAvailabilityOut]


class ReservationCreateIn(BaseModel):
    guest_id: str = Field(..., max_length=100)
    restaurant_id: str = Field(..., max_length=50)
    table_id: str = Field(..., max_length=50)
    party_size: int = Field(..., gt=0)
    seating_slot: int = Field(..., ge=0)
    pre_order: list[str] | None = None


class ReservationOut(BaseModel):
    id: str
    guest_id: str
    restaurant_id: str
    table_id: str
    party_size: int
    seating_slot: int
    pre_order: list[str] | None
    status: str


class ReservationListOut(BaseModel):
    guest_id: str
    reservations: list[ReservationOut]


class CancelOut(BaseModel):
    id: str
    status: str


class ErrorOut(BaseModel):
    error: str
    error_code: str
