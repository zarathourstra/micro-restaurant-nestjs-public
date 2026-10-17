import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';

import { InvalidGroupJoinKeyException } from '../exceptions/invalid-group-join-key.exception';

export type TableOrderGroupRole = 'origin' | 'member';

export interface OrderSocketContext {
  tableOrderId: string;
  groupId: string;
  role: TableOrderGroupRole;
}

interface GroupJoinContext {
  groupId: string;
  originTableOrderId: string;
  expiresAt: Date;
}

const JOIN_KEY_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class DiningSocketsService {
  // Hash -> authenticated order context
  private readonly keys = new Map<string, OrderSocketContext>();

  private readonly joinKeys = new Map<string, GroupJoinContext>();

  // Order ID -> key hash
  private readonly orderKeys = new Map<string, string>();

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  generateKey(): string {
    return randomBytes(32).toString('hex');
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

  // Read-only check: lets callers fail early without consuming the key.
  peekJoinKey(groupJoinKey: string): GroupJoinContext {
    const joinContext = this.joinKeys.get(this.hashKey(groupJoinKey));

    if (!joinContext) {
      throw new InvalidGroupJoinKeyException();
    }

    return joinContext;
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

  createGroupJoinKey(groupId: string, originTableOrderId: string): { joinKey: string; expiresAt: Date } {
    const joinKey = this.generateKey();
    const expiresAt = new Date(Date.now() + JOIN_KEY_TTL_MS);

    this.joinKeys.set(this.hashKey(joinKey), { groupId, originTableOrderId, expiresAt });

    return { joinKey, expiresAt };
  }

  registerMemberOrder(tableOrderId: string, groupJoinKey: string): { wsKey: string; groupId: string; } {
    const joinKeyHash = this.hashKey(groupJoinKey);
    const joinContext = this.peekJoinKey(groupJoinKey);

    // Consume the token so it cannot authorize another order.
    this.joinKeys.delete(joinKeyHash);

    const wsKey = this.generateKey();
    const keyHash = this.hashKey(wsKey);

    const context: OrderSocketContext = {
      tableOrderId,
      groupId: joinContext.groupId,
      role: 'member',
    };

    this.keys.set(keyHash, context);
    this.orderKeys.set(tableOrderId, keyHash);

    return {wsKey, groupId: joinContext.groupId,};
  }
  
  clear(): void {
    this.keys.clear();
    this.orderKeys.clear();
  }
}