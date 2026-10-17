import {IsInt, IsMongoId, IsNotEmpty, IsPositive, Min} from 'class-validator';

export class AddMenuItemDto {
  @IsMongoId()
  menuItemId: string;

  @IsNotEmpty()
  menuItemShortName: string;

  @IsNotEmpty()
  @IsPositive()
  howMany: number;

  @IsNotEmpty()
  participant: string;

  //si cadeau, front enverra participant != receiver, sinon participant == receiver
  @IsNotEmpty()
  receiver: string;

  @IsInt()
  @Min(0)
  receiverTableNumber: number;
}
