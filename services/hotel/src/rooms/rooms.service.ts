import { Injectable } from '@nestjs/common';
import { ReservationStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { SimulationService } from '../simulation/simulation.service';
import { RoomsResponseDto } from './dto/rooms-response.dto';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulation: SimulationService,
  ) {}

  async findAll(): Promise<RoomsResponseDto> {
    const currentDay = this.simulation.currentDay();

    const [rooms, occupiedRooms] = await Promise.all([
      this.prisma.room.findMany({
        orderBy: { id: 'asc' },
      }),
      this.prisma.reservation.groupBy({
        by: ['room_id'],
        where: {
          status: ReservationStatus.CONFIRMED,
          check_in_day: { lte: currentDay },
          check_out_day: { gt: currentDay },
        },
        _sum: { guest_count: true },
      }),
    ]);

    const currentGuestsByRoomId = new Map(
      occupiedRooms.map((reservationGroup) => [
        reservationGroup.room_id,
        reservationGroup._sum.guest_count ?? 0,
      ]),
    );

    return {
      rooms: rooms.map((room) => ({
        id: room.id,
        type: room.type,
        capacity: room.capacity,
        price_per_night: room.price_per_night,
        occupancy: currentGuestsByRoomId.get(room.id) ?? 0,
      })),
    };
  }

  // Time-to-event support: how many rooms are free right now and, when none are,
  // the soonest game-day a currently-occupied room frees (the earliest check_out_day
  // among confirmed reservations spanning today). Derived entirely from live data so
  // the assistant can answer "when will a room free up?" with a real number.
  async availability() {
    const currentDay = this.simulation.currentDay();

    const [rooms, activeReservations] = await Promise.all([
      this.prisma.room.findMany(),
      this.prisma.reservation.findMany({
        where: {
          status: ReservationStatus.CONFIRMED,
          check_in_day: { lte: currentDay },
          check_out_day: { gt: currentDay },
        },
        select: { room_id: true, check_out_day: true },
      }),
    ]);

    const occupiedRoomIds = new Set(activeReservations.map((r) => r.room_id));
    const availableNow = rooms.filter((room) => !occupiedRoomIds.has(room.id)).length;

    const soonestFreeDay =
      availableNow > 0 || activeReservations.length === 0
        ? null
        : Math.min(...activeReservations.map((r) => r.check_out_day));

    return {
      current_day: currentDay,
      total_rooms: rooms.length,
      available_now: availableNow,
      soonest_free_day: soonestFreeDay,
      days_until_free: soonestFreeDay === null ? null : soonestFreeDay - currentDay,
    };
  }
}
