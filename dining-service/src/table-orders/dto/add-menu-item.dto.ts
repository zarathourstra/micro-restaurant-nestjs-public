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
  orderer: string;

  //si cadeau, front enverra orderer != receiver, sinon orderer == receiver
  @IsNotEmpty()
  receiver: string;

  @IsInt()
  @Min(0)
  receiverTableNumber: number;
}
