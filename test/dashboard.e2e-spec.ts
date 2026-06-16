import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { DashboardModule } from './../src/modules/dashboard/dashboard.module';

// Booted via NestFactory (not Test.createTestingModule) on purpose:
// @nestjs/serve-static picks its loader from the HTTP adapter at DI time, and
// the TestingModule resolves providers before the adapter exists (NoopLoader).
// NestFactory mirrors the production boot order, so the ExpressLoader serves.
// Boots the real DashboardModule. No database needed.
describe('Dashboard SPA (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await NestFactory.create(DashboardModule, { logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Requires the client to be built (client/dist); CI runs `build:client`.
  it('serves the SPA index at /dashboard/ (no auth)', async () => {
    const res = await request(app.getHttpServer()).get('/dashboard/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="app">');
  });

  it('redirects /dashboard to /dashboard/', async () => {
    const res = await request(app.getHttpServer()).get('/dashboard');
    expect(res.status).toBe(301);
  });
});
