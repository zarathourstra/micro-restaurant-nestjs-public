import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiUnprocessableEntityResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTags, ApiOkResponse, ApiParam, ApiQuery,
} from '@nestjs/swagger';

import { StartOrderingDto } from '../dto/start-ordering.dto';
import { AddMenuItemDto } from '../dto/add-menu-item.dto';
import { PayOrderingLinesDto } from '../dto/pay-ordering-lines.dto';
import { ApplyDiscountDto } from '../dto/apply-discount.dto';

import { GroupMemberDto } from '../dto/group-member.dto';

import { GetTableOrderParams } from '../params/get-table-order.params';
import { GetGroupParams } from '../params/get-group.params';
import { GroupNotFoundException } from '../exceptions/group-not-found.exception';

import { TableOrder } from '../schemas/table-order.schema';

import { TableOrderIdNotFoundException } from '../exceptions/table-order-id-not-found.exception';
import { TableAlreadyTakenException } from '../../tables/exceptions/table-already-taken.exception';
import { TableNumberNotFoundException } from '../../tables/exceptions/table-number-not-found.exception';

import { TableOrdersService } from '../services/table-orders.service';
import { AddMenuItemDtoNotFoundException } from '../exceptions/add-menu-item-dto-not-found.exception';
import { TableOrderAlreadyBilledException } from '../exceptions/table-order-already-billed.exception';
import { TableOrderLinesNotPayableException } from '../exceptions/table-order-lines-not-payable.exception';
import { TableOrderNotFullyPaidException } from '../exceptions/table-order-not-fully-paid.exception';
import { TableOrderLineNotFoundException } from '../exceptions/table-order-line-not-found.exception';
import { PreparationDto } from '../dto/preparation.dto';

@ApiTags('tableOrders')
@Controller('/tableOrders')
export class TableOrdersController {
  constructor(private readonly tableOrdersService: TableOrdersService) {}

  @ApiOkResponse({ type: TableOrder, isArray: true })
  @ApiQuery({ name: 'billed', required: false, type: Boolean, description: 'false: only open table orders, true: only billed ones, omitted: all' })
  @Get()
  async listAllTableOrders(@Query('billed') billed?: string): Promise<TableOrder[]> {
    return this.tableOrdersService.findAll(billed === undefined ? undefined : billed === 'true');
  }

  @ApiBody({ type: StartOrderingDto })
  @ApiCreatedResponse({ type: TableOrder, description: 'The table has been successfully opened.' })
  @ApiNotFoundResponse({ type: TableNumberNotFoundException, description: 'Table not found' })
  @ApiUnprocessableEntityResponse({ type: TableAlreadyTakenException, description: 'Table is already taken' })
  @Post()
  async openTable(@Body() startOrderingDto: StartOrderingDto): Promise<TableOrder> {
    return await this.tableOrdersService.startOrdering(startOrderingDto);
  }

  @ApiParam({ name: 'groupId' })
  @ApiOkResponse({ type: GroupMemberDto, isArray: true, description: 'Open tables of the group with their participants.' })
  @ApiNotFoundResponse({ type: GroupNotFoundException, description: 'Group not found' })
  @Get('groups/:groupId')
  async getGroupMembers(@Param() getGroupParams: GetGroupParams): Promise<GroupMemberDto[]> {
    return this.tableOrdersService.findGroupMembers(getGroupParams.groupId);
  }

  @ApiParam({ name: 'tableOrderId' })
  @ApiOkResponse({ type: TableOrder })
  @ApiNotFoundResponse({ type: TableOrderIdNotFoundException, description: 'Table order not found' })
  @Get(':tableOrderId')
  async getTableOrderById(@Param() getTableOrderParams: GetTableOrderParams): Promise<TableOrder> {
    return this.tableOrdersService.findOne(getTableOrderParams.tableOrderId);
  }

  @ApiParam({ name: 'tableOrderId' })
  @ApiBody({ type: AddMenuItemDto })
  @ApiCreatedResponse({ type: TableOrder, description: 'The menu item has been successfully added to the table order.' })
  @ApiNotFoundResponse({ type: TableOrderIdNotFoundException, description: 'Table order not found' })
  @ApiNotFoundResponse({ type: AddMenuItemDtoNotFoundException, description: 'Inconsistent AddMenuItemDto with the MenuServiceProxy' })
  @ApiUnprocessableEntityResponse({ type: TableOrderAlreadyBilledException, description: 'TableOrder is already billed' })
  @Post(':tableOrderId')
  async addMenuItemToTableOrder(@Param() getTableOrderParams: GetTableOrderParams, @Body() addMenuItemDto: AddMenuItemDto): Promise<TableOrder> {
    return this.tableOrdersService.addOrderingLineToTableOrder(getTableOrderParams.tableOrderId, addMenuItemDto);
  }

