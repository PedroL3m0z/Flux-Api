import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  ServiceUnavailableException,
  Sse,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type MessageEvent,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiSecurity,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { filter, map, type Observable } from 'rxjs';
import type { MediaBlob } from '../../core/telegram/engines/engine.types';
import { SendMediaDto } from './dto/send-media.dto';

/** Minimal shape of a Multer in-memory upload (avoids global type augmentation). */
interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}
import { TelegramManager } from '../../core/telegram/telegram.manager';
import { SettingsService } from '../../core/telegram/services/settings.service';
import { TelegramEventBus } from '../../core/telegram/services/telegram-events.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireInstancePermission } from '../../common/authz/require-instance-permission.decorator';
import { InstanceAccessGuard } from '../../common/authz/instance-access.guard';
import type { SafeUser } from '../auth/auth.service';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { PasswordDto } from './dto/password.dto';
import { PhoneCodeDto } from './dto/phone-code.dto';
import { PhoneDto } from './dto/phone.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  ChatEntity,
  InstanceEntity,
  InstanceInfoEntity,
  MessageEntity,
  StatsEntity,
  TelegramSettingsEntity,
} from './entities/telegram.entity';
import { OkResponseEntity } from '../auth/entities/auth.entity';
import {
  LoginPasswordResponseEntity,
  PhoneLoginStepEntity,
} from './entities/login.entity';
import { MessagingService } from './messaging.service';

