import { HttpStatus } from '@nestjs/common';

import { ErrorDto } from '../../shared/dto/error.dto';

export class GroupNotFoundException extends ErrorDto {
  constructor(groupId: string) {
    super(HttpStatus.NOT_FOUND, 'Group not found', `"${groupId}" does not match any open table order group`);
  }
}
