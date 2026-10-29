import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClaimBonusDto {
	@ApiProperty({ description: 'The score obtained in the bonus minigame.' })
	@IsNumber()
	@Min(0)
	score: number;
}
