import {Injectable, Logger} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TableOrder, TableOrderDocument } from '../schemas/table-order.schema';
import { OrderingItem } from '../schemas/ordering-item.schema';
import { OrderingLine } from '../schemas/ordering-line.schema';

import { StartOrderingDto } from '../dto/start-ordering.dto';
import { AddMenuItemDto } from '../dto/add-menu-item.dto';
import { PayOrderingLinesDto } from '../dto/pay-ordering-lines.dto';
import { ApplyDiscountDto } from '../dto/apply-discount.dto';
import { ClaimBonusDto } from '../dto/claim-bonus.dto';
import { AffectedTableOrderDto, ClaimBonusResultDto } from '../dto/claim-bonus-result.dto';
import { PreparationDto } from '../dto/preparation.dto';
import { GroupMemberDto } from '../dto/group-member.dto';
import { GroupMember, GroupUpdatedData} from "../controllers/table-orders.socket.gateway";

import { rewardForScore } from '../constants/reward-tiers';

import { OrderingLinesWithPreparations } from '../interfaces/ordering-lines-with-preparations.interface';

import { TablesService } from '../../tables/services/tables.service';
import { MenuProxyService } from './menu-proxy.service';
import { KitchenProxyService } from './kitchen-proxy.service';
import {
  GroupParticipant,
  groupRoom,
  orderRoom,
  TableOrdersSocketGateway
} from "../controllers/table-orders.socket.gateway";

import { TableOrderIdNotFoundException } from '../exceptions/table-order-id-not-found.exception';
import { AddMenuItemDtoNotFoundException } from '../exceptions/add-menu-item-dto-not-found.exception';
import { TableOrderAlreadyBilledException } from '../exceptions/table-order-already-billed.exception';
import { TableOrderLinesNotPayableException } from '../exceptions/table-order-lines-not-payable.exception';
import { TableOrderNotFullyPaidException } from '../exceptions/table-order-not-fully-paid.exception';
import { TableOrderLineNotFoundException } from '../exceptions/table-order-line-not-found.exception';
import { TableOrderLineAlreadyDiscountedException } from '../exceptions/table-order-line-already-discounted.exception';
import { GroupNotFoundException } from '../exceptions/group-not-found.exception';
import {DiningSocketsService, PendingJoinRequest} from './dining-sockets.service';
import {InvalidParticipantException} from "../exceptions/invalid-participant.exception";
import {InvalidReceiverException} from "../exceptions/invalid-receiver.exception";
import {JoinRequestDto} from "../dto/join-request.dto";
import {AlreadyInSameGroupException} from "../exceptions/already-in-same-group.exception";
import {CannotJoinOwnTableException} from "../exceptions/cannot-join-own-table.exception";
import {TargetTableNotFoundException} from "../exceptions/target-table-not-found.exception";
import {JoinRequestAnswerDto} from "../dto/join-request-answer.dto";
import {find} from "rxjs";
import {JoinRequestNotFoundException} from "../exceptions/join-request-not-found.exception";

@Injectable()
export class TableOrdersService {
  // Demo logs: one tag per feature so the workflows can be followed in `docker logs`.
  private readonly groupLogger = new Logger('Groupe');
  private readonly giftLogger = new Logger('Cadeau');
  private readonly bonusLogger = new Logger('Bonus');

  constructor(
      @InjectModel(TableOrder.name) private tableOrderModel: Model<TableOrderDocument>,
      private readonly tablesService: TablesService,
      private readonly menuProxyService: MenuProxyService,
      private readonly kitchenProxyService: KitchenProxyService,
      private readonly diningSocketsService: DiningSocketsService,
      private readonly tableOrdersSocketGateway: TableOrdersSocketGateway,
  ) {
  }

  async findAll(billed?: boolean): Promise<TableOrder[]> {
    const filter = billed === undefined ? {} : {billed: billed ? {$ne: null} : null};
    const tableOrders = await this.tableOrderModel.find(filter).lean();
    return tableOrders.map((tableOrder) => this.finalizeTableOrder(tableOrder));
  }

