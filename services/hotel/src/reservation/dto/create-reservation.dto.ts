import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsString,
  Min,
} from 'class-validator';
import { RoomType } from '../../../generated/prisma/client.js';

export class CreateReservationDto {
  @IsString()
  guest_id!: string;

  @IsEnum(RoomType)
  room_type!: RoomType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  guest_count!: number;

  @ArrayMinSize(1)
  @IsString({ each: true })
  party_guest_ids!: string[];

  @Type(() => Number)
  @IsInt()
  check_in_day!: number;

  @Type(() => Number)
  @IsInt()
  check_out_day!: number;
}
