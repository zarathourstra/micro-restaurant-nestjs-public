import { Matches } from 'class-validator';

export class GetGroupParams {
  @Matches(/^[0-9a-f]{32}$/)
  groupId: string;
}
