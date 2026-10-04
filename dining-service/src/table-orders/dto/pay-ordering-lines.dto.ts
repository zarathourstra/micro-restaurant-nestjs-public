import { ArrayNotEmpty, ArrayUnique, IsArray, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PayOrderingLinesDto {
	@ApiProperty({ type: [String], description: 'Identifiers of complete ordering lines to pay.' })
	@IsArray()
	@ArrayNotEmpty()
	@ArrayUnique()
	@IsMongoId({ each: true })
	lineIds: string[];
}
