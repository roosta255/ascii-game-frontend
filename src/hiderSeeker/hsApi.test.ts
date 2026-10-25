import { describe, it, expect } from 'vitest';
import { createHsClient, isStaleRevision } from './hsApi';

interface Call { url: string; init?: RequestInit; }

// A fetch that records every call and answers with `status`, `body` and `headers`.
function fakeFetch(status: number, body: string | null, headers: Record<string, string> = {}) {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status, headers });
  };
  return { calls, fetchFn };
}

function client(fetchFn: (url: string, init?: RequestInit) => Promise<Response>) {
  return createHsClient('http://api', fetchFn, () => 'key-1');
}

describe('hsApi', () => {
  describe('createMatch', () => {
    it('posts to the matches endpoint with the correct JSON body and parses the response into an HsResponse', async () => {
      const { calls, fetchFn } = fakeFetch(201, '{"match_id":"m1","revision":0,"phase":"LOBBY"}');
      
      const result = await client(fetchFn).createMatch('host', 2, 1, 42);
      
      expect(calls[0].url).toBe('http://api/api/v1/matches');
      expect(calls[0].init?.method).toBe('POST');
      expect(JSON.parse(calls[0].init?.body as string)).toEqual({
        account: 'host',
        hider_count: 2,
        npc_hiders: 1,
        seed: 42
      });
      expect(result).toEqual({
        status: 201,
        body: { match_id: 'm1', revision: 0, phase: 'LOBBY' },
        etag: null
      });
    });
  });

  describe('joinMatch and startMatch', () => {
    it('posts to their respective match sub-paths with the correct JSON body and idempotency key', async () => {
      const { calls, fetchFn } = fakeFetch(200, '{}');
      
      await client(fetchFn).joinMatch('m1', 'alice', 0);
      
      expect(calls[0].url).toBe('http://api/api/v1/matches/m1/join');
      expect(calls[0].init?.method).toBe('POST');
      expect(JSON.parse(calls[0].init?.body as string)).toEqual({
        account: 'alice',
        expected_revision: 0,
        idempotency_key: 'key-1'
      });
      
      // Test startMatch
      const { calls: calls2, fetchFn: fetchFn2 } = fakeFetch(200, '{}');
      await client(fetchFn2).startMatch('m1', 'host', 1);
      
      expect(calls2[0].url).toBe('http://api/api/v1/matches/m1/start');
      expect(calls2[0].init?.method).toBe('POST');
      expect(JSON.parse(calls2[0].init?.body as string)).toEqual({
        account: 'host',
        expected_revision: 1,
        idempotency_key: 'key-1'
      });
    });
  });

  describe('getMatch', () => {
    it('performs a GET request without a request body and parses the JSON response', async () => {
      const { calls, fetchFn } = fakeFetch(200, '{"phase":"ACTIVE"}');
      
      const result = await client(fetchFn).getMatch('m1');
      
      expect(calls[0].url).toBe('http://api/api/v1/matches/m1');
      expect(calls[0].init).toBeUndefined();
      expect(result).toEqual({
        status: 200,
        body: { phase: 'ACTIVE' },
        etag: null
      });
    });
  });

  describe('move-related methods', () => {
    it('submitMove sends the correct JSON payload and HTTP method', async () => {
      const { calls, fetchFn } = fakeFetch(200, '{}');
      
      await client(fetchFn).submitMove('m1', 'alice', 4, 'QUEUE', { type: 'CONNECT', server_id: 0 });
      
      expect(calls[0].url).toBe('http://api/api/v1/matches/m1/intents');
      expect(calls[0].init?.method).toBe('POST');
      expect(JSON.parse(calls[0].init?.body as string)).toEqual({
        account: 'alice',
        expected_revision: 4,
        idempotency_key: 'key-1',
        play_mode: 'QUEUE',
        intent: { type: 'CONNECT', server_id: 0 }
      });
    });

    it('passTicks sends the correct JSON payload and HTTP method', async () => {
      const { calls, fetchFn } = fakeFetch(200, '{}');
      
      await client(fetchFn).passTicks('m1', 'alice', 5, 3);
      
      expect(calls[0].url).toBe('http://api/api/v1/matches/m1/intents');
      expect(calls[0].init?.method).toBe('POST');
      expect(JSON.parse(calls[0].init?.body as string)).toEqual({
        account: 'alice',
        expected_revision: 5,
        idempotency_key: 'key-1',
        play_mode: 'PASS',
        intent: { type: 'PASS' },
        ticks: 3
      });
    });

    it('cancelMove sends the correct JSON payload and HTTP method', async () => {
      const { calls, fetchFn } = fakeFetch(200, '{}');
      
      await client(fetchFn).cancelMove('m1', 'alice', 6, 'mv-3');
      
      expect(calls[0].url).toBe('http://api/api/v1/matches/m1/intents/mv-3');
      expect(calls[0].init?.method).toBe('DELETE');
      expect(JSON.parse(calls[0].init?.body as string)).toEqual({
        account: 'alice',
        expected_revision: 6,
        idempotency_key: 'key-1'
      });
    });
  });

  describe('getHiderView', () => {
    it('performs a GET request with optional If-None-Match header and parses the response, including the ETag header', async () => {
      const { calls, fetchFn } = fakeFetch(200, '{"revision":3}', { ETag: '"abc"' });
      
      const result = await client(fetchFn).getHiderView('m1', 'alice', null);
      
      expect(calls[0].url).toBe('http://api/api/v1/matches/m1/views/hider/latest?account=alice');
      expect(result).toEqual({
        status: 200,
        body: { revision: 3 },
        etag: '"abc"'
      });
    });

    it('includes If-None-Match header when etag is provided', async () => {
      const { calls, fetchFn } = fakeFetch(304, null, { ETag: '"abc"' });
      
      await client(fetchFn).getHiderView('m1', 'alice', '"abc"');
      
      expect((calls[0].init?.headers as Record<string, string>)['If-None-Match']).toBe('"abc"');
      expect(calls[0].url).toBe('http://api/api/v1/matches/m1/views/hider/latest?account=alice');
    });
  });

  describe('isStaleRevision', () => {
    it('correctly identifies stale-revision responses', () => {
      expect(isStaleRevision({ status: 409, body: { error: 'STALE_REVISION', revision: 7 }, etag: null })).toBe(true);
      expect(isStaleRevision({ status: 409, body: { error: 'MATCH_FULL' }, etag: null })).toBe(false);
      expect(isStaleRevision({ status: 200, body: {}, etag: null })).toBe(false);
    });
  });

  describe('URL encoding', () => {
    it('encodes dynamic path and query components with encodeURIComponent', async () => {
      const { calls, fetchFn } = fakeFetch(200, '{}');
      
      // Test match ID encoding
      await client(fetchFn).getMatch('m1/with/slashes');
      expect(calls[0].url).toBe('http://api/api/v1/matches/m1%2Fwith%2Fslashes');
      
      // Test account encoding in query parameter
      await client(fetchFn).getHiderView('m1', 'alice with spaces', null);
      expect(calls[1].url).toBe('http://api/api/v1/matches/m1/views/hider/latest?account=alice%20with%20spaces');
      
      // Test intent ID encoding
      await client(fetchFn).cancelMove('m1', 'alice', 6, 'intent/with/slashes');
      expect(calls[2].url).toBe('http://api/api/v1/matches/m1/intents/intent%2Fwith%2Fslashes');
    });
  });

  describe('Content-Type header and JSON body', () => {
    it('includes Content-Type header for POST and DELETE requests with JSON stringified body', async () => {
      const { calls, fetchFn } = fakeFetch(200, '{}');
      
      await client(fetchFn).createMatch('host', 2, 1, 42);
      expect(calls[0].init?.headers).toHaveProperty('Content-Type', 'application/json');
      expect(typeof calls[0].init?.body).toBe('string');
      
      const { calls: calls2, fetchFn: fetchFn2 } = fakeFetch(200, '{}');
      await client(fetchFn2).cancelMove('m1', 'alice', 6, 'mv-3');
      expect(calls2[0].init?.headers).toHaveProperty('Content-Type', 'application/json');
      expect(typeof calls2[0].init?.body).toBe('string');
    });
  });
});