import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

export class CannotJoinOwnTableException extends ErrorDto {
  constructor() {
    super(HttpStatus.UNPROCESSABLE_ENTITY, 'Cannot join own table', 'A table cannot request to join its own group');
  }
}