  @ApiParam({ name: 'tableOrderId' })
  @ApiCreatedResponse({ type: PreparationDto, isArray: true, description: 'The menu items have been successfully sent for preparation.' })
  @ApiNotFoundResponse({ type: TableOrderIdNotFoundException, description: 'Table order not found' })
  @ApiUnprocessableEntityResponse({ type: TableOrderAlreadyBilledException, description: 'TableOrder is already billed' })
  @Post(':tableOrderId/prepare')
  async prepareTableOrder(@Param() getTableOrderParams: GetTableOrderParams): Promise<PreparationDto[]> {
    return this.tableOrdersService.sendItemsForPreparation(getTableOrderParams.tableOrderId);
  }

  @ApiParam({ name: 'tableOrderId' })
  @ApiBody({ type: PayOrderingLinesDto })
  @ApiOkResponse({ type: TableOrder, description: 'The selected ordering lines have been paid.' })
  @ApiNotFoundResponse({ type: TableOrderIdNotFoundException, description: 'Table order not found' })
  @ApiUnprocessableEntityResponse({ type: TableOrderAlreadyBilledException, description: 'TableOrder is already closed' })
  @ApiUnprocessableEntityResponse({ type: TableOrderLinesNotPayableException, description: 'One or more lines cannot be paid' })
  @HttpCode(200)
  @Post(':tableOrderId/payments')
  async payTableOrderLines(@Param() getTableOrderParams: GetTableOrderParams, @Body() payOrderingLinesDto: PayOrderingLinesDto,): Promise<TableOrder> {
    return this.tableOrdersService.payLines(getTableOrderParams.tableOrderId, payOrderingLinesDto);
  }

  @ApiParam({ name: 'tableOrderId' })
  @ApiOkResponse({ type: TableOrder, description: 'The table has been successfully closed.' })
  @ApiNotFoundResponse({ type: TableOrderIdNotFoundException, description: 'Table order not found' })
  @ApiUnprocessableEntityResponse({ type: TableOrderAlreadyBilledException, description: 'TableOrder is already closed' })
  @ApiUnprocessableEntityResponse({ type: TableOrderNotFullyPaidException, description: 'TableOrder still has unpaid lines' })
  @HttpCode(200)
  @Post(':tableOrderId/close')
  async closeTableOrder(@Param() getTableOrderParams: GetTableOrderParams): Promise<TableOrder> {
    return this.tableOrdersService.closeOrder(getTableOrderParams.tableOrderId);
  }

  @ApiParam({ name: 'tableOrderId' })
  @ApiBody({ type: ApplyDiscountDto })
  @ApiOkResponse({ type: TableOrder, description: 'The discount has been applied to the selected ordering lines.' })
  @ApiNotFoundResponse({ type: TableOrderIdNotFoundException, description: 'Table order not found' })
  @ApiUnprocessableEntityResponse({ type: TableOrderAlreadyBilledException, description: 'TableOrder is already closed' })
  @ApiUnprocessableEntityResponse({ type: TableOrderLineNotFoundException, description: 'A lineId does not match any line on the table order' })
  @HttpCode(200)
  @Post(':tableOrderId/discount')
  async applyDiscount(@Param() getTableOrderParams: GetTableOrderParams, @Body() applyDiscountDto: ApplyDiscountDto): Promise<TableOrder> {
    return this.tableOrdersService.applyDiscount(getTableOrderParams.tableOrderId, applyDiscountDto);
  }

  @ApiParam({ name: 'tableOrderId' })
  @ApiCreatedResponse({ description: 'A single-use group join key has been generated.', schema: { properties: { groupJoinKey: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' } } } })
  @ApiNotFoundResponse({ type: TableOrderIdNotFoundException, description: 'Table order not found' })
  @ApiUnprocessableEntityResponse({ type: TableOrderAlreadyBilledException, description: 'TableOrder is already billed' })
  @Post(':tableOrderId/group-join-key')
  async createGroupJoinKey(@Param() getTableOrderParams: GetTableOrderParams): Promise<{ groupJoinKey: string; expiresAt: Date }> {
    return this.tableOrdersService.createGroupJoinKey(getTableOrderParams.tableOrderId);
  }
}
