import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EVENT_TYPES } from '../../core/telegram/services/telegram-events.service';
import { WebhooksService } from '../../core/webhooks/webhooks.service';
import type { SafeUser } from '../auth/auth.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('event-types')
  @ApiOperation({ summary: 'List the event types webhooks can subscribe to' })
  eventTypes() {
    return EVENT_TYPES;
  }

  @Post()
  @ApiOperation({
    summary: 'Create a webhook (returns the signing secret once)',
  })
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List your webhooks' })
  list(@CurrentUser() user: SafeUser) {
    return this.webhooks.list(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook' })
  get(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.webhooks.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a webhook' })
  update(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooks.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook' })
  async remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    await this.webhooks.remove(user.id, id);
  }

  @Post(':id/regenerate-secret')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the signing secret (returned once)' })
  regenerateSecret(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.webhooks.regenerateSecret(user.id, id);
  }

  @Post(':id/instances/:instanceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link an instance to a webhook' })
  link(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('instanceId') instanceId: string,
  ) {
    return this.webhooks.linkInstance(user.id, id, instanceId);
  }

  @Delete(':id/instances/:instanceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink an instance from a webhook' })
  unlink(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('instanceId') instanceId: string,
  ) {
    return this.webhooks.unlinkInstance(user.id, id, instanceId);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Recent delivery attempts for a webhook' })
  deliveries(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhooks.listDeliveries(
      user.id,
      id,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('deliveries/:deliveryId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-queue a delivery for immediate retry' })
  resend(
    @CurrentUser() user: SafeUser,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.webhooks.resendDelivery(user.id, deliveryId);
  }
}
