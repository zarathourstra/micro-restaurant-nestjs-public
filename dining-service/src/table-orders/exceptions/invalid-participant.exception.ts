import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

import { TableOrder } from '../schemas/table-order.schema';

export class InvalidParticipantException extends ErrorDto {
    constructor(tableOrder: TableOrder) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, 'Invalid or null participant');
    }
}