  async findOne(tableOrderId: string): Promise<TableOrder> {
    const foundItem = await this.tableOrderModel.findOne({_id: tableOrderId}).lean();

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
    const linesById = new Map(lines.map((line) => [line._id?.toString(), line]));

    // Grants never overlap (enforced in applyDiscount), so this is a plain sum, not a max/priority rule.
    const discountAmount = (tableOrder.discounts ?? []).reduce((sum, grant) => {
      const grantBase = grant.lineIds.reduce((base, lineId) => {
        const line = linesById.get(lineId);
        return line ? base + line.price * line.howMany : base;
      }, 0);
      return sum + Math.round(grantBase * grant.percent) / 100;
    }, 0);

    return {
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
    };
  }

  async startOrdering(dto: StartOrderingDto): Promise<TableOrder> {
    const groupId = this.diningSocketsService.generateGroupId();

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

    const wsContext = this.diningSocketsService.registerOriginOrder(created._id.toString(), groupId);
    this.groupLogger.log(`Table ${table.number} ouverte -> groupe ${groupId.slice(0, 8)} (origine), clé socket émise`);

    // toObject(): a Mongoose document serializes schema paths only, which would drop wsContext and totals.
    const createdOrder = this.finalizeTableOrder(created.toObject() as TableOrder);
    createdOrder.wsContext = wsContext;
    return createdOrder;
  }

