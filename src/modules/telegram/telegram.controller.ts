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
  UseInterceptors,
  type MessageEvent,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { SafeUser } from '../auth/auth.service';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { PasswordDto } from './dto/password.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { MessagingService } from './messaging.service';

@ApiTags('telegram')
@ApiBearerAuth()
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramManager,
    private readonly messaging: MessagingService,
    private readonly settings: SettingsService,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get global Telegram settings (api_hash hidden)' })
  getSettings() {
    return this.settings.getTelegramView();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Set global Telegram api_id / api_hash' })
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settings.setTelegram(dto);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'System uptime and instance health for the overview',
  })
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
  @ApiOperation({ summary: 'Create a Telegram instance' })
  createInstance(
    @CurrentUser() user: SafeUser,
    @Body() dto: CreateInstanceDto,
  ) {
    this.ensureEnabled();
    if (dto.engine && !this.telegram.isEngineAvailable(dto.engine)) {
      throw new BadRequestException(`Engine "${dto.engine}" is not available`);
    }
    return this.telegram.createInstance(user.id, dto.label, dto.engine, {
      apiId: dto.apiId,
      apiHash: dto.apiHash,
    });
  }

  @Get('instances')
  @ApiOperation({ summary: 'List Telegram instances' })
  listInstances() {
    this.ensureEnabled();
    return this.telegram.listInstances();
  }

  @Get('instances/:id')
  @ApiOperation({ summary: 'Get a Telegram instance' })
  async getInstance(@Param('id') id: string) {
    this.ensureEnabled();
    const instance = await this.telegram.getInstance(id);
    if (!instance) {
      throw new NotFoundException('Instance not found');
    }
    return instance;
  }

  @Delete('instances/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a Telegram instance (and its session)' })
  async removeInstance(@Param('id') id: string) {
    this.ensureEnabled();
    await this.telegram.removeInstance(id);
  }

  @Get('instances/:id/info')
  @ApiOperation({
    summary: 'Instance details + live connection state and uptime',
  })
  async instanceInfo(@Param('id') id: string) {
    this.ensureEnabled();
    const info = await this.telegram.instanceInfo(id);
    if (!info) {
      throw new NotFoundException('Instance not found');
    }
    return info;
  }

  @Post('instances/:id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connect an instance from its saved session' })
  async startInstance(@Param('id') id: string) {
    this.ensureEnabled();
    const instance = await this.telegram.startInstance(id);
    if (!instance) {
      throw new NotFoundException('Instance not found');
    }
    return instance;
  }

  @Post('instances/:id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect an instance (keeps its session)' })
  async stopInstance(@Param('id') id: string) {
    this.ensureEnabled();
    await this.telegram.stopInstance(id);
    return { ok: true };
  }

  @Sse('instances/:id/login/qr')
  @ApiOperation({
    summary: 'Stream a QR login (SSE): qr → password_required → authorized',
  })
  qrLogin(@Param('id') id: string): Observable<MessageEvent> {
    this.ensureEnabled();
    return this.telegram
      .startQrLogin(id)
      .pipe(map((event): MessageEvent => ({ data: event })));
  }

  @Post('instances/:id/login/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit the 2FA password for a pending QR login' })
  submitPassword(@Param('id') id: string, @Body() dto: PasswordDto) {
    this.ensureEnabled();
    const accepted = this.telegram.submitPassword(id, dto.password);
    if (!accepted) {
      throw new BadRequestException(
        'No password prompt is pending for this instance',
      );
    }
    return { ok: true };
  }

  @Get('instances/:id/chats')
  @ApiOperation({ summary: 'List an instance chats (most recent first)' })
  listChats(@Param('id') id: string) {
    this.ensureEnabled();
    return this.messaging.listChats(id);
  }

  @Get('instances/:id/chats/:chatId/messages')
  @ApiOperation({ summary: 'List messages of a chat (cursor-paginated)' })
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
  @ApiOperation({ summary: 'Send a message to a chat' })
  sendMessage(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    this.ensureEnabled();
    return this.messaging.send(id, chatId, dto.text);
  }

  @Post('instances/:id/chats/:chatId/media')
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
  @ApiOperation({ summary: 'Send a photo/video/document to a chat' })
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
  @ApiOperation({ summary: 'Stream newly ingested messages (SSE)' })
  messageStream(@Param('id') id: string): Observable<MessageEvent> {
    this.ensureEnabled();
    return this.messaging
      .stream(id)
      .pipe(map((message): MessageEvent => ({ data: message })));
  }

  @Get('instances/:id/chats/:chatId/photo')
  @ApiOperation({ summary: 'Chat / group / contact avatar (image bytes)' })
  async chatPhoto(
    @Param('id') id: string,
    @Param('chatId') chatId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    this.ensureEnabled();
    return this.streamBlob(res, await this.messaging.chatPhoto(id, chatId));
  }

  @Get('instances/:id/contacts/:contactId/photo')
  @ApiOperation({ summary: 'Contact avatar (image bytes)' })
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
  @ApiOperation({
    summary: 'Message attachment (raw bytes, downloaded lazily)',
  })
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
