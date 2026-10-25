import { ApiProperty } from '@nestjs/swagger';

export class GroupMemberDto {
  @ApiProperty()
  tableNumber: number;

  @ApiProperty({ })
  participants: { name: string }[];
}
