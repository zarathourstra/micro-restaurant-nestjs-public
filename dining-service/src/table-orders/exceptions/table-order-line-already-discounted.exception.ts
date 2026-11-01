import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';
import { TableOrder } from '../schemas/table-order.schema';

export class TableOrderLineAlreadyDiscountedException extends ErrorDto {
	constructor(tableOrder: TableOrder, lineId: string) {
		super(
			HttpStatus.UNPROCESSABLE_ENTITY,
			'Table order line already discounted',
			`"${lineId}" already belongs to an existing discount grant on table order "${tableOrder._id}"`,
		);
	}
}
