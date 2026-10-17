import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TableOrder, TableOrderDocument } from '../schemas/table-order.schema';
import { OrderingItem } from '../schemas/ordering-item.schema';
import { OrderingLine } from '../schemas/ordering-line.schema';

import { StartOrderingDto } from '../dto/start-ordering.dto';
import { AddMenuItemDto } from '../dto/add-menu-item.dto';
import { PayOrderingLinesDto } from '../dto/pay-ordering-lines.dto';
import { ApplyDiscountDto } from '../dto/apply-discount.dto';
import { PreparationDto } from '../dto/preparation.dto';

import { OrderingLinesWithPreparations } from '../interfaces/ordering-lines-with-preparations.interface';

import { TablesService } from '../../tables/services/tables.service';
import { MenuProxyService } from './menu-proxy.service';
import { KitchenProxyService } from './kitchen-proxy.service';

import { TableOrderIdNotFoundException } from '../exceptions/table-order-id-not-found.exception';
import { AddMenuItemDtoNotFoundException } from '../exceptions/add-menu-item-dto-not-found.exception';
import { TableOrderAlreadyBilledException } from '../exceptions/table-order-already-billed.exception';
import { TableOrderLinesNotPayableException } from '../exceptions/table-order-lines-not-payable.exception';
import { TableOrderNotFullyPaidException } from '../exceptions/table-order-not-fully-paid.exception';
import { TableOrderLineNotFoundException } from '../exceptions/table-order-line-not-found.exception';
import { DiningSocketsService } from './dining-sockets.service';
import {InvalidParticipantException} from "../exceptions/invalid-participant.exception";
import {InvalidReceiverException} from "../exceptions/invalid-receiver.exception";

@Injectable()
export class TableOrdersService {
  constructor(
    @InjectModel(TableOrder.name) private tableOrderModel: Model<TableOrderDocument>,
    private readonly tablesService: TablesService,
    private readonly menuProxyService: MenuProxyService,
    private readonly kitchenProxyService: KitchenProxyService,
    private readonly diningSocketsService: DiningSocketsService
  ) {}

  async findAll(billed?: boolean): Promise<TableOrder[]> {
    const filter = billed === undefined ? {} : { billed: billed ? { $ne: null } : null };
    const tableOrders = await this.tableOrderModel.find(filter).lean();
    return tableOrders.map((tableOrder) => this.finalizeTableOrder(tableOrder));
  }

  async findOne(tableOrderId: string): Promise<TableOrder> {
    const foundItem = await this.tableOrderModel.findOne({ _id: tableOrderId }).lean();

    if (foundItem === null) {
      throw new TableOrderIdNotFoundException(tableOrderId);
    }

    return this.finalizeTableOrder(foundItem);
  }

  private finalizeTableOrder(tableOrder: TableOrder): TableOrder {
    tableOrder.preparations = (tableOrder.preparations ?? []).map((preparation) =>
      PreparationDto.kitchenPreparationToPreparationDtoFactory(preparation),
    );
    tableOrder.totals = this.computeTotals(tableOrder);
    return tableOrder;
  }

  // Computed on the way out, not persisted - the first place dining-service hands
  // back a real server-computed amount due (direct/BFF can only fake this client-side).
  private computeTotals(tableOrder: TableOrder): { subtotal: number; discountAmount: number; total: number } {
    const lines = tableOrder.lines ?? [];
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.howMany, 0);

    const discountPercent = tableOrder.discountPercent ?? 0;
    const discountLineIds = new Set(tableOrder.discountLineIds ?? []);
    const discountBase = lines
      .filter((line) => discountLineIds.has(line._id?.toString()))
      .reduce((sum, line) => sum + line.price * line.howMany, 0);
    const discountAmount = Math.round(discountBase * discountPercent) / 100;

