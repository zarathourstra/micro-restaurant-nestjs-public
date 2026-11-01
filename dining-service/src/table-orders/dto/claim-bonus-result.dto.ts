import { ApiProperty } from '@nestjs/swagger';

export class AffectedTableOrderDto {
	@ApiProperty()
	tableOrderId: string;

	@ApiProperty()
	tableNumber: number;

	@ApiProperty({ isArray: true })
	lineIds: string[];

	@ApiProperty()
	percent: number;
}

export class ClaimBonusTierDto {
	@ApiProperty()
	minScore: number;

	@ApiProperty()
	discountPercent: number;

	@ApiProperty()
	lineCount: number;
}

export class ClaimBonusResultDto {
	@ApiProperty({ nullable: true, type: ClaimBonusTierDto })
	tier: ClaimBonusTierDto | null;

	@ApiProperty({ isArray: true, type: AffectedTableOrderDto })
	affected: AffectedTableOrderDto[];
}
