import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

export class AlreadyInSameGroupException extends ErrorDto {
  constructor() {
    super(HttpStatus.UNPROCESSABLE_ENTITY, 'Already in the same group', 'Both tables already belong to the same group');
  }
}
