import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TableOrdersService } from './table-orders.service';
import { MenuProxyService } from './menu-proxy.service';
import { KitchenProxyService } from './kitchen-proxy.service';
import { TablesService } from '../../tables/services/tables.service';

import { TableOrder } from '../schemas/table-order.schema';
import { OrderingLine } from '../schemas/ordering-line.schema';

import { TableOrderAlreadyBilledException } from '../exceptions/table-order-already-billed.exception';
import { TableOrderLineNotFoundException } from '../exceptions/table-order-line-not-found.exception';
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
    ...overrides,
  });

  const makeTableOrder = (overrides: Partial<TableOrder> = {}): TableOrder => ({
    _id: 'table order id',
    tableNumber: 12,
    customersCount: 4,
    opened: new Date(),
    lines: [],
    preparations: [],
    billed: null,
    discountPercent: 0,
    discountLineIds: [],
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
        discountPercent: 100,
        discountLineIds: ['line 1'],
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
        discountPercent: 10,
        discountLineIds: ['line 1', 'line 2'],
      });
      mockFindOne(tableOrder);

      const result = await service.findOne('table order id');

      // subtotal = 10 + 10 + 3 = 23; discount base = line 1 (10) + line 2 (10) = 20 -> discountAmount = 2
      expect(result.totals).toEqual({ subtotal: 23, discountAmount: 2, total: 21 });
    });
  });

  describe('applyDiscount', () => {
    it('sets a single-line discount (free dish at 100%)', async () => {
      const line = makeLine({ _id: 'line 1', price: 7, howMany: 1 });
      const tableOrder = makeTableOrder({ lines: [line] });
      mockFindOne(tableOrder);
      mockUpdateReturns({ ...tableOrder, discountPercent: 100, discountLineIds: ['line 1'] });

      const result = await service.applyDiscount('table order id', { percent: 100, lineIds: ['line 1'] });

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'table order id',
        expect.objectContaining({ discountPercent: 100, discountLineIds: ['line 1'] }),
        { returnDocument: 'after' },
      );
      expect(result.totals).toEqual({ subtotal: 7, discountAmount: 7, total: 0 });
    });

    it('sets a discount scoped to several lines and persists it', async () => {
      const tableOrder = makeTableOrder({
        lines: [makeLine({ _id: 'line 1', price: 10, howMany: 1 }), makeLine({ _id: 'line 2', price: 5, howMany: 1 })],
      });
      mockFindOne(tableOrder);
      mockUpdateReturns({ ...tableOrder, discountPercent: 15, discountLineIds: ['line 1', 'line 2'] });

      const result = await service.applyDiscount('table order id', { percent: 15, lineIds: ['line 1', 'line 2'] });

      expect(result.totals).toEqual({ subtotal: 15, discountAmount: 2.25, total: 12.75 });
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

  describe('claimBonus', () => {
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
      mockUpdateReturns({ ...tableOrder, discountPercent: 10, discountLineIds: ['line D', 'line B'] });

      await service.claimBonus('table order id', { score: 18 });

      // tier for score 18 is 10% off the 2 cheapest unpaid lines -> D (1) and B (2), never the paid E (0.5)
      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        'table order id',
        expect.objectContaining({ discountPercent: 10, discountLineIds: ['line D', 'line B'] }),
        { returnDocument: 'after' },
      );
    });

    it('leaves the table order unchanged on a losing score', async () => {
      const tableOrder = makeTableOrder({
        lines: [makeLine({ _id: 'line A', price: 10, howMany: 1 })],
        discountPercent: 5,
        discountLineIds: ['line A'],
      });
      mockFindOneRepeatedly(tableOrder);
      const updateSpy = jest.spyOn(model, 'findByIdAndUpdate');

      const result = await service.claimBonus('table order id', { score: 5 });

      expect(updateSpy).not.toHaveBeenCalled();
      expect(result.discountPercent).toBe(5);
      expect(result.discountLineIds).toEqual(['line A']);
    });

    it('rejects claiming a bonus on an already-billed order', async () => {
      const tableOrder = makeTableOrder({ billed: new Date() });
      mockFindOneRepeatedly(tableOrder);

      await expect(service.claimBonus('table order id', { score: 24 }))
        .rejects.toThrow(TableOrderAlreadyBilledException);
    });
  });
});
