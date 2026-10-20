import { SELF } from 'cloudflare:test';
import { it, expect } from 'vitest';

it('worker answers /api/health', async () => {
  const res = await SELF.fetch('http://example.com/api/health');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'Worker API is running' });
});