@ApiTags('telegram')
@ApiBearerAuth()
@ApiSecurity('api-key')
@ApiForbiddenResponse({
  description: 'Caller lacks the required dashboard permission.',
})
@ApiServiceUnavailableResponse({
  description:
    'Telegram integration is disabled (TELEGRAM_API_ID / TELEGRAM_API_HASH not set).',
})
@UseGuards(InstanceAccessGuard)
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramManager,
    private readonly messaging: MessagingService,
    private readonly settings: SettingsService,
    private readonly events: TelegramEventBus,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get global Telegram settings (api_hash hidden)' })
  @ApiOkResponse({ type: TelegramSettingsEntity })
  getSettings() {
    return this.settings.getTelegramView();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Set global Telegram api_id / api_hash' })
  @ApiOkResponse({ type: TelegramSettingsEntity })
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settings.setTelegram(dto);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'System uptime and instance health for the overview',
  })
  @ApiOkResponse({ type: StatsEntity })
  async stats() {
    const instances = await this.telegram.listInstances();
    const authorized = instances.filter(
      (instance) => instance.status === 'authorized',
    ).length;
    return {
      uptimeSeconds: Math.floor(process.uptime()),
      instances: {
        total: instances.length,
        authorized,
        connected: this.telegram.connectedCount(),
      },
    };
  }

  private ensureEnabled(): void {
    if (!this.telegram.enabled) {
      throw new ServiceUnavailableException(
        'Telegram integration is disabled: set TELEGRAM_API_ID and TELEGRAM_API_HASH',
      );
    }
  }

  @Post('instances')
  @RequireInstancePermission('instance:manage')
  @ApiOperation({
    summary: 'Create a Telegram instance',
    description:
      'Registers a new instance for the current user. Engine defaults to gramjs; per-instance api_id/api_hash override the global settings.',
  })
  @ApiCreatedResponse({ type: InstanceEntity })
  async createInstance(
    @CurrentUser() user: SafeUser,
    @Body() dto: CreateInstanceDto,
  ) {
    this.ensureEnabled();
    if (dto.engine && !this.telegram.isEngineAvailable(dto.engine)) {
      throw new BadRequestException(`Engine "${dto.engine}" is not available`);
    }
    const instance = await this.telegram.createInstance(
      user.id,
      dto.label,
      dto.engine,
      { apiId: dto.apiId, apiHash: dto.apiHash },
    );
    return { ...instance, myRole: user.role };
  }

  @Get('instances')
  @ApiOperation({ summary: 'List Telegram instances' })
  @ApiOkResponse({ type: [InstanceEntity] })
  async listInstances(@CurrentUser() user: SafeUser) {
    this.ensureEnabled();
    const instances = await this.telegram.listInstances();
    return instances.map((i) => ({ ...i, myRole: user.role }));
  }

  @Get('instances/:id')
  @RequireInstancePermission('instance:read')
  @ApiOperation({ summary: 'Get a Telegram instance' })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiOkResponse({ type: InstanceEntity })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  async getInstance(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    this.ensureEnabled();
    const instance = await this.telegram.getInstance(id);
    if (!instance) {
      throw new NotFoundException('Instance not found');
    }
    return { ...instance, myRole: user.role };
  }

  @Delete('instances/:id')
  @RequireInstancePermission('instance:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a Telegram instance (and its session)' })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiNoContentResponse({ description: 'Deleted' })
  async removeInstance(@Param('id') id: string) {
    this.ensureEnabled();
    await this.telegram.removeInstance(id);
  }

  @Get('instances/:id/info')
  @RequireInstancePermission('instance:read')
  @ApiOperation({
    summary: 'Instance details + live connection state and uptime',
  })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiOkResponse({ type: InstanceInfoEntity })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  async instanceInfo(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    this.ensureEnabled();
    const info = await this.telegram.instanceInfo(id);
    if (!info) {
      throw new NotFoundException('Instance not found');
    }
    return { ...info, myRole: user.role };
  }

  @Post('instances/:id/start')
  @RequireInstancePermission('instance:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connect an instance from its saved session' })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiOkResponse({ type: InstanceEntity })
  @ApiNotFoundResponse({ description: 'Instance not found' })
  async startInstance(@Param('id') id: string) {
    this.ensureEnabled();
    try {
      const instance = await this.telegram.startInstance(id);
      if (!instance) {
        throw new NotFoundException('Instance not found');
      }
      return instance;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to start instance';
      throw new BadRequestException(message);
    }
  }

  @Sse('instances/status/stream')
  @ApiOperation({
    summary: 'Stream instance session status changes (SSE)',
    description:
      'Pushes `session.status` events whenever an instance connects, disconnects, errors or is revoked.',
  })
  @ApiProduces('text/event-stream')
  statusStream(): Observable<MessageEvent> {
    this.ensureEnabled();
    return this.events.events$().pipe(
      filter((event) => event.type === 'session.status'),
      map(
        (event): MessageEvent => ({
          data: {
            instanceId: event.instanceId,
            at: event.at,
            ...event.payload,
          },
        }),
      ),
    );
  }

  @Post('instances/:id/stop')
  @RequireInstancePermission('instance:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect an instance (keeps its session)' })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiOkResponse({ type: OkResponseEntity })
  async stopInstance(@Param('id') id: string) {
    this.ensureEnabled();
    await this.telegram.stopInstance(id);
    return { ok: true };
  }

  @Sse('instances/:id/login/qr')
  @RequireInstancePermission('instance:manage')
  @ApiOperation({
    summary: 'Stream a QR login (SSE): qr → password_required → authorized',
    description:
      'Server-Sent Events stream. Emits a QR url to scan, then `password_required` if 2FA is on, then `authorized` with the account identity.',
  })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiProduces('text/event-stream')
  qrLogin(@Param('id') id: string): Observable<MessageEvent> {
    this.ensureEnabled();
    return this.telegram
      .startQrLogin(id)
      .pipe(map((event): MessageEvent => ({ data: event })));
  }

  @Post('instances/:id/login/password')
  @RequireInstancePermission('instance:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit the 2FA password for a pending QR or phone login',
  })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiOkResponse({ type: LoginPasswordResponseEntity })
  async submitPassword(@Param('id') id: string, @Body() dto: PasswordDto) {
    this.ensureEnabled();
    const isPhoneLogin = this.telegram.isPhoneLoginPending(id);
    const accepted = this.telegram.submitPassword(id, dto.password);
    if (!accepted) {
      throw new BadRequestException(
        'No password prompt is pending for this instance',
      );
    }
    if (isPhoneLogin) {
      const step = await this.telegram.awaitPhoneLoginAfterPassword(id);
      if (step?.status === 'authorized') {
        return { ok: true, me: step.me };
      }
    }
    return { ok: true };
  }

  @Post('instances/:id/login/phone')
  @RequireInstancePermission('instance:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start phone-number login (Telegram sends a code to the app/SMS)',
  })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiOkResponse({ type: OkResponseEntity })
  async startPhoneLogin(@Param('id') id: string, @Body() dto: PhoneDto) {
    this.ensureEnabled();
    try {
      await this.telegram.startPhoneLogin(id, dto.phone);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Phone login failed';
      if (message === 'Instance not found') {
        throw new NotFoundException(message);
      }
      throw new BadRequestException(message);
    }
    return { ok: true };
  }

  @Post('instances/:id/login/code')
  @RequireInstancePermission('instance:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit the OTP code for a pending phone login' })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiOkResponse({ type: PhoneLoginStepEntity })
  async submitPhoneCode(@Param('id') id: string, @Body() dto: PhoneCodeDto) {
    this.ensureEnabled();
    try {
      return await this.telegram.submitPhoneCode(id, dto.code);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid or expired code';
      throw new BadRequestException(message);
    }
  }

  @Get('instances/:id/chats')
  @RequireInstancePermission('chat:read')
  @ApiOperation({ summary: 'List an instance chats (most recent first)' })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiOkResponse({ type: [ChatEntity] })
  listChats(@Param('id') id: string) {
    this.ensureEnabled();
    return this.messaging.listChats(id);
  }

  @Get('instances/:id/chats/:chatId/messages')
  @RequireInstancePermission('message:read')
  @ApiOperation({
    summary: 'List messages of a chat (cursor-paginated)',
    description:
      'Returns messages newest-first. Pass the oldest returned message id as `cursor` to page backwards through history.',
  })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiParam({ name: 'chatId', description: 'Chat id' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Message id to page before (older than)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size (default server-side)',
  })
  @ApiOkResponse({ type: [MessageEntity] })
  listMessages(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    this.ensureEnabled();
    return this.messaging.listMessages(id, chatId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('instances/:id/chats/:chatId/messages')
  @RequireInstancePermission('message:send')
  @ApiOperation({ summary: 'Send a text message to a chat' })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiParam({ name: 'chatId', description: 'Chat id' })
  @ApiCreatedResponse({ type: MessageEntity })
  sendMessage(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    this.ensureEnabled();
    return this.messaging.send(id, chatId, dto.text);
  }

  @Post('instances/:id/chats/:chatId/media')
  @RequireInstancePermission('media:send')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary: 'Send a photo/video/document to a chat',
    description:
      'multipart/form-data upload (max 50 MB). `file` is required; `caption` is optional.',
  })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiParam({ name: 'chatId', description: 'Chat id' })
  @ApiCreatedResponse({ type: MessageEntity })
  sendMedia(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() dto: SendMediaDto,
  ) {
    this.ensureEnabled();
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    return this.messaging.sendMedia(
      id,
      chatId,
      {
        data: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
      },
      dto.caption,
    );
  }

  @Sse('instances/:id/messages/stream')
  @RequireInstancePermission('message:read')
  @ApiOperation({
    summary: 'Stream newly ingested messages (SSE)',
    description:
      'Server-Sent Events stream that pushes each new message as it is persisted, in MessageView shape.',
  })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiProduces('text/event-stream')
  messageStream(@Param('id') id: string): Observable<MessageEvent> {
    this.ensureEnabled();
    return this.messaging
      .stream(id)
      .pipe(map((message): MessageEvent => ({ data: message })));
  }

  @Get('instances/:id/chats/:chatId/photo')
  @RequireInstancePermission('chat:read')
  @ApiOperation({ summary: 'Chat / group / contact avatar (image bytes)' })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiParam({ name: 'chatId', description: 'Chat id' })
  @ApiProduces('image/jpeg', 'application/octet-stream')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiNotFoundResponse({ description: 'No avatar available' })
  async chatPhoto(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    this.ensureEnabled();
    return this.streamBlob(res, await this.messaging.chatPhoto(id, chatId));
  }

  @Get('instances/:id/contacts/:contactId/photo')
  @RequireInstancePermission('chat:read')
  @ApiOperation({ summary: 'Contact avatar (image bytes)' })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiParam({ name: 'contactId', description: 'Contact id' })
  @ApiProduces('image/jpeg', 'application/octet-stream')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiNotFoundResponse({ description: 'No avatar available' })
  async contactPhoto(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    this.ensureEnabled();
    return this.streamBlob(
      res,
      await this.messaging.contactPhoto(id, contactId),
    );
  }

  @Get('instances/:id/chats/:chatId/messages/:messageId/media')
  @RequireInstancePermission('message:read')
  @ApiOperation({
    summary: 'Message attachment (raw bytes, downloaded lazily)',
  })
  @ApiParam({ name: 'id', description: 'Instance id' })
  @ApiParam({ name: 'chatId', description: 'Chat id' })
  @ApiParam({ name: 'messageId', description: 'Message id' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiNotFoundResponse({ description: 'Media not available' })
  async messageMedia(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    this.ensureEnabled();
    return this.streamBlob(
      res,
      await this.messaging.messageMedia(id, chatId, messageId),
    );
  }

  /** Streams downloaded bytes with the right headers, or 404 when absent. */
  private streamBlob(res: Response, blob: MediaBlob | null): StreamableFile {
    if (!blob) {
      throw new NotFoundException('Media not available');
    }
    res.setHeader('Content-Type', blob.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (blob.fileName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${blob.fileName.replace(/"/g, '')}"`,
      );
    }
    return new StreamableFile(blob.data);
  }
}
