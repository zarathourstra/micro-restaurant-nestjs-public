import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

export class JoinRequestAlreadyPendingException extends ErrorDto {
  constructor() {
    super(HttpStatus.CONFLICT, 'Join request already pending', 'A join request from this table to the target table is already waiting for an answer');
  }
}
