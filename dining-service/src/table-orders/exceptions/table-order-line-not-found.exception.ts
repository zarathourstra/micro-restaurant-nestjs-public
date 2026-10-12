import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';
import { TableOrder } from '../schemas/table-order.schema';

export class TableOrderLineNotFoundException extends ErrorDto {
	constructor(tableOrder: TableOrder, lineId: string) {
		super(
			HttpStatus.UNPROCESSABLE_ENTITY,
			'Table order line not found',
			`"${lineId}" does not match any line on table order "${tableOrder._id}"`,
		);
	}
}
