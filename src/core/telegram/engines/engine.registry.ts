import { Inject, Injectable } from '@nestjs/common';
import {
  TELEGRAM_ENGINES,
  type EngineKey,
  type InstanceEngine,
} from './engine.types';

/** Resolves instance engines by key and reports which are usable. */
@Injectable()
export class EngineRegistry {
  private readonly engines = new Map<EngineKey, InstanceEngine>();

  constructor(@Inject(TELEGRAM_ENGINES) engines: InstanceEngine[]) {
    for (const engine of engines) {
      this.engines.set(engine.key, engine);
    }
  }

  /** Returns the engine for a key, or null when it is not registered. */
  tryGet(key: EngineKey): InstanceEngine | null {
    return this.engines.get(key) ?? null;
  }

  /** Returns the engine for a key, throwing when it is not registered. */
  get(key: EngineKey): InstanceEngine {
    const engine = this.engines.get(key);
    if (!engine) {
      throw new Error(`Unknown Telegram engine: ${key}`);
    }
    return engine;
  }

  isAvailable(key: EngineKey): boolean {
    return this.engines.get(key)?.isAvailable() ?? false;
  }

  /** Keys of engines that are registered and configured to run. */
  availableKeys(): EngineKey[] {
    return [...this.engines.values()]
      .filter((engine) => engine.isAvailable())
      .map((engine) => engine.key);
  }
}
