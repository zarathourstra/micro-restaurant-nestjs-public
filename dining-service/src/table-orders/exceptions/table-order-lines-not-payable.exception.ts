import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';
import { TableOrder } from '../schemas/table-order.schema';

export class TableOrderLinesNotPayableException extends ErrorDto {
	constructor(tableOrder: TableOrder, lineIds: string[]) {
		super(
			HttpStatus.UNPROCESSABLE_ENTITY,
			'Table order lines are not payable',
			`One or more requested lines are unknown, not sent for preparation, or already paid for table order "${tableOrder._id}": ${lineIds.join(', ')}`,
		);
	}
}
