import assert from "node:assert/strict";
import test from "node:test";

const { trackItUpWorkspace } = await import("../constants/TrackItUpData.ts");
const { isTrustedSyncEndpoint, pullWorkspaceSync, pushWorkspaceSync } =
  await import("../services/offline/workspaceSync.ts");

function createSnapshot(overrides = {}) {
  return {
    ...structuredClone(trackItUpWorkspace),
    ...overrides,
  };
}

test("trusted sync endpoints require localhost or an explicit HTTPS host allowlist", () => {
  assert.equal(isTrustedSyncEndpoint("https://api.example.com/sync"), false);
  assert.equal(
    isTrustedSyncEndpoint("https://api.example.com/sync", {
      allowedHosts: ["api.example.com"],
    }),
    true,
  );
  assert.equal(
    isTrustedSyncEndpoint("https://sub.api.example.com/sync", {
      allowedHosts: ["*.api.example.com"],
    }),
    true,
  );
  assert.equal(isTrustedSyncEndpoint("http://localhost:3000/sync"), true);
  assert.equal(isTrustedSyncEndpoint("http://127.0.0.1:3000/sync"), true);
  assert.equal(
    isTrustedSyncEndpoint("https://user:pass@example.com/sync", {
      allowedHosts: ["example.com"],
    }),
    false,
  );
  assert.equal(isTrustedSyncEndpoint("http://example.com/sync"), false);
  assert.equal(isTrustedSyncEndpoint("not-a-url"), false);
});

test("pushWorkspaceSync retries retryable failures and sends protocol metadata", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;

  globalThis.fetch = async (_input, init) => {
    requestCount += 1;
    const headers = init?.headers;
    const payload = JSON.parse(String(init?.body));

    assert.equal(init?.method, "POST");
    assert.equal(headers["x-trackitup-sync-version"], "1");
    assert.equal(payload.protocolVersion, "1");

    if (requestCount === 1) {
      return new Response("retry", { status: 503 });
    }

    return new Response(null, {
      status: 200,
      headers: { "x-trackitup-sync-version": "1" },
    });
  };

  try {
    const result = await pushWorkspaceSync({
      endpoint: "https://example.com/api/trackitup-sync",
      snapshot: createSnapshot({
        syncQueue: [
          {
            id: "sync-1",
            kind: "log-created",
            summary: "Saved reef check",
            createdAt: "2026-03-10T12:00:00.000Z",
          },
        ],
      }),
      userId: "user_123",
      getToken: async () => "token-123",
    });

    assert.equal(requestCount, 2);
    assert.equal(result.status, "success");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pullWorkspaceSync includes version metadata and rejects incompatible responses", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const headers = init?.headers;

    assert.match(String(input), /mode=pull/);
    assert.match(String(input), /version=1/);
    assert.doesNotMatch(String(input), /userId=/);
    assert.equal(init?.method, "GET");
    assert.equal(headers["x-trackitup-sync-version"], "1");
    assert.equal(headers["x-trackitup-user-id"], "user_123");

    return new Response(
      JSON.stringify({
        protocolVersion: "2",
        snapshot: createSnapshot(),
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    const result = await pullWorkspaceSync({
      endpoint: "https://example.com/api/trackitup-sync",
      fallbackSnapshot: trackItUpWorkspace,
      userId: "user_123",
      getToken: async () => "token-123",
    });

    assert.equal(result.status, "error");
    assert.match(result.message, /incompatible sync protocol version/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pullWorkspaceSync rejects non-JSON responses", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return new Response("<html>not json</html>", {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-trackitup-sync-version": "1",
      },
    });
  };

  try {
    const result = await pullWorkspaceSync({
      endpoint: "https://example.com/api/trackitup-sync",
      fallbackSnapshot: trackItUpWorkspace,
      userId: "user_123",
      getToken: async () => "token-123",
    });

    assert.equal(result.status, "error");
    assert.match(result.message, /unexpected response format/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pushWorkspaceSync blocks before network requests when no auth token is available", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(null, { status: 200 });
  };

  try {
    const result = await pushWorkspaceSync({
      endpoint: "https://example.com/api/trackitup-sync",
      snapshot: createSnapshot(),
      userId: "user_123",
      getToken: async () => null,
    });

    assert.equal(result.status, "blocked");
    assert.match(result.message, /refresh your secure sync session/i);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pullWorkspaceSync blocks before network requests when no auth token is available", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(null, { status: 200 });
  };

  try {
    const result = await pullWorkspaceSync({
      endpoint: "https://example.com/api/trackitup-sync",
      fallbackSnapshot: trackItUpWorkspace,
      userId: "user_123",
      getToken: async () => null,
    });

    assert.equal(result.status, "blocked");
    assert.match(result.message, /refresh your secure sync session/i);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
