/**
 * Client for the hider-seeker move API.
 * Every call resolves to the status, the parsed JSON body (null when there is none, for example a 304)
 * and the ETag header.
 */

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface HsResponse {
  status: number;
  body: any;
  etag: string | null;
}

export type PlayMode = "PLAY" | "QUEUE";

export interface HsClient {
  createMatch(account: string, hiderCount: number, npcHiders: number, seed: number): Promise<HsResponse>;
  getMatch(matchId: string): Promise<HsResponse>;
  joinMatch(matchId: string, account: string, expectedRevision: number): Promise<HsResponse>;
  startMatch(matchId: string, account: string, expectedRevision: number): Promise<HsResponse>;
  getHiderView(matchId: string, account: string, etag: string | null): Promise<HsResponse>;
  getPublicView(matchId: string, etag: string | null): Promise<HsResponse>;
  submitMove(matchId: string, account: string, expectedRevision: number, playMode: PlayMode, intent: object): Promise<HsResponse>;
  passTicks(matchId: string, account: string, expectedRevision: number, ticks: number): Promise<HsResponse>;
  cancelMove(matchId: string, account: string, expectedRevision: number, intentId: string): Promise<HsResponse>;
}

// Reads a fetch Response into an HsResponse.
async function toHsResponse(response: Response): Promise<HsResponse> {
  const text = await response.text();
  return {
    status: response.status,
    body: text === "" ? null : JSON.parse(text),
    etag: response.headers.get("ETag") ?? null,
  };
}

/**
 * apiBase is the API_BASE global; newKey makes one idempotency key per request
 */
export function createHsClient(apiBase: string, fetchFn: FetchFn, newKey: () => string): HsClient {
  const client: HsClient = {
    async createMatch(account, hiderCount, npcHiders, seed) {
      const url = `${apiBase}/api/v1/matches`;
      const payload = { account, hider_count: hiderCount, npc_hiders: npcHiders, seed };
      const init: RequestInit = {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };
      return toHsResponse(await fetchFn(url, init));
    },

    async getMatch(matchId) {
      const url = `${apiBase}/api/v1/matches/${encodeURIComponent(matchId)}`;
      return toHsResponse(await fetchFn(url));
    },

    async joinMatch(matchId, account, expectedRevision) {
      const url = `${apiBase}/api/v1/matches/${encodeURIComponent(matchId)}/join`;
      const idempotencyKey = newKey();
      const payload = { account, expected_revision: expectedRevision, idempotency_key: idempotencyKey };
      const init: RequestInit = {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };
      return toHsResponse(await fetchFn(url, init));
    },

    async startMatch(matchId, account, expectedRevision) {
      const url = `${apiBase}/api/v1/matches/${encodeURIComponent(matchId)}/start`;
      const idempotencyKey = newKey();
      const payload = { account, expected_revision: expectedRevision, idempotency_key: idempotencyKey };
      const init: RequestInit = {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };
      return toHsResponse(await fetchFn(url, init));
    },

    async getHiderView(matchId, account, etag) {
      const url = `${apiBase}/api/v1/matches/${encodeURIComponent(matchId)}/views/hider/latest?account=${encodeURIComponent(account)}`;
      const init: RequestInit = {};
      if (etag !== null) {
        init.headers = { "If-None-Match": etag };
      }
      return toHsResponse(await fetchFn(url, init));
    },

    async getPublicView(matchId, etag) {
      const url = `${apiBase}/api/v1/matches/${encodeURIComponent(matchId)}/views/public/latest`;
      const init: RequestInit = {};
      if (etag !== null) {
        init.headers = { "If-None-Match": etag };
      }
      return toHsResponse(await fetchFn(url, init));
    },

    async submitMove(matchId, account, expectedRevision, playMode, intent) {
      const url = `${apiBase}/api/v1/matches/${encodeURIComponent(matchId)}/intents`;
      const idempotencyKey = newKey();
      const payload = { 
        account, 
        expected_revision: expectedRevision, 
        idempotency_key: idempotencyKey,
        play_mode: playMode,
        intent
      };
      const init: RequestInit = {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };
      return toHsResponse(await fetchFn(url, init));
    },

    async passTicks(matchId, account, expectedRevision, ticks) {
      const url = `${apiBase}/api/v1/matches/${encodeURIComponent(matchId)}/intents`;
      const idempotencyKey = newKey();
      const payload = { 
        account, 
        expected_revision: expectedRevision, 
        idempotency_key: idempotencyKey,
        play_mode: "PASS",
        intent: { type: "PASS" },
        ticks
      };
      const init: RequestInit = {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };
      return toHsResponse(await fetchFn(url, init));
    },

    async cancelMove(matchId, account, expectedRevision, intentId) {
      const url = `${apiBase}/api/v1/matches/${encodeURIComponent(matchId)}/intents/${encodeURIComponent(intentId)}`;
      const idempotencyKey = newKey();
      const payload = { 
        account, 
        expected_revision: expectedRevision, 
        idempotency_key: idempotencyKey
      };
      const init: RequestInit = {
        method: 'DELETE',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };
      return toHsResponse(await fetchFn(url, init));
    }
  };

  return client;
}

/**
 * Returns true only when response.status === 409 and response.body?.error === "STALE_REVISION" 
 * and response.body?.revision is a number.
 */
export function isStaleRevision(response: HsResponse): boolean {
  return response.status === 409 && 
         response.body?.error === "STALE_REVISION" && 
         typeof response.body?.revision === "number";
}