from pydantic import BaseModel, Field


class PortholeOut(BaseModel):
    id: str
    label: str
    seats: int


class PortholeAvailabilityOut(BaseModel):
    id: str
    label: str
    seats: int
    available: bool


class SubmarineListItemOut(BaseModel):
    id: str
    name: str
    depth_zone: str
    description: str
    porthole_count: int
    total_seats: int


class SubmarineOut(BaseModel):
    id: str
    name: str
    depth_zone: str
    description: str
    portholes: list[PortholeOut]


class SubmarineListOut(BaseModel):
    submarines: list[SubmarineListItemOut]


class AvailabilityOut(BaseModel):
    submarine_id: str
    slot: int
    portholes: list[PortholeAvailabilityOut]


class DiveCreateIn(BaseModel):
    guest_id: str = Field(..., max_length=100)
    submarine_id: str = Field(..., max_length=50)
    porthole_id: str = Field(..., max_length=50)
    party_size: int = Field(..., gt=0)
    dive_slot: int = Field(..., ge=0)


class DiveOut(BaseModel):
    id: str
    guest_id: str
    submarine_id: str
    porthole_id: str
    party_size: int
    dive_slot: int
    briefing: str | None
    status: str


class DiveListOut(BaseModel):
    guest_id: str
    dives: list[DiveOut]


class CancelOut(BaseModel):
    id: str
    status: str


class ErrorOut(BaseModel):
    error: str
    error_code: str
