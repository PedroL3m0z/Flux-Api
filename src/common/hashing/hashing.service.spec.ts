import { HashingService } from './hashing.service';

describe('HashingService', () => {
  let service: HashingService;

  beforeEach(() => {
    service = new HashingService();
  });

  it('hashes to an argon2id string distinct from the plaintext', async () => {
    const hash = await service.hash('S3cureP@ss');
    expect(hash).not.toBe('S3cureP@ss');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash each call (random salt)', async () => {
    const a = await service.hash('same-password');
    const b = await service.hash('same-password');
    expect(a).not.toBe(b);
  });

  it('verifies a correct password', async () => {
    const hash = await service.hash('correct horse');
    await expect(service.verify(hash, 'correct horse')).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('correct horse');
    await expect(service.verify(hash, 'wrong horse')).resolves.toBe(false);
  });

  it('returns false (does not throw) on a malformed hash', async () => {
    await expect(service.verify('not-a-hash', 'whatever')).resolves.toBe(false);
  });
});
