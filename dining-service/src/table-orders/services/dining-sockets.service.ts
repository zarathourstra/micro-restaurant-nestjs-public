import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';

import { JoinRequestAlreadyPendingException } from '../exceptions/join-request-already-pending.exception';

export type TableOrderGroupRole = 'origin' | 'member';

export interface OrderSocketContext {
  tableOrderId: string;
  groupId: string;
  role: TableOrderGroupRole;
}

export interface PendingJoinRequest {
  requestId: string;
  groupId: string;
  originTableOrderId: string;
  memberTableOrderId: string;
  expiresAt: Date;
}

@Injectable()
export class DiningSocketsService {
  // Hash -> authenticated order context
  private readonly keys = new Map<string, OrderSocketContext>();

  // Order ID -> key hash
  private readonly orderKeys = new Map<string, string>();
  private readonly pendingJoinRequests = new Map<string, PendingJoinRequest>();

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  generateKey(): string {
    return randomBytes(32).toString('hex');
  }

  createJoinRequest(originTableOrderId: string, memberTableOrderId: string, groupId: string): PendingJoinRequest {
    //purge ce qui est déjà expiré dans la map de requests
    const now = new Date();
    for (const [id, request] of this.pendingJoinRequests) {
      if (request.expiresAt <= now) {
        this.pendingJoinRequests.delete(id);
      }
    }
    const alreadyPending = Array.from(this.pendingJoinRequests.values()).some(
        (request) =>
            request.memberTableOrderId === memberTableOrderId &&
            request.originTableOrderId === originTableOrderId,
    );
    if(alreadyPending) {
      throw new JoinRequestAlreadyPendingException();
    }
    const requestId = randomBytes(16).toString('hex');
    const JOIN_REQUEST_TTL_MS = 2 * 60 * 1000;
    const expiresAt = new Date(Date.now() + JOIN_REQUEST_TTL_MS);
    const request : PendingJoinRequest = {requestId, groupId, originTableOrderId, memberTableOrderId, expiresAt };
    this.pendingJoinRequests.set(requestId, request);
    return request;
  }

  getJoinRequest(requestId: string): PendingJoinRequest | undefined {
    const request = this.pendingJoinRequests.get(requestId);
    if (request && request.expiresAt < new Date()) {
      this.pendingJoinRequests.delete(requestId);
      return undefined;
    }
    return request;
  }

  deleteJoinRequest(requestId: string): void {
    this.pendingJoinRequests.delete(requestId);
  }

  registerOrder(context: OrderSocketContext): string {
    // Replace any existing credential for this order.
    this.revokeOrderKey(context.tableOrderId);

    const key = this.generateKey();
    const keyHash = this.hashKey(key);

    this.keys.set(keyHash, context);
    this.orderKeys.set(context.tableOrderId, keyHash);

    // Return the raw key only to the caller, for the HTTP response.
    return key;
  }

  validateKey(key: string): OrderSocketContext | undefined {
    if (!key) {
      return undefined;
    }

    return this.keys.get(this.hashKey(key));
  }

  getOrderSocketContext(
    tableOrderId: string,
  ): OrderSocketContext | undefined {
    const keyHash = this.orderKeys.get(tableOrderId);

    return keyHash ? this.keys.get(keyHash) : undefined;
  }

  revokeOrderKey(tableOrderId: string): void {
    const keyHash = this.orderKeys.get(tableOrderId);

    if (keyHash) {
      this.keys.delete(keyHash);
      this.orderKeys.delete(tableOrderId);
    }
  }

  revokeGroupKeys(groupId: string): void {
    for (const [keyHash, context] of this.keys.entries()) {
      if (context.groupId === groupId) {
        this.keys.delete(keyHash);
        this.orderKeys.delete(context.tableOrderId);
      }
    }
  }

  generateGroupId(): string {
    return randomBytes(16).toString('hex');
  }

  registerOriginOrder(tableOrderId: string, groupId: string = this.generateGroupId()): {
    wsKey: string;
    groupId: string;
  } {
    const wsKey = this.generateKey();

    const context: OrderSocketContext = {
      tableOrderId,
      groupId,
      role: 'origin',
    };

    const keyHash = this.hashKey(wsKey);

    this.keys.set(keyHash, context);
    this.orderKeys.set(tableOrderId, keyHash);

    return { wsKey, groupId };
  }
  
  moveOrderToGroup(tableOrderId: string, groupId: string): void {
    const context = this.getOrderSocketContext(tableOrderId);

    if (context) {
      context.groupId = groupId;
      context.role = 'member';
    }
  }


  clear(): void {
    this.keys.clear();
    this.orderKeys.clear();
  }
}