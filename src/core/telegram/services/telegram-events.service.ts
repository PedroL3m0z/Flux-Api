import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/** All event types the system can capture and fan out to webhooks. */
export const EVENT_TYPES = [
  'session.status',
  'message.new',
  'message.edited',
  'message.deleted',
  'message.read',
  'message.reaction',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** An engine-agnostic domain event tied to an instance. */
export interface DomainEvent {
  instanceId: string;
  type: EventType;
  at: string; // ISO timestamp
  payload: Record<string, unknown>;
}

/**
 * In-process pub/sub for domain events. The SSE message stream and the webhook
 * dispatcher both subscribe; the sync service and manager publish. Kept in
 * process (like the message stream) — Redis stays sessions-only.
 */
@Injectable()
export class TelegramEventBus {
  private readonly subject = new Subject<DomainEvent>();

  events$(): Observable<DomainEvent> {
    return this.subject.asObservable();
  }

  publish(event: {
    instanceId: string;
    type: EventType;
    payload: Record<string, unknown>;
    at?: string;
  }): void {
    this.subject.next({
      instanceId: event.instanceId,
      type: event.type,
      payload: event.payload,
      at: event.at ?? new Date().toISOString(),
    });
  }
}
