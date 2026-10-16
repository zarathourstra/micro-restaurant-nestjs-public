import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'dining',
})
export class TableOrdersSocketGateway {
  @WebSocketServer()
  server: Server;

  // Client -> server: origin accepts or rejects a join request
  @SubscribeMessage('table-group.join-response')
  handleJoinResponse(
    @MessageBody() data: {
      requestId: string;
      decision: 'accept' | 'reject';
    },
    @ConnectedSocket() client: Socket,
  ) {
    // TODO: authenticate/authorize origin
    // TODO: validate request and decision
    // TODO: persist the decision through a service
    // TODO: notify requester with table-group.join-result
  }

  // Server -> origin: a table requests to join its group
  emitJoinRequested(
    originRoom: string,
    data: {
      requestId: string;
      requestingTableNumber: number;
      customersCount: number;
      participants: { name: string }[];
      expiresAt: Date;
    },
  ) {
    this.server.to(originRoom).emit(
      'table-group.join-requested',
      data,
    );
  }

  // Server -> requester: join request was accepted or rejected
  emitJoinResult(
    requesterRoom: string,
    data: {
      requestId: string;
      decision: 'accept' | 'reject';
      groupId?: string;
      reason?: string;
    },
  ) {
    this.server.to(requesterRoom).emit(
      'table-group.join-result',
      data,
    );
  }

  // Server -> origin: a member order has been created successfully
  emitMemberJoined(
    originRoom: string,
    data: {
      groupId: string;
      orderId: string;
      tableNumber: number;
      participants: { name: string }[];
      joinedAt: Date;
    },
  ) {
    this.server.to(originRoom).emit(
      'table-group.member-joined',
      data,
    );
  }

  // Server -> group members: group membership has changed
  emitGroupUpdated(
    groupRoom: string,
    data: {
      groupId: string;
      members: {
        tableNumber: number;
        orderId: string;
        participants: { name: string }[];
      }[];
    },
  ) {
    this.server.to(groupRoom).emit(
      'table-group.updated',
      data,
    );
  }
}