  async addOrderingLineToTableOrder(tableOrderId: string, addMenuItemDto: AddMenuItemDto): Promise<TableOrder> {
    const tableOrder: TableOrder = await this.findOne(tableOrderId);
    const orderer = addMenuItemDto.orderer;

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

    this.logGiftLine(tableOrder, addMenuItemDto);

    if (mergeableLineIndex !== -1) {
      tableOrder.lines[mergeableLineIndex].howMany += addMenuItemDto.howMany;

      return this.finalizeTableOrder(await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, {returnDocument: 'after'}));
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
        {$push: {lines: orderingLine}},
        {returnDocument: 'after'},
    ));
  }

  private async assertReceiver(tableOrder: TableOrder, receiver: string, receiverTableNumber: number): Promise<void> {
    const ownTable = receiverTableNumber === tableOrder.tableNumber;
    const target = ownTable
        ? tableOrder
        : tableOrder.groupId
            ? await this.tableOrderModel
                .findOne({groupId: tableOrder.groupId, billed: null, tableNumber: receiverTableNumber})
                .lean()
            : null;

    if (!target || !target.participants.some((p) => p.name === receiver)) {
      this.giftLogger.warn(`Offre refusée : ${receiver} (table ${receiverTableNumber}) n'est pas dans le groupe de la table ${tableOrder.tableNumber}`);
      throw new InvalidReceiverException(receiver);
    }
  }

  // Only gifts are logged (receiver is not the orderer, or sits at another table).
  private logGiftLine(tableOrder: TableOrder, dto: AddMenuItemDto): void {
    if (dto.receiver === dto.orderer && dto.receiverTableNumber === tableOrder.tableNumber) {
      return;
    }

    this.giftLogger.log(
      `Offre : ${dto.howMany}x ${dto.menuItemShortName} de ${dto.orderer} (table ${tableOrder.tableNumber}) ` +
      `-> ${dto.receiver} (table ${dto.receiverTableNumber}), destinataire vérifié dans le groupe`,
    );
  }


  async manageOrderingLines(tableNumber: number, orderingLines: OrderingLine[]): Promise<OrderingLinesWithPreparations> {
    const linesByDestination = new Map<number, OrderingLine[]>();

    for (const line of orderingLines) {
      if (line.sentForPreparation) {
        continue;
      }

      const destination = line.receiverTableNumber ?? tableNumber;
      const linesForDestination = linesByDestination.get(destination) ?? [];
      linesForDestination.push(line);
      linesByDestination.set(destination, linesForDestination);
    }

    const preparations: PreparationDto[] = [];

    for (const [destination, lines] of linesByDestination) {
      const created = await this.kitchenProxyService.sendItemsToCook(destination, lines);
      preparations.push(...created);

      if (destination !== tableNumber) {
        this.giftLogger.log(`Cuisine : ${lines.length} plat(s) offert(s) par la table ${tableNumber} envoyé(s) à la table ${destination}`);
        await this.notifyGiftReceived(tableNumber, destination, lines);
      }
    }

    for (const lines of linesByDestination.values()) {
      lines.forEach((line) => (line.sentForPreparation = true));
    }

    return {
      orderingLines,
      preparations,
    };
  }

  // Receiver is only known by table number at this point (lines are grouped by destination
  // table), so the room key (its tableOrderId) needs one lean lookup - same resolution assertReceiver
  // already does when the gift is placed.
  private async notifyGiftReceived(fromTableNumber: number, destinationTableNumber: number, lines: OrderingLine[]): Promise<void> {
    const destinationOrder = await this.tableOrderModel.findOne({tableNumber: destinationTableNumber, billed: null}).select('_id').lean();
    if (!destinationOrder) {
      return;
    }

    this.tableOrdersSocketGateway.emitGiftReceived(orderRoom(destinationOrder._id.toString()), {
      fromTableNumber,
      items: lines.map((line) => ({shortName: line.item.shortName, howMany: line.howMany, receiver: line.receiver})),
    });
  }

  async sendItemsForPreparation(tableOrderId: string): Promise<PreparationDto[]> {
    const tableOrder: TableOrder = await this.findOne(tableOrderId);

    if (tableOrder.billed !== null) {
      throw new TableOrderAlreadyBilledException(tableOrder);
    }

    const managedLines: OrderingLinesWithPreparations = await this.manageOrderingLines(tableOrder.tableNumber, tableOrder.lines);

    const preparations = managedLines.preparations ?? [];

    tableOrder.lines = managedLines.orderingLines;
    tableOrder.preparations = [...(tableOrder.preparations ?? []), ...preparations];


    await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, {returnDocument: 'after'});

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

    return this.finalizeTableOrder(await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, {returnDocument: 'after'}));
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

    return this.finalizeTableOrder(await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, {returnDocument: 'after'}));
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

    const alreadyDiscountedLineIds = new Set((tableOrder.discounts ?? []).flatMap((grant) => grant.lineIds));
    const alreadyDiscountedLineId = applyDiscountDto.lineIds.find((lineId) => alreadyDiscountedLineIds.has(lineId));
    if (alreadyDiscountedLineId) {
      throw new TableOrderLineAlreadyDiscountedException(tableOrder, alreadyDiscountedLineId);
    }

    tableOrder.discounts = [...(tableOrder.discounts ?? []), { percent: applyDiscountDto.percent, lineIds: applyDiscountDto.lineIds }];

    this.bonusLogger.log(`Remise de ${applyDiscountDto.percent}% appliquée à ${applyDiscountDto.lineIds.length} ligne(s) de la table ${tableOrder.tableNumber}`);

    return this.finalizeTableOrder(await this.tableOrderModel.findByIdAndUpdate(tableOrder._id, tableOrder, {returnDocument: 'after'}));
  }

  // Full TableOrder documents (lines included), unlike findGroupMembers' lightweight GroupMemberDto -
  // this is the pool claimBonus selects across. Naturally degrades to a single-table list for a solo group.
  private async findOpenTableOrdersInGroup(groupId: string): Promise<TableOrder[]> {
    return this.tableOrderModel.find({ groupId, billed: null }).lean();
  }

  async findGroupMembers(groupId: string): Promise<GroupMemberDto[]> {
    const groupOrders = await this.tableOrderModel
        .find({groupId, billed: null})
        .sort({tableNumber: 1})
        .select('tableNumber participants')
        .lean();

    if (groupOrders.length === 0) {
      throw new GroupNotFoundException(groupId);
    }

    return groupOrders.map((order) => ({
      tableNumber: order.tableNumber,
      participants: order.participants.map((p) => ({name: p.name})),
    }));
  }

  async requestToJoinGroup(tableOrderId: string, dto: JoinRequestDto): Promise<{requestId: string, expiresAt: Date}> {
    const requester: TableOrder = await this.findOne(tableOrderId);
    const target = await this.tableOrderModel.findOne({ tableNumber : dto.targetTableNumber, billed: null }).lean();

    if (target == null) {
      throw new TargetTableNotFoundException();
    }

    if (requester.billed !== null) {
      throw new TableOrderAlreadyBilledException(requester);
    }

    if(target._id.toString() === requester._id.toString()) {
      throw new CannotJoinOwnTableException();
    }

    if (requester.groupId && target.groupId && requester.groupId === target.groupId) {
      throw new AlreadyInSameGroupException();
    }

    const joinReq : PendingJoinRequest = this.diningSocketsService.createJoinRequest(target._id.toString(), requester._id.toString(), target.groupId);
    this.groupLogger.log(`Demande ${joinReq.requestId.slice(0, 8)} : table ${requester.tableNumber} veut rejoindre le groupe de la table ${target.tableNumber} (valable 2 min)`);
    if(joinReq){
      this.tableOrdersSocketGateway.emitJoinRequested(orderRoom(target._id.toString()), {
        requestId: joinReq.requestId,
        requestingTableNumber: requester.tableNumber,
        customersCount: requester.customersCount,
        participants: requester.participants,
        expiresAt: joinReq.expiresAt,
      })
    }

    return {
        requestId: joinReq.requestId,
        expiresAt: joinReq.expiresAt
    }
  }

  async answerJoinRequest(tableOrderId: string, dto: JoinRequestAnswerDto): Promise<void> {
    const target: TableOrder = await this.findOne(tableOrderId);
    const request = this.diningSocketsService.getJoinRequest(dto.requestId);
    if (!request || request.originTableOrderId !== tableOrderId) {
      throw new JoinRequestNotFoundException();
    }
    const requester = await this.findOne(request.memberTableOrderId);
    const requesterId = requester._id.toString();
    const oldGroupId = requester.groupId.toString();

    if (dto.decision === 'accept') {
      if (requester.billed !== null) {
        throw new TableOrderAlreadyBilledException(requester);
      }
      const updatedRequester = await this.tableOrderModel.findByIdAndUpdate(requesterId, {groupId: target.groupId, groupOriginTableNumber: target.tableNumber},
          { returnDocument: 'after' }).lean();
      if (!updatedRequester) throw new TableOrderIdNotFoundException(requesterId);
      this.diningSocketsService.deleteJoinRequest(dto.requestId);
      this.diningSocketsService.moveOrderToGroup(requesterId, updatedRequester.groupId);
      this.tableOrdersSocketGateway.moveGroupRoom(requesterId, oldGroupId, updatedRequester.groupId);
      this.groupLogger.log(`Demande ${dto.requestId.slice(0, 8)} acceptée par la table ${target.tableNumber} : table ${requester.tableNumber} passe du groupe ${oldGroupId.slice(0, 8)} au groupe ${target.groupId.slice(0, 8)}`);
      this.tableOrdersSocketGateway.emitJoinResult(orderRoom(requesterId), {
        requestId: dto.requestId,
        decision: 'accept',
        groupId: target.groupId
      });
      this.tableOrdersSocketGateway.emitMemberJoined(orderRoom(target._id.toString()), {
        groupId: target.groupId,
        orderId: requesterId,
        tableNumber: requester.tableNumber,
        participants: requester.participants,
        joinedAt: new Date()
      });

      const members = await this.tableOrderModel
          .find({groupId: target.groupId, billed: null});

      const memberDto : GroupMember[] = members.
      map((member) => ({
        tableNumber: member.tableNumber,
        orderId: member._id.toString(),
        participants : member.participants
      }));

      this.groupLogger.log(`Groupe ${target.groupId.slice(0, 8)} : tables ${memberDto.map((member) => member.tableNumber).join(', ')}`);
      this.tableOrdersSocketGateway.emitGroupUpdated(groupRoom(target.groupId), {
        groupId: target.groupId,
        members: memberDto
      });
    }
    else {
      this.groupLogger.log(`Demande ${dto.requestId.slice(0, 8)} refusée par la table ${target.tableNumber} (demandeur : table ${requester.tableNumber})`);
      this.diningSocketsService.deleteJoinRequest(dto.requestId);
      this.tableOrdersSocketGateway.emitJoinResult(orderRoom(requesterId), {
        requestId: dto.requestId,
        decision: 'reject',
        reason: dto.reason
      })
    }
  }

  // The backend owns the score -> reward mapping and picks which lines get discounted
  // (cheapest-first, across every open table order sharing this one's groupId) so a client
  // can never dictate the percent or cherry-pick pricey lines, on this table or anyone else's.
  async claimBonus(tableOrderId: string, claimBonusDto: ClaimBonusDto): Promise<ClaimBonusResultDto> {
    const tableOrder: TableOrder = await this.findOne(tableOrderId);

    this.bonusLogger.log(`Table ${tableOrder.tableNumber} réclame un bonus : score ${claimBonusDto.score}`);

    const tier = rewardForScore(claimBonusDto.score);
    if (tier === null) {
      this.bonusLogger.log(`Score ${claimBonusDto.score} insuffisant pour la table ${tableOrder.tableNumber} : aucune récompense`);
      return { tier: null, affected: [] };
    }

    if (tableOrder.billed !== null) {
      throw new TableOrderAlreadyBilledException(tableOrder);
    }

    const groupOrders = tableOrder.groupId
        ? await this.findOpenTableOrdersInGroup(tableOrder.groupId)
        : [tableOrder];

    this.bonusLogger.log(`Palier atteint pour la table ${tableOrder.tableNumber} : ${tier.discountPercent}% sur ${tier.lineCount} ligne(s), pool de ${groupOrders.length} table(s) (groupe ${tableOrder.groupId ? tableOrder.groupId.slice(0, 8) : 'solo'})`);

    type PoolEntry = { tableOrderId: string; tableNumber: number; lineId: string; price: number };
    const pool: PoolEntry[] = groupOrders.flatMap((order) => {
      const alreadyDiscountedLineIds = new Set((order.discounts ?? []).flatMap((grant) => grant.lineIds));
      return (order.lines ?? [])
          .filter((line) => !line.paid && !alreadyDiscountedLineIds.has(line._id?.toString()))
          .map((line) => ({
            tableOrderId: order._id.toString(),
            tableNumber: order.tableNumber,
            lineId: line._id?.toString(),
            price: line.price * line.howMany,
          }));
    });

    const selected = pool.sort((a, b) => a.price - b.price).slice(0, tier.lineCount);

    const selectedByOwner = new Map<string, { tableNumber: number; lineIds: string[] }>();
    for (const entry of selected) {
      const owner = selectedByOwner.get(entry.tableOrderId) ?? { tableNumber: entry.tableNumber, lineIds: [] };
      owner.lineIds.push(entry.lineId);
      selectedByOwner.set(entry.tableOrderId, owner);
    }

    const affected: AffectedTableOrderDto[] = [];
    for (const [ownerId, owner] of selectedByOwner) {
      await this.applyDiscount(ownerId, { percent: tier.discountPercent, lineIds: owner.lineIds });
      affected.push({ tableOrderId: ownerId, tableNumber: owner.tableNumber, lineIds: owner.lineIds, percent: tier.discountPercent });
    }

    this.bonusLogger.log(`Bonus de la table ${tableOrder.tableNumber} (score ${claimBonusDto.score}) réparti sur : ${affected.length > 0 ? affected.map((a) => `table ${a.tableNumber} (${a.lineIds.length} ligne(s))`).join(', ') : 'aucune ligne éligible'}`);

    return { tier, affected };
  }
}
