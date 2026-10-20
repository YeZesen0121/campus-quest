/**
 * The inline register leg's wire pins (send-code-as-entry batch
 * 2026-10-19; path untouched by the unified-login batch — spec §3.3):
 * POST /auth/mobile-code/register {register_token, student_number,
 * password:null-when-unset} answers the ④ envelope {user, tokens} and
 * the wrapper adopts the envelope's tokens. The login wrappers that
 * lived here retired with the unified page (the challenge family in
 * api.ts carries them now — unified-challenge-api.test.ts).
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/accessToken";
import { ApiError } from "../lib/errors";
import {
  approveStudent,
  listPendingStudents,
  registerViaMobileCode,
  rejectStudent,
} from "../features/auth/mobileLoginApi";

const originalFetch = globalThis.fetch;
let responseFor: () => Response;
let recorded: {
  url: string;
  method: string;
  credentials: RequestCredentials | undefined;
  headers: Headers;
  body: string | null;
} | undefined;

function stubFetch(body: string, status: number) {
  responseFor = () => new Response(body.length > 0 ? body : null, { status });
}

beforeEach(() => {
  clearAccessToken();
  recorded = undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    recorded = {
      url: String(input),
      method: (init?.method ?? "GET").toUpperCase(),
      credentials: init?.credentials,
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : null,
    };
    return responseFor();
  }) as typeof fetch;
});

afterEach(() => {
  clearAccessToken();
  globalThis.fetch = originalFetch;
});

describe("administrator registration approvals (§5)", () => {
  const pending = {
    id: "pending-student",
    username: "20240099",
    nickname: "模拟待审学生",
    role: "STUDENT",
    status: "PENDING_APPROVAL",
    phone_masked: "+861****5555",
    created_at: "2026-10-20T00:00:00Z",
  };

  test("the queue uses the pending-status filter and preserves the server-masked row", async () => {
    setAccessToken("admin-at");
    stubFetch(JSON.stringify({ items: [pending] }), 200);

    assert.deepEqual(await listPendingStudents(), { items: [pending] });
    assert.equal(recorded?.url, "/api/v1/admin/users?status=PENDING_APPROVAL");
    assert.equal(recorded?.method, "GET");
    assert.equal(recorded?.body, null);
    assert.equal(recorded?.credentials, "include");
    assert.equal(recorded?.headers.get("authorization"), "Bearer admin-at");
    assert.equal(getAccessToken(), "admin-at");
  });

  test("approve encodes the target and returns its verdict without adopting the student's identity", async () => {
    setAccessToken("admin-at");
    const approved = { ...pending, id: "student/a?b=1", status: "ACTIVE" };
    stubFetch(JSON.stringify(approved), 200);

    assert.deepEqual(await approveStudent(approved.id), approved);
    assert.equal(recorded?.url, "/api/v1/admin/users/student%2Fa%3Fb%3D1/approve");
    assert.equal(recorded?.method, "POST");
    assert.equal(recorded?.body, null);
    assert.equal(recorded?.headers.get("authorization"), "Bearer admin-at");
    assert.equal(getAccessToken(), "admin-at");
  });

  for (const reason of ["资料需重新核对", null]) {
    test(`reject carries ${reason === null ? "an unset" : "the supplied"} audit reason and preserves the admin session`, async () => {
      setAccessToken("admin-at");
      const rejected = { ...pending, status: "BANNED" };
      stubFetch(JSON.stringify(rejected), 200);

      assert.deepEqual(await rejectStudent(pending.id, reason), rejected);
      assert.equal(recorded?.url, "/api/v1/admin/users/pending-student/reject");
      assert.equal(recorded?.method, "POST");
      assert.deepEqual(JSON.parse(recorded?.body ?? "{}"), { reason });
      assert.equal(recorded?.headers.get("authorization"), "Bearer admin-at");
      assert.equal(getAccessToken(), "admin-at");
    });
  }

  test("a denied approval propagates the server code and request ID without logging the admin out", async () => {
    setAccessToken("admin-at");
    stubFetch(JSON.stringify({ error: { code: "PERMISSION_DENIED", message: "没有注册审批权限", request_id: "approval-denied" } }), 403);

    await assert.rejects(() => approveStudent(pending.id), (error: unknown) =>
      error instanceof ApiError && error.code === "PERMISSION_DENIED" && error.requestId === "approval-denied");
    assert.equal(getAccessToken(), "admin-at");
  });
});

describe("the inline register leg (send-code-as-entry; the register_token now arrives via /auth/challenge/verify)", () => {
  test("register POSTs {register_token, student_number, password:null-when-unset} and adopts the ENVELOPE's tokens", async () => {
    clearAccessToken();
    stubFetch(
      JSON.stringify({
        user: { id: "u9", username: "20240099", nickname: "20240099", role: "STUDENT", status: "PENDING_APPROVAL" },
        tokens: { access_token: "reg-at", csrf_token: "ct", token_type: "bearer" },
      }),
      201,
    );
    const outcome = await registerViaMobileCode("reg-tok", "20240099", null);
    assert.equal(outcome.kind, "tokens");
    assert.equal(getAccessToken(), "reg-at");
    assert.equal(recorded?.url, "/api/v1/auth/mobile-code/register");
    assert.equal(recorded?.method, "POST");
    assert.deepEqual(JSON.parse(recorded?.body ?? "{}"), {
      register_token: "reg-tok",
      student_number: "20240099",
      password: null,
    });
  });

  test("register with a set password carries it verbatim", async () => {
    clearAccessToken();
    stubFetch(
      JSON.stringify({
        user: { id: "u9", username: "20240099", nickname: "20240099", role: "STUDENT", status: "PENDING_APPROVAL" },
        tokens: { access_token: "reg-at", csrf_token: "ct", token_type: "bearer" },
      }),
      201,
    );
    await registerViaMobileCode("reg-tok", "20240099", "e2e-correct-horse");
    assert.deepEqual(JSON.parse(recorded?.body ?? "{}"), {
      register_token: "reg-tok",
      student_number: "20240099",
      password: "e2e-correct-horse",
    });
  });

  test("a 201 without the envelope is a broken contract and throws", async () => {
    clearAccessToken();
    stubFetch(JSON.stringify({ user: { id: "u9" } }), 201);
    await assert.rejects(() => registerViaMobileCode("reg-tok", "20240099", null), /envelope/);
    assert.equal(getAccessToken(), null);
  });
});
