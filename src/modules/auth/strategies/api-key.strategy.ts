import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

export const API_KEY_HEADER = 'x-api-key';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(
  HeaderAPIKeyStrategy,
  'api-key',
) {
  constructor(private readonly config: ConfigService) {
    // { header, prefix } + passReqToCallback=false; @nestjs/passport wires
    // the verify callback to this.validate automatically.
    super({ header: API_KEY_HEADER, prefix: '' }, false);
  }

  validate(apiKey: string): boolean {
    const expected = this.config.get<string>('API_KEY');
    if (expected && apiKey === expected) {
      return true;
    }
    throw new UnauthorizedException('Invalid API key');
  }
}
