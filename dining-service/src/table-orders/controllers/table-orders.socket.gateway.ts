import {WebSocketGateway, WebSocketServer, OnGatewayConnection} from '@nestjs/websockets';
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

export const orderRoom = (tableOrderId: string): string => `order:${tableOrderId}`;
export const groupRoom = (groupId: string): string => `group:${groupId}`;

@WebSocketGateway({
  namespace: 'dining',
  cors: { origin: true },
})
export class TableOrdersSocketGateway implements OnGatewayConnection {
  constructor(
      private readonly diningSocketsService : DiningSocketsService,
  ) {}

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const context = this.diningSocketsService.validateKey(client.handshake.auth?.key);

    if (!context) {
      client.disconnect();
      return;
    }

    client.data.context = context;
    client.join(orderRoom(context.tableOrderId));
    client.join(groupRoom(context.groupId));
  }

  moveGroupRoom(tableOrderId: string, oldGroupId: string, newGroupId: string) {
    this.server.in(orderRoom(tableOrderId)).socketsLeave(groupRoom(oldGroupId));
    this.server.in(orderRoom(tableOrderId)).socketsJoin(groupRoom(newGroupId));
  }

  emitJoinRequested(originRoom: string, data: JoinRequestedData) {
    this.server.to(originRoom).emit(
      'table-group.join-requested',
      data,
    );
  }

  emitJoinResult(requesterRoom: string, data: JoinResultData) {
    this.server.to(requesterRoom).emit(
      'table-group.join-result',
      data,
    );
  }

  emitMemberJoined(originRoom: string, data: MemberJoinedData) {
    this.server.to(originRoom).emit(
      'table-group.member-joined',
      data,
    );
  }

  emitGroupUpdated(groupRoom: string, data: GroupUpdatedData) {
    this.server.to(groupRoom).emit(
      'table-group.updated',
      data,
    );
  }
}
