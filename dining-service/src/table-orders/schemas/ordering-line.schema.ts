import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { OrderingItem } from './ordering-item.schema';

@Schema()
export class OrderingLine {
  @ApiProperty({ required: false })
  _id?: string;

  @ApiProperty()
  @Prop({ default: false })
  paid: boolean;

  @ApiProperty()
  @Prop({ required: true })
  item: OrderingItem;

  @ApiProperty()
  @Prop({ required: true, min: 1 })
  howMany: number;

  @ApiProperty()
  @Prop({ required: true, min: 0 })
  price: number;

  @ApiProperty()
  @Prop({ default: false })
  sentForPreparation: boolean;

  @ApiProperty()
  @Prop({ required: true })
  orderer: string;

  @ApiProperty()
  @Prop({ required: true })
  receiver: string;

  @ApiProperty()
  @Prop({ required: true, min: 1})
  receiverTableNumber: number;

  constructor() {
    this.paid = false;
    this.item = null;
    this.howMany = 0;
    this.price = 0;
    this.sentForPreparation = false;
    this.orderer = null;
    this.receiver = null;
    this.receiverTableNumber = null;
  }
}

export const OrderingLineSchema = SchemaFactory.createForClass(OrderingLine);