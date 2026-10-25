import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

export class InvalidReceiverException extends ErrorDto {
    constructor(receiver: string) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, `Receiver '${receiver}' is not a participant of this table or of its group`);
    }
}