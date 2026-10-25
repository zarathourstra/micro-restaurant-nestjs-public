import { IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinRequestDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  targetTableNumber: number;
}
