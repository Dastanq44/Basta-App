export type ReportTargetType = 'submission' | 'comment' | 'user' | 'group' | 'challenge';

export type ReportId = string;

export type Report = {
  id: ReportId;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
  status: 'open' | 'reviewed' | 'dismissed';
  createdAt: string;
};