    return {
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
    };
  }

  async startOrdering(dto: StartOrderingDto): Promise<TableOrder> {
    const groupId = dto.groupJoinKey ? this.diningSocketsService.peekJoinKey(dto.groupJoinKey).groupId
      : this.diningSocketsService.generateGroupId();

    const table = await this.tablesService.takeTable(
      dto.tableNumber,
    );

    const tableOrder = new TableOrder();
    tableOrder.tableNumber = table.number;
    tableOrder.customersCount = dto.customersCount;
    tableOrder.opened = new Date();
    tableOrder.participants = dto.participants;
    tableOrder.groupId = groupId;

    let created: TableOrderDocument;
    try {
      created = await this.tableOrderModel.create(tableOrder);
    } catch (error) {
      await this.tablesService.releaseTable(table.number);
      throw error;
    }

    try {
      const wsContext = dto.groupJoinKey ? this.diningSocketsService.registerMemberOrder(created._id.toString(), dto.groupJoinKey)
          : this.diningSocketsService.registerOriginOrder(created._id.toString(), groupId);

      const createdOrder = this.finalizeTableOrder(created);
      createdOrder.wsContext = wsContext;
      return createdOrder;
    } catch (error) {
      // if the key was consumed by another table in the meantime: undo the table and the order.
      await this.tableOrderModel.deleteOne({ _id: created._id });
      await this.tablesService.releaseTable(table.number);
      throw error;
    }
  }

  async addOrderingLineToTableOrder(tableOrderId: string, addMenuItemDto: AddMenuItemDto): Promise<TableOrder> {
    const tableOrder: TableOrder = await this.findOne(tableOrderId);
    const orderer = addMenuItemDto.participant;

    if (tableOrder.billed !== null) {
      throw new TableOrderAlreadyBilledException(tableOrder);
    }

    if (orderer === null || orderer.trim() === '' || !tableOrder.participants.some((p) => p.name === orderer)) {
      throw new InvalidParticipantException(tableOrder);
    }

    //verif si receiver est vraiment dans la table/groupe (normalement c'est le cas, sécurité)
    await this.assertReceiver(tableOrder, addMenuItemDto.receiver, addMenuItemDto.receiverTableNumber);

    const orderingItem: OrderingItem = await this.menuProxyService.findByShortName(addMenuItemDto.menuItemShortName);

    if (orderingItem === null) {
      throw new AddMenuItemDtoNotFoundException(addMenuItemDto);
    }

    if (addMenuItemDto.menuItemId !== orderingItem._id) {
      throw new AddMenuItemDtoNotFoundException(addMenuItemDto);
    }

    // orderingItem was just resolved from the same cached menu lookup, so the price
    // lookup below cannot structurally miss - the ?? 0 is just a defensive fallback.
    const price = (await this.menuProxyService.getPrice(addMenuItemDto.menuItemShortName)) ?? 0;

    const receiver = addMenuItemDto.receiver;
    const receiverTableNumber = addMenuItemDto.receiverTableNumber;

    //merge uniquement les lignes avec meme orderer, receiver et item et pas encore envoyées en cuisine
    const mergeableLineIndex = tableOrder.lines.findIndex(
        (line) =>
            !line.sentForPreparation &&
            line.item._id === orderingItem._id &&
            line.orderer === orderer &&
            line.receiver === receiver &&
            line.receiverTableNumber === receiverTableNumber,
    );

    if (mergeableLineIndex !== -1) {
      tableOrder.lines[mergeableLineIndex].howMany += addMenuItemDto.howMany;

      return this.finalizeTableOrder(await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, { returnDocument: 'after' }));
    }

    const orderingLine: OrderingLine = new OrderingLine();
    orderingLine.item = orderingItem;
    orderingLine.howMany = addMenuItemDto.howMany;
    orderingLine.price = price;
    orderingLine.orderer = orderer;
    orderingLine.receiver = addMenuItemDto.receiver;
    orderingLine.receiverTableNumber = receiverTableNumber;

    return this.finalizeTableOrder(await this.tableOrderModel.findByIdAndUpdate(
      tableOrder._id,
      { $push: { lines: orderingLine } },
      { returnDocument: 'after' },
    ));
  }

  private async assertReceiver(tableOrder: TableOrder, receiver: string, receiverTableNumber: number): Promise<void> {
    const ownTable = receiverTableNumber === tableOrder.tableNumber;
    const target = ownTable
        ? tableOrder
        : tableOrder.groupId
            ? await this.tableOrderModel
                .findOne({ groupId: tableOrder.groupId, billed: null, tableNumber: receiverTableNumber })
                .lean()
            : null;

    if (!target || !target.participants.some((p) => p.name === receiver)) {
      throw new InvalidReceiverException(receiver);
    }
  }


  async manageOrderingLines(tableNumber: number, orderingLines: OrderingLine[]): Promise<OrderingLinesWithPreparations> {
    let orderingLinesToSend: OrderingLine[] = [];

    const newOrderingLines: OrderingLine[] = orderingLines.map((orderingLine) => {
      if (!orderingLine.sentForPreparation) {
        orderingLinesToSend.push(orderingLine);
        orderingLine.sentForPreparation = true;
      }

      return orderingLine;
    });

    const preparations: PreparationDto[] = await this.kitchenProxyService.sendItemsToCook(tableNumber, orderingLinesToSend);

    return {
      orderingLines: newOrderingLines,
      preparations,
    };
  };

  async sendItemsForPreparation(tableOrderId: string): Promise<PreparationDto[]> {
    const tableOrder: TableOrder = await this.findOne(tableOrderId);

    if (tableOrder.billed !== null) {
      throw new TableOrderAlreadyBilledException(tableOrder);
    }

    const managedLines: OrderingLinesWithPreparations = await this.manageOrderingLines(tableOrder.tableNumber, tableOrder.lines);

    const preparations = managedLines.preparations ?? [];

    tableOrder.lines = managedLines.orderingLines;
    tableOrder.preparations = [...(tableOrder.preparations ?? []), ...preparations];


    await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, { returnDocument: 'after' });

    return preparations;
  }

  async payLines(tableOrderId: string, payOrderingLinesDto: PayOrderingLinesDto): Promise<TableOrder> {
    const tableOrder: TableOrder = await this.findOne(tableOrderId);

    if (tableOrder.billed !== null) {
      throw new TableOrderAlreadyBilledException(tableOrder);
    }

    const requestedLineIds = payOrderingLinesDto.lineIds;
    const requestedLineIdSet = new Set(requestedLineIds);
    const selectedLines = requestedLineIds.map((lineId) => tableOrder.lines.find((line) => line._id?.toString() === lineId));

    if (
      requestedLineIdSet.size !== requestedLineIds.length ||
      selectedLines.some((line) => !line || !line.sentForPreparation || line.paid)
    ) {
      throw new TableOrderLinesNotPayableException(tableOrder, requestedLineIds);
    }

    selectedLines.forEach((line) => {
      line.paid = true;
    });

    return this.finalizeTableOrder(await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, { returnDocument: 'after' }));
  }

  async closeOrder(tableOrderId: string): Promise<TableOrder> {
    const tableOrder: TableOrder = await this.findOne(tableOrderId);

    if (tableOrder.billed !== null) {
      throw new TableOrderAlreadyBilledException(tableOrder);
    }

    const unpaidLinesCount = tableOrder.lines.filter((line) => !line.paid).length;
    if (unpaidLinesCount > 0) {
      throw new TableOrderNotFullyPaidException(tableOrder, unpaidLinesCount);
    }

    tableOrder.billed = new Date();
    await this.tablesService.releaseTable(tableOrder.tableNumber);

    return this.finalizeTableOrder(await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, { returnDocument: 'after' }));
  }

  async applyDiscount(tableOrderId: string, applyDiscountDto: ApplyDiscountDto): Promise<TableOrder> {
    const tableOrder: TableOrder = await this.findOne(tableOrderId);

    if (tableOrder.billed !== null) {
      throw new TableOrderAlreadyBilledException(tableOrder);
    }

    const existingLineIds = new Set(tableOrder.lines.map((line) => line._id?.toString()));
    const unknownLineId = applyDiscountDto.lineIds.find((lineId) => !existingLineIds.has(lineId));
    if (unknownLineId) {
      throw new TableOrderLineNotFoundException(tableOrder, unknownLineId);
    }

    tableOrder.discountPercent = applyDiscountDto.percent;
    tableOrder.discountLineIds = applyDiscountDto.lineIds;

    return this.finalizeTableOrder(await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, { returnDocument: 'after' }));
  }
}
