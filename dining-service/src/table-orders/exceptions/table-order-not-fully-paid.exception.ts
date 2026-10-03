import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';
import { TableOrder } from '../schemas/table-order.schema';

export class TableOrderNotFullyPaidException extends ErrorDto {
	constructor(tableOrder: TableOrder, unpaidLinesCount: number) {
		super(
			HttpStatus.UNPROCESSABLE_ENTITY,
			'Table order is not fully paid',
			`Table order "${tableOrder._id}" still has ${unpaidLinesCount} unpaid line(s)`,
		);
	}
}
