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
  @Prop({ required: true, min: 0 })
  howMany: number;

  @ApiProperty()
  @Prop({ default: false })
  sentForPreparation: boolean;

  constructor() {
    this.paid = false; 
    this.item = null;
    this.howMany = 0;
    this.sentForPreparation = false;
  }
}

export const OrderingLineSchema = SchemaFactory.createForClass(OrderingLine);