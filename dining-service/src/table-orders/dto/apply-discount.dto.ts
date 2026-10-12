import { IsArray, IsMongoId, IsNumber, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyDiscountDto {
	@ApiProperty({ description: 'Percentage (0-100) to discount off the selected lines.' })
	@IsNumber()
	@Min(0)
	@Max(100)
	percent: number;

	@ApiProperty({ isArray: true, description: 'The ordering lines the discount applies to (e.g. 100 = these dishes are free).' })
	@IsArray()
	@IsMongoId({ each: true })
	lineIds: string[];
}
