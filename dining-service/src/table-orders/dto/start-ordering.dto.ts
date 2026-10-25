import {ArrayMinSize, IsArray, IsNotEmpty, IsPositive} from 'class-validator';

export class StartOrderingDto {
  @IsNotEmpty()
  @IsPositive()
  tableNumber: number;

  @IsNotEmpty()
  @IsPositive()
  customersCount: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsNotEmpty({ each: true })
  participants: {name: string}[];
}
