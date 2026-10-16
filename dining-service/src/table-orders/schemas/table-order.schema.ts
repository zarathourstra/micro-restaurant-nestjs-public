import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

import { OrderingLine, OrderingLineSchema } from './ordering-line.schema';

import { PreparationDto } from '../dto/preparation.dto';

export type TableOrderDocument = TableOrder & Document;

@Schema({
  versionKey: false,
})
export class TableOrder {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  @Prop({ required: true, min: 0 })
  tableNumber: number;

  @ApiProperty()
  @Prop({ required: true, min: 0 })
  customersCount: number;

  @ApiProperty()
  @Prop({required: true})
  wsContext: {wsKey: string, groupId: string}

  @ApiProperty()
  @Prop({required: true, type: [{ name: String }], validate: v => v.length >= 1 })
  participants: {name: string}[]

  @ApiProperty()
  @Prop({ required: true, default: new Date() })
  opened: Date;

  @ApiProperty()
  @Prop({ type:[OrderingLineSchema], default: [] })
  lines: OrderingLine[];

  @ApiProperty()
  @Prop({ default: [] })
  preparations: PreparationDto[];

  @ApiProperty()
  @Prop({ default: null })
  billed: Date;

  @ApiProperty()
  @Prop({ default: 0, min: 0, max: 100 })
  discountPercent?: number;

  @ApiProperty({ required: false, isArray: true })
  @Prop({ type: [String], default: [] })
  discountLineIds?: string[];

  // Computed on read in TableOrdersService.computeTotals() - not persisted (no @Prop).
  @ApiProperty({ required: false })
  totals?: { subtotal: number; discountAmount: number; total: number };
}

export const TableOrderSchema = SchemaFactory.createForClass(TableOrder);
