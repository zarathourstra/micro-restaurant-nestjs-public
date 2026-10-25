import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

export class JoinRequestNotFoundException extends ErrorDto {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'Join request not found', 'The join request does not exist, has expired, or is not addressed to this table');
  }
}
