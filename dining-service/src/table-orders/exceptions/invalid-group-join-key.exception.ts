import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

export class InvalidGroupJoinKeyException extends ErrorDto {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'Invalid group join key', 'The group join key is unknown or has already been used');
  }
}
