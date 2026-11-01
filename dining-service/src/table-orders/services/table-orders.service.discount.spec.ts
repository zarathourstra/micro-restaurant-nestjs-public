import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TableOrdersService } from './table-orders.service';
import { MenuProxyService } from './menu-proxy.service';
import { KitchenProxyService } from './kitchen-proxy.service';
import { TablesService } from '../../tables/services/tables.service';
import { DiningSocketsService } from './dining-sockets.service';
import { TableOrdersSocketGateway } from '../controllers/table-orders.socket.gateway';

import { TableOrder } from '../schemas/table-order.schema';
import { OrderingLine } from '../schemas/ordering-line.schema';

import { TableOrderAlreadyBilledException } from '../exceptions/table-order-already-billed.exception';
import { TableOrderLineNotFoundException } from '../exceptions/table-order-line-not-found.exception';
import { TableOrderLineAlreadyDiscountedException } from '../exceptions/table-order-line-already-discounted.exception';
import { rewardForScore } from '../constants/reward-tiers';

describe('TableOrdersService - discount & totals', () => {
  let service: TableOrdersService;
  let model: Model<TableOrder>;

  const makeLine = (overrides: Partial<OrderingLine> = {}): OrderingLine => ({
    _id: 'line id',
    item: { _id: 'menu item id', shortName: 'edamame' },
    howMany: 1,
    price: 5,
    sentForPreparation: true,
    paid: false,
    orderer: 'Alice',
    receiver: 'Alice',
    receiverTableNumber: 12,
    ...overrides,
  });

  const makeTableOrder = (overrides: Partial<TableOrder> = {}): TableOrder => ({
    _id: 'table order id',
    tableNumber: 12,
    customersCount: 4,
    participants: [{ name: 'Alice' }],
    opened: new Date(),
    lines: [],
    preparations: [],
    billed: null,
    discounts: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableOrdersService,
        {
          provide: getModelToken('TableOrder'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            create: jest.fn(),
          },
        },
        { provide: TablesService, useValue: { takeTable: jest.fn(), releaseTable: jest.fn() } },
        { provide: MenuProxyService, useValue: { findByShortName: jest.fn(), getPrice: jest.fn() } },
        { provide: KitchenProxyService, useValue: { sendItemsToCook: jest.fn() } },
        { provide: DiningSocketsService, useValue: { generateGroupId: jest.fn(), registerOriginOrder: jest.fn(), moveOrderToGroup: jest.fn(), createJoinRequest: jest.fn(), getJoinRequest: jest.fn(), deleteJoinRequest: jest.fn() } },
        { provide: TableOrdersSocketGateway, useValue: { emitJoinRequested: jest.fn(), emitJoinResult: jest.fn(), emitMemberJoined: jest.fn(), emitGroupUpdated: jest.fn() } },
      ],
    }).compile();

    service = module.get<TableOrdersService>(TableOrdersService);
    model = module.get<Model<TableOrder>>(getModelToken('TableOrder'));
  });

  function mockFindOne(tableOrder: TableOrder): void {
    jest.spyOn(model, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValueOnce(tableOrder),
    } as any);
  }

  function mockUpdateReturns(tableOrder: TableOrder): void {
    jest.spyOn(model, 'findByIdAndUpdate').mockResolvedValueOnce(tableOrder as any);
  }

  function mockFindOneRepeatedly(tableOrder: TableOrder): void {
    jest.spyOn(model, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(tableOrder),
    } as any);
  }

  // Each findByIdAndUpdate call returns the matching entry from this map (keyed by _id),
  // so a test can simulate several table orders being updated independently in one claimBonus call.
  function mockUpdatesByTableOrderId(tableOrdersById: Record<string, TableOrder>): void {
    jest.spyOn(model, 'findByIdAndUpdate').mockImplementation(((id: string) => Promise.resolve(tableOrdersById[id] as any)) as any);
  }

  // applyDiscount re-fetches its target via findOne(id) - this resolves each by id instead of
  // always returning the same object, needed once more than one table order is in play per test.
  function mockFindOneByTableOrderId(tableOrdersById: Record<string, TableOrder>): void {
    jest.spyOn(model, 'findOne').mockImplementation(((filter: { _id: string }) => ({
      lean: jest.fn().mockResolvedValue(tableOrdersById[filter._id] ?? null),
    })) as any);
  }

  describe('computeTotals (via findOne)', () => {
    it('computes subtotal/discountAmount/total with no discount', async () => {
      const tableOrder = makeTableOrder({
        lines: [makeLine({ price: 5, howMany: 2 }), makeLine({ _id: 'line 2', price: 3, howMany: 1 })],
      });
      mockFindOne(tableOrder);

      const result = await service.findOne('table order id');

      expect(result.totals).toEqual({ subtotal: 13, discountAmount: 0, total: 13 });
    });

    it('applies a discount scoped to a single line only', async () => {
      const tableOrder = makeTableOrder({
        lines: [
          makeLine({ _id: 'line 1', price: 10, howMany: 1 }),
          makeLine({ _id: 'line 2', price: 5, howMany: 2 }),
        ],
        discounts: [{ percent: 100, lineIds: ['line 1'] }],
      });
      mockFindOne(tableOrder);

      const result = await service.findOne('table order id');

      // subtotal = 10 + 10 = 20; only line 1 (10) is 100% discounted -> discountAmount = 10
      expect(result.totals).toEqual({ subtotal: 20, discountAmount: 10, total: 10 });
    });

    it('applies a discount scoped to several lines', async () => {
      const tableOrder = makeTableOrder({
        lines: [
          makeLine({ _id: 'line 1', price: 10, howMany: 1 }),
          makeLine({ _id: 'line 2', price: 5, howMany: 2 }),
          makeLine({ _id: 'line 3', price: 3, howMany: 1 }),
        ],
        discounts: [{ percent: 10, lineIds: ['line 1', 'line 2'] }],
      });
      mockFindOne(tableOrder);

      const result = await service.findOne('table order id');

      // subtotal = 10 + 10 + 3 = 23; discount base = line 1 (10) + line 2 (10) = 20 -> discountAmount = 2
      expect(result.totals).toEqual({ subtotal: 23, discountAmount: 2, total: 21 });
    });

    it('sums several independent grants at their own percent, never stacking on the same line', async () => {
      const tableOrder = makeTableOrder({
        lines: [
          makeLine({ _id: 'line 1', price: 10, howMany: 1 }),
          makeLine({ _id: 'line 2', price: 20, howMany: 1 }),
          makeLine({ _id: 'line 3', price: 3, howMany: 1 }),
        ],
        discounts: [
          { percent: 100, lineIds: ['line 1'] },
          { percent: 10, lineIds: ['line 2'] },
        ],
      });
      mockFindOne(tableOrder);

      const result = await service.findOne('table order id');

      // subtotal = 10 + 20 + 3 = 33; grant 1 = 10 (100% of 10); grant 2 = 2 (10% of 20) -> discountAmount = 12
      expect(result.totals).toEqual({ subtotal: 33, discountAmount: 12, total: 21 });
    });
  });

  describe('applyDiscount', () => {
    it('sets a single-line discount (free dish at 100%)', async () => {
      const line = makeLine({ _id: 'line 1', price: 7, howMany: 1 });
      const tableOrder = makeTableOrder({ lines: [line] });
      mockFindOne(tableOrder);
      mockUpdateReturns({ ...tableOrder, discounts: [{ percent: 100, lineIds: ['line 1'] }] });

      const result = await service.applyDiscount('table order id', { percent: 100, lineIds: ['line 1'] });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'table order id',
        expect.objectContaining({ discounts: [{ percent: 100, lineIds: ['line 1'] }] }),
        { returnDocument: 'after' },
      );
      expect(result.totals).toEqual({ subtotal: 7, discountAmount: 7, total: 0 });
    });

    it('sets a discount scoped to several lines and persists it', async () => {
      const tableOrder = makeTableOrder({
        lines: [makeLine({ _id: 'line 1', price: 10, howMany: 1 }), makeLine({ _id: 'line 2', price: 5, howMany: 1 })],
      });
      mockFindOne(tableOrder);
      mockUpdateReturns({ ...tableOrder, discounts: [{ percent: 15, lineIds: ['line 1', 'line 2'] }] });

      const result = await service.applyDiscount('table order id', { percent: 15, lineIds: ['line 1', 'line 2'] });

      expect(result.totals).toEqual({ subtotal: 15, discountAmount: 2.25, total: 12.75 });
    });

    it('appends a second, independent grant instead of overwriting the first', async () => {
      const tableOrder = makeTableOrder({
        lines: [makeLine({ _id: 'line 1', price: 10, howMany: 1 }), makeLine({ _id: 'line 2', price: 5, howMany: 1 })],
        discounts: [{ percent: 15, lineIds: ['line 1'] }],
      });
      mockFindOne(tableOrder);
      mockUpdateReturns({
        ...tableOrder,
        discounts: [{ percent: 15, lineIds: ['line 1'] }, { percent: 5, lineIds: ['line 2'] }],
      });

      await service.applyDiscount('table order id', { percent: 5, lineIds: ['line 2'] });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'table order id',
        expect.objectContaining({
          discounts: [{ percent: 15, lineIds: ['line 1'] }, { percent: 5, lineIds: ['line 2'] }],
        }),
        { returnDocument: 'after' },
      );
    });

    it('rejects a lineId that already belongs to an existing grant', async () => {
      const tableOrder = makeTableOrder({
        lines: [makeLine({ _id: 'line 1', price: 10, howMany: 1 })],
        discounts: [{ percent: 15, lineIds: ['line 1'] }],
      });
      mockFindOne(tableOrder);

      await expect(service.applyDiscount('table order id', { percent: 5, lineIds: ['line 1'] }))
        .rejects.toThrow(TableOrderLineAlreadyDiscountedException);
    });

    it('rejects an unknown lineId', async () => {
      const tableOrder = makeTableOrder({ lines: [makeLine({ _id: 'line 1' })] });
      mockFindOne(tableOrder);

      await expect(service.applyDiscount('table order id', { percent: 50, lineIds: ['does-not-exist'] }))
        .rejects.toThrow(TableOrderLineNotFoundException);
    });

    it('rejects applying a discount to an already-billed order', async () => {
      const tableOrder = makeTableOrder({ billed: new Date() });
      mockFindOne(tableOrder);

      await expect(service.applyDiscount('table order id', { percent: 10, lineIds: [] }))
        .rejects.toThrow(TableOrderAlreadyBilledException);
    });
  });

  describe('rewardForScore', () => {
    it('maps winning scores to the right tier', () => {
      expect(rewardForScore(24)).toEqual({ minScore: 24, discountPercent: 15, lineCount: 3 });
      expect(rewardForScore(18)).toEqual({ minScore: 18, discountPercent: 10, lineCount: 2 });
      expect(rewardForScore(12)).toEqual({ minScore: 12, discountPercent: 5, lineCount: 1 });
    });

    it('returns null below the lowest threshold', () => {
      expect(rewardForScore(11)).toBeNull();
      expect(rewardForScore(0)).toBeNull();
    });
  });

  describe('claimBonus - solo table (no group)', () => {
    it('discounts exactly the N cheapest unpaid lines for a winning score, ignoring already-paid ones', async () => {
      const tableOrder = makeTableOrder({
        lines: [
          makeLine({ _id: 'line A', price: 10, howMany: 1 }),
          makeLine({ _id: 'line B', price: 2, howMany: 1 }),
          makeLine({ _id: 'line C', price: 5, howMany: 1 }),
          makeLine({ _id: 'line D', price: 1, howMany: 1 }),
          makeLine({ _id: 'line E', price: 0.5, howMany: 1, paid: true }),
        ],
      });
      mockFindOneRepeatedly(tableOrder);
      mockUpdateReturns({ ...tableOrder, discounts: [{ percent: 10, lineIds: ['line D', 'line B'] }] });

      const result = await service.claimBonus('table order id', { score: 18 });

      // tier for score 18 is 10% off the 2 cheapest unpaid lines -> D (1) and B (2), never the paid E (0.5)
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'table order id',
        expect.objectContaining({ discounts: [{ percent: 10, lineIds: ['line D', 'line B'] }] }),
        { returnDocument: 'after' },
      );
      expect(result.tier).toEqual({ minScore: 18, discountPercent: 10, lineCount: 2 });
      expect(result.affected).toEqual([{ tableOrderId: 'table order id', tableNumber: 12, lineIds: ['line D', 'line B'], percent: 10 }]);
    });

    it('never selects a line already covered by an earlier grant', async () => {
      const tableOrder = makeTableOrder({
        lines: [
          makeLine({ _id: 'line A', price: 1, howMany: 1 }),
          makeLine({ _id: 'line B', price: 2, howMany: 1 }),
        ],
        discounts: [{ percent: 5, lineIds: ['line A'] }],
      });
      mockFindOneRepeatedly(tableOrder);
      mockUpdateReturns({ ...tableOrder, discounts: [{ percent: 5, lineIds: ['line A'] }, { percent: 5, lineIds: ['line B'] }] });

      const result = await service.claimBonus('table order id', { score: 12 });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'table order id',
        expect.objectContaining({ discounts: [{ percent: 5, lineIds: ['line A'] }, { percent: 5, lineIds: ['line B'] }] }),
        { returnDocument: 'after' },
      );
      expect(result.affected).toEqual([{ tableOrderId: 'table order id', tableNumber: 12, lineIds: ['line B'], percent: 5 }]);
    });

    it('leaves the table order unchanged on a losing score', async () => {
      const tableOrder = makeTableOrder({
        lines: [makeLine({ _id: 'line A', price: 10, howMany: 1 })],
        discounts: [{ percent: 5, lineIds: ['line A'] }],
      });
      mockFindOneRepeatedly(tableOrder);
      const updateSpy = jest.spyOn(model, 'findByIdAndUpdate');

      const result = await service.claimBonus('table order id', { score: 5 });

      expect(updateSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ tier: null, affected: [] });
    });

    it('rejects claiming a bonus on an already-billed order', async () => {
      const tableOrder = makeTableOrder({ billed: new Date() });
      mockFindOneRepeatedly(tableOrder);

      await expect(service.claimBonus('table order id', { score: 24 }))
        .rejects.toThrow(TableOrderAlreadyBilledException);
    });
  });

  describe('claimBonus - grouped tables', () => {
    it('spans the cheapest unpaid lines across every open table order in the group', async () => {
      const actingTable = makeTableOrder({
        _id: 'table A',
        tableNumber: 1,
        groupId: 'group-1',
        lines: [makeLine({ _id: 'line A1', price: 10, howMany: 1 })],
      });
      const siblingTable = makeTableOrder({
        _id: 'table B',
        tableNumber: 2,
        groupId: 'group-1',
        lines: [
          makeLine({ _id: 'line B1', price: 1, howMany: 1 }),
          makeLine({ _id: 'line B2', price: 2, howMany: 1 }),
        ],
      });
      mockFindOneByTableOrderId({ 'table A': actingTable, 'table B': siblingTable });
      jest.spyOn(model, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([actingTable, siblingTable]) } as any);
      mockUpdatesByTableOrderId({
        'table A': { ...actingTable, discounts: [] },
        'table B': { ...siblingTable, discounts: [{ percent: 10, lineIds: ['line B1', 'line B2'] }] },
      });

      // Tier for score 18 is 10% off 2 lines; the 2 cheapest across the whole group are B1 (1) and B2 (2) - A1 (10) is skipped.
      const result = await service.claimBonus('table A', { score: 18 });

      expect(model.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'table B',
        expect.objectContaining({ discounts: [{ percent: 10, lineIds: ['line B1', 'line B2'] }] }),
        { returnDocument: 'after' },
      );
      expect(result.affected).toEqual([{ tableOrderId: 'table B', tableNumber: 2, lineIds: ['line B1', 'line B2'], percent: 10 }]);
    });

    it('splits the selection across several table orders when the cheapest lines are spread out', async () => {
      const actingTable = makeTableOrder({
        _id: 'table A',
        tableNumber: 1,
        groupId: 'group-1',
        lines: [makeLine({ _id: 'line A1', price: 1, howMany: 1 })],
      });
      const siblingTable = makeTableOrder({
        _id: 'table B',
        tableNumber: 2,
        groupId: 'group-1',
        lines: [makeLine({ _id: 'line B1', price: 2, howMany: 1 })],
      });
      mockFindOneByTableOrderId({ 'table A': actingTable, 'table B': siblingTable });
      jest.spyOn(model, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([actingTable, siblingTable]) } as any);
      mockUpdatesByTableOrderId({
        'table A': { ...actingTable, discounts: [{ percent: 10, lineIds: ['line A1'] }] },
        'table B': { ...siblingTable, discounts: [{ percent: 10, lineIds: ['line B1'] }] },
      });

      const result = await service.claimBonus('table A', { score: 18 });

      expect(model.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(result.affected).toEqual(
        expect.arrayContaining([
          { tableOrderId: 'table A', tableNumber: 1, lineIds: ['line A1'], percent: 10 },
          { tableOrderId: 'table B', tableNumber: 2, lineIds: ['line B1'], percent: 10 },
        ]),
      );
    });

    it('does not erase an earlier independent grant on a table shared by two different wins', async () => {
      // Table A already has a grant from an earlier win (its own, or routed there by another table's win).
      const actingTable = makeTableOrder({
        _id: 'table A',
        tableNumber: 1,
        groupId: 'group-1',
        lines: [
          makeLine({ _id: 'line A1', price: 1, howMany: 1 }),
          makeLine({ _id: 'line A2', price: 2, howMany: 1 }),
          makeLine({ _id: 'line A3', price: 3, howMany: 1 }),
        ],
        discounts: [{ percent: 15, lineIds: ['line A1'] }],
      });
      mockFindOneByTableOrderId({ 'table A': actingTable });
      jest.spyOn(model, 'find').mockReturnValue({ lean: jest.fn().mockResolvedValue([actingTable]) } as any);
      mockUpdatesByTableOrderId({
        'table A': {
          ...actingTable,
          discounts: [{ percent: 15, lineIds: ['line A1'] }, { percent: 5, lineIds: ['line A2'] }],
        },
      });

      // Score 12 -> tier of 1 line; line A1 is already granted, so the cheapest *eligible* line is A2, not A1.
      const result = await service.claimBonus('table A', { score: 12 });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'table A',
        expect.objectContaining({
          discounts: [{ percent: 15, lineIds: ['line A1'] }, { percent: 5, lineIds: ['line A2'] }],
        }),
        { returnDocument: 'after' },
      );
      expect(result.affected).toEqual([{ tableOrderId: 'table A', tableNumber: 1, lineIds: ['line A2'], percent: 5 }]);
    });
  });
});
