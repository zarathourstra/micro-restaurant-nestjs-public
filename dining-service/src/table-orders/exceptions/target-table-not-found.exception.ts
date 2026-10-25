import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

export class TargetTableNotFoundException extends ErrorDto {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'Target table not found', 'The requested table has no open table order to join');
  }
}
