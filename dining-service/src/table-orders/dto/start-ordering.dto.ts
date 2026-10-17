import {ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsPositive, IsString} from 'class-validator';

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

  @IsOptional()
  @IsString()
  groupJoinKey?: string
}
