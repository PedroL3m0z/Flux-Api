import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EVENT_TYPES } from '../../core/telegram/services/telegram-events.service';
import { InstanceAccessService } from '../../core/telegram/services/instance-access.service';
import { WebhooksService } from '../../core/webhooks/webhooks.service';
import type { SafeUser } from '../auth/auth.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import {
  WebhookDeliveryEntity,
  WebhookEntity,
  WebhookWithSecretEntity,
} from './entities/webhook.entity';

@ApiTags('webhooks')
@ApiBearerAuth()
@ApiSecurity('api-key')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooks: WebhooksService,
    private readonly access: InstanceAccessService,
  ) {}

  @Get('event-types')
  @ApiOperation({
    summary: 'List subscribable event types',
    description:
      'Returns the full set of Telegram event types a webhook can subscribe to (session.status, message.new/edited/deleted/read/reaction).',
  })
  @ApiOkResponse({ type: [String], schema: { example: EVENT_TYPES } })
  eventTypes() {
    return EVENT_TYPES;
  }

  @Post()
  @ApiOperation({
    summary: 'Create a webhook',
    description:
      'Creates a webhook owned by the current user and returns the signing secret **once**. Optionally links instances via `instanceIds`.',
  })
  @ApiCreatedResponse({ type: WebhookWithSecretEntity })
  create(@CurrentUser() user: SafeUser, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List your webhooks' })
  @ApiOkResponse({ type: [WebhookEntity] })
  list(@CurrentUser() user: SafeUser) {
    return this.webhooks.list(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one webhook by id' })
  @ApiParam({ name: 'id', description: 'Webhook id' })
  @ApiOkResponse({ type: WebhookEntity })
  @ApiNotFoundResponse({ description: 'Webhook not found' })
  get(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.webhooks.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a webhook',
    description: 'Patch name, url, active flag and/or subscribed events.',
  })
  @ApiParam({ name: 'id', description: 'Webhook id' })
  @ApiOkResponse({ type: WebhookEntity })
  @ApiNotFoundResponse({ description: 'Webhook not found' })
  update(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooks.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook (and its deliveries)' })
  @ApiParam({ name: 'id', description: 'Webhook id' })
  @ApiNoContentResponse({ description: 'Deleted' })
  async remove(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    await this.webhooks.remove(user.id, id);
  }

  @Post(':id/regenerate-secret')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the signing secret',
    description:
      'Generates a new HMAC signing secret and returns it once. The previous secret stops working immediately.',
  })
  @ApiParam({ name: 'id', description: 'Webhook id' })
  @ApiOkResponse({ type: WebhookWithSecretEntity })
  regenerateSecret(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return this.webhooks.regenerateSecret(user.id, id);
  }

  @Post(':id/instances/:instanceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link an instance to a webhook (M2M)' })
  @ApiParam({ name: 'id', description: 'Webhook id' })
  @ApiParam({ name: 'instanceId', description: 'Instance id to link' })
  @ApiOkResponse({ type: WebhookEntity })
  @ApiForbiddenResponse({
    description: 'Requires webhook:manage on the target instance',
  })
  async link(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('instanceId') instanceId: string,
  ) {
    if (!(await this.access.can(user, instanceId, 'webhook:manage'))) {
      throw new ForbiddenException(
        'Missing permission "webhook:manage" on this instance',
      );
    }
    return this.webhooks.linkInstance(user.id, id, instanceId);
  }

  @Delete(':id/instances/:instanceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink an instance from a webhook' })
  @ApiParam({ name: 'id', description: 'Webhook id' })
  @ApiParam({ name: 'instanceId', description: 'Instance id to unlink' })
  @ApiOkResponse({ type: WebhookEntity })
  unlink(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Param('instanceId') instanceId: string,
  ) {
    return this.webhooks.unlinkInstance(user.id, id, instanceId);
  }

  @Get(':id/deliveries')
  @ApiOperation({
    summary: 'List recent delivery attempts',
    description:
      'Returns the delivery log for a webhook, newest first. Each entry carries status, HTTP code, attempts and any error.',
  })
  @ApiParam({ name: 'id', description: 'Webhook id' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max rows to return (default 50)',
  })
  @ApiOkResponse({ type: [WebhookDeliveryEntity] })
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
  @ApiOperation({
    summary: 'Re-queue a delivery for immediate retry',
    description:
      'Resets a delivery to pending with an immediate next-attempt so the worker resends it on the next tick.',
  })
  @ApiParam({ name: 'deliveryId', description: 'Delivery id' })
  @ApiOkResponse({ type: WebhookDeliveryEntity })
  @ApiNotFoundResponse({ description: 'Delivery not found' })
  resend(
    @CurrentUser() user: SafeUser,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.webhooks.resendDelivery(user.id, deliveryId);
  }
}
