import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/modules/auth/auth.service';
import { PrismaService } from './../src/core/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let apiKey: string | undefined;
  let token: string;

  const tag = Date.now();
  // Bootstrap user (created directly, like the env seed does).
  const boot = {
    email: `boot_${tag}@flux.dev`,
    username: `boot_${tag}`,
    password: 'S3cureP@ss',
  };
  // Second user, created through the protected endpoint by the bootstrap user.
  const created = {
    email: `made_${tag}@flux.dev`,
    username: `made_${tag}`,
    password: 'S3cureP@ss',
  };
  const createdIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    apiKey = app.get(ConfigService).get<string>('API_KEY');

    const seeded = await app.get(AuthService).register(boot);
    createdIds.push(seeded.id);
  });

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    }
    await app.close();
  });

  it('rejects register without auth (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(created)
      .expect(401);
  });

  it('logs in the bootstrap user and returns a JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: boot.username, password: boot.password })
      .expect(200);
    token = (res.body as { accessToken: string }).accessToken;
    expect(typeof token).toBe('string');
  });

  it('creates another user when authenticated (no password leak)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send(created)
      .expect(201);
    const body = res.body as { id: string; username: string };
    expect(body).toMatchObject({ username: created.username });
    expect(res.body).not.toHaveProperty('password');
    createdIds.push(body.id);
  });

  it('rejects a duplicate registration with 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send(created)
      .expect(409);
  });

  it('accesses /auth/me with the token, 401 without', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('accepts the configured API key and rejects a wrong one', async () => {
    await request(app.getHttpServer())
      .get('/auth/api-key-check')
      .set('x-api-key', apiKey ?? '')
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/api-key-check')
      .set('x-api-key', 'definitely-wrong-key')
      .expect(401);
  });
});
