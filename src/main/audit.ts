// ========== 审计日志模块 ==========
// 记录所有危险操作、验证、计划事件

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type AuditEventKind =
  | 'command.blocked'
  | 'command.executed'
  | 'file.written'
  | 'file.deleted'
  | 'verify.failed'
  | 'verify.passed'
  | 'plan.created'
  | 'plan.approved'
  | 'plan.executed'
  | 'agent.dryrun'
  | 'agent.delegation';

export interface AuditEvent {
  id: string;
  timestamp: number;
  kind: AuditEventKind;
  summary: string;
  details?: any;
  userId?: string;
  threadId?: string;
}

class AuditLog {
  private events: AuditEvent[] = [];
  private maxSize = 500;
  private logFilePath: string;

  constructor() {
    const userData = app?.getPath('userData') || process.cwd();
    this.logFilePath = path.join(userData, 'audit.log');
  }

  log(kind: AuditEventKind, summary: string, details?: any, meta?: { userId?: string; threadId?: string }): void {
    const event: AuditEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      kind,
      summary,
      details,
      userId: meta?.userId,
      threadId: meta?.threadId,
    };
    this.events.push(event);
    if (this.events.length > this.maxSize) {
      this.events.shift();
    }
    this.persist(event);
  }

  private persist(event: AuditEvent): void {
    try {
      const line = JSON.stringify(event) + '\n';
      fs.appendFileSync(this.logFilePath, line, 'utf-8');
    } catch (e) {
      // 静默失败
    }
  }

  recent(kind?: AuditEventKind, limit = 50): AuditEvent[] {
    let filtered = kind ? this.events.filter(e => e.kind === kind) : this.events;
    return filtered.slice(-limit).reverse();
  }

  clear(): void {
    this.events = [];
  }

  size(): number {
    return this.events.length;
  }
}

export const audit = new AuditLog();
