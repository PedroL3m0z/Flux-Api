import { bootstrapRuntimeConfig } from './runtime-config';

/**
 * Resolves DATABASE_URL and the managed secrets (generating + persisting them
 * when absent) as a one-time side effect at first import.
 *
 * This MUST run before `ConfigModule.forRoot` validates the environment. That
 * validation happens eagerly while `app.module.ts` is evaluated (the `@Module`
 * decorator calls `forRoot`), which — because ES module imports are hoisted —
 * is before any statement inside `main.ts#bootstrap()`. So the bootstrap can't
 * live in `bootstrap()`; instead `app.module.ts` imports this module, and the
 * ES-module singleton guarantees it has executed before `forRoot` runs. `main`
 * imports the same `runtime` to surface what was generated.
 */
export const runtime = bootstrapRuntimeConfig();
