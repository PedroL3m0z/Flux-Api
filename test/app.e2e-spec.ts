import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  // Requires the client to be built (client/dist); CI runs `build:client`.
  it('/dashboard/ (GET) serves the SPA without auth', async () => {
    const res = await request(app.getHttpServer()).get('/dashboard/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="app">');
  });

  afterEach(async () => {
    await app.close();
  });
});
