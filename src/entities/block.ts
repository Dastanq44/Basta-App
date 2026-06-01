import type { UserId } from './user';

export type Block = {
  blockerId: UserId;
  blockedId: UserId;
  createdAt: string;
};
