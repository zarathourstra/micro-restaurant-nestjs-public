import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

import { TableOrder } from '../schemas/table-order.schema';

export class TableOrderAlreadyClosedException extends ErrorDto {
  constructor(tableOrder: TableOrder) {
    super(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'TableOrder is already closed',
      `"${tableOrder._id}" is the Id of the table order (on table ${tableOrder.tableNumber}) already closed`,
    );
  }
}