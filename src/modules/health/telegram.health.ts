import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { TelegramManager } from '../../core/telegram/telegram.manager';

/**
 * Reports Telegram integration status. Always "up": a disabled integration
 * (no API credentials) is not a failure, just reported as enabled: false.
 */
@Injectable()
export class TelegramHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly telegram: TelegramManager,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const summary = await this.telegram.instancesSummary();
    return indicator.up({ ...summary });
  }
}
