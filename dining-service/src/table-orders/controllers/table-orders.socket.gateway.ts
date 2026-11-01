import {Logger} from '@nestjs/common';
import {WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect} from '@nestjs/websockets';
import { DiningSocketsService} from "../services/dining-sockets.service";
import { Server, Socket } from 'socket.io';

export interface GroupParticipant {
  name: string;
}

export interface JoinRequestedData {
  requestId: string;
  requestingTableNumber: number;
  customersCount: number;
  participants: GroupParticipant[];
  expiresAt: Date;
}

export interface JoinResultData {
  requestId: string;
  decision: 'accept' | 'reject';
  groupId?: string;
  reason?: string;
}

export interface MemberJoinedData {
  groupId: string;
  orderId: string;
  tableNumber: number;
  participants: GroupParticipant[];
  joinedAt: Date;
}

export interface GroupMember {
  tableNumber: number;
  orderId: string;
  participants: GroupParticipant[];
}

export interface GroupUpdatedData {
  groupId: string;
  members: GroupMember[];
}

export interface GiftItemData {
  shortName: string;
  howMany: number;
  receiver: string;
}

export interface GiftReceivedData {
  fromTableNumber: number;
  items: GiftItemData[];
}

export const orderRoom = (tableOrderId: string): string => `order:${tableOrderId}`;
export const groupRoom = (groupId: string): string => `group:${groupId}`;

@WebSocketGateway({
  namespace: 'dining',
  cors: { origin: true },
})
export class TableOrdersSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('Groupe');
  private readonly giftLogger = new Logger('Cadeau');

  constructor(
      private readonly diningSocketsService : DiningSocketsService,
  ) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const context = this.diningSocketsService.validateKey(client.handshake.auth?.key);

    if (!context) {
      this.logger.warn(`Socket ${client.id.slice(0, 6)} refusée : clé invalide`);
      client.disconnect();
      return;
    }

    client.data.context = context;
    client.join(orderRoom(context.tableOrderId));
    client.join(groupRoom(context.groupId));
    this.logger.log(`Socket ${client.id.slice(0, 6)} connectée : ${orderRoom(context.tableOrderId)} + ${groupRoom(context.groupId.slice(0, 8))} (${context.role})`);
  }

  handleDisconnect(client: Socket) {
    if (client.data.context) {
      this.logger.log(`Socket ${client.id.slice(0, 6)} déconnectée : ${orderRoom(client.data.context.tableOrderId)}`);
    }
  }

  moveGroupRoom(tableOrderId: string, oldGroupId: string, newGroupId: string) {
    this.logger.log(`Sockets de ${orderRoom(tableOrderId)} : ${groupRoom(oldGroupId.slice(0, 8))} -> ${groupRoom(newGroupId.slice(0, 8))}`);
    this.server.in(orderRoom(tableOrderId)).socketsLeave(groupRoom(oldGroupId));
    this.server.in(orderRoom(tableOrderId)).socketsJoin(groupRoom(newGroupId));
  }

  emitJoinRequested(originRoom: string, data: JoinRequestedData) {
    this.logger.log(`Émis table-group.join-requested -> ${originRoom} (demande ${data.requestId.slice(0, 8)}, table ${data.requestingTableNumber})`);
    this.server.to(originRoom).emit(
      'table-group.join-requested',
      data,
    );
  }

  emitJoinResult(requesterRoom: string, data: JoinResultData) {
    this.logger.log(`Émis table-group.join-result -> ${requesterRoom} (${data.decision})`);
    this.server.to(requesterRoom).emit(
      'table-group.join-result',
      data,
    );
  }

  emitMemberJoined(originRoom: string, data: MemberJoinedData) {
    this.logger.log(`Émis table-group.member-joined -> ${originRoom} (table ${data.tableNumber})`);
    this.server.to(originRoom).emit(
      'table-group.member-joined',
      data,
    );
  }

  emitGroupUpdated(groupRoom: string, data: GroupUpdatedData) {
    this.logger.log(`Émis table-group.updated -> ${groupRoom.slice(0, 14)} (${data.members.length} tables)`);
    this.server.to(groupRoom).emit(
      'table-group.updated',
      data,
    );
  }

  emitGiftReceived(receiverRoom: string, data: GiftReceivedData) {
    this.giftLogger.log(`Émis table-gift.received -> ${receiverRoom} (${data.items.length} plat(s) de la table ${data.fromTableNumber})`);
    this.server.to(receiverRoom).emit(
      'table-gift.received',
      data,
    );
  }
}
