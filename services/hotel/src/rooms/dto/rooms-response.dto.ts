export interface RoomResponseDto {
  id: string;
  type: string;
  capacity: number;
  price_per_night: number;
  occupancy: number;
}

export interface RoomsResponseDto {
  rooms: RoomResponseDto[];
}
