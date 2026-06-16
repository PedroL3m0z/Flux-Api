import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/core/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let apiKey: string | undefined;

  // Unique per run so repeated local runs don't collide on the unique columns.
  const tag = Date.now();
  const email = `e2e_${tag}@flux.dev`;
  const username = `e2e_${tag}`;
  const password = 'S3cureP@ss';
  let createdUserId: string | undefined;

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
  });

  afterAll(async () => {
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } });
    }
    await app.close();
  });

  it('registers a new user and never returns the password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username, password })
      .expect(201);

    const body = res.body as { id: string; email: string; username: string };
    expect(body).toMatchObject({ email, username });
    expect(body.id).toBeDefined();
    expect(res.body).not.toHaveProperty('password');
    createdUserId = body.id;
  });

  it('rejects a duplicate registration with 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, username, password })
      .expect(409);
  });

  it('rejects login with a wrong password (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password: 'wrong-password' })
      .expect(401);
  });

  it('logs in with valid credentials and returns a JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password })
      .expect(200);

    const body = res.body as { accessToken: string };
    expect(typeof body.accessToken).toBe('string');
  });

  it('accesses a JWT-protected route with the token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password })
      .expect(200);
    const token = (login.body as { accessToken: string }).accessToken;

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const meBody = me.body as { username: string; email: string };
    expect(meBody).toMatchObject({ username, email });
  });

  it('rejects a protected route without a token (401)', async () => {
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
