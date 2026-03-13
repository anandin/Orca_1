/**
 * Admin email+password login endpoint.
 *
 * When OPENCLAW_ADMIN_EMAIL and OPENCLAW_ADMIN_PASSWORD are set as environment
 * variables, the gateway exposes POST /auth/login.  On success it returns the
 * gateway token so the browser can store it and use it for the WebSocket
 * handshake — no token copy-paste required.
 *
 * The endpoint is a no-op (404) when either env var is absent or when the
 * gateway token is unavailable (e.g. auth mode is "none").
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { safeEqualSecret } from "../security/secret-equal.js";
import {
  AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET,
  normalizeRateLimitClientIp,
  type AuthRateLimiter,
} from "./auth-rate-limit.js";
import {
  readJsonBodyOrError,
  sendJson,
  sendMethodNotAllowed,
  sendRateLimited,
  sendUnauthorized,
} from "./http-common.js";

export const AUTH_LOGIN_PATH = "/auth/login";
const MAX_BODY_BYTES = 4096;

export async function handleAuthLoginRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    /** Value of OPENCLAW_ADMIN_EMAIL env var (undefined = endpoint disabled). */
    adminEmail: string | undefined;
    /** Value of OPENCLAW_ADMIN_PASSWORD env var (undefined = endpoint disabled). */
    adminPassword: string | undefined;
    /** The resolved gateway token to return on successful login. */
    gatewayToken: string | undefined;
    rateLimiter?: AuthRateLimiter;
  },
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== AUTH_LOGIN_PATH) {
    return false;
  }

  const method = (req.method ?? "").toUpperCase();
  if (method !== "POST") {
    sendMethodNotAllowed(res, "POST");
    return true;
  }

  // Endpoint is inactive unless admin credentials and a gateway token are configured.
  if (!opts.adminEmail || !opts.adminPassword || !opts.gatewayToken) {
    sendJson(res, 404, { error: { message: "Not found", type: "not_found" } });
    return true;
  }

  // Rate-limit before reading the body to prevent DoS via large payloads.
  const clientIp = normalizeRateLimitClientIp(req.socket?.remoteAddress);
  if (opts.rateLimiter) {
    const check = opts.rateLimiter.check(clientIp, AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET);
    if (!check.allowed) {
      sendRateLimited(res, check.retryAfterMs);
      return true;
    }
  }

  const body = await readJsonBodyOrError(req, res, MAX_BODY_BYTES);
  if (body === undefined) {
    // readJsonBodyOrError already sent an error response.
    return true;
  }

  const parsed = body as Record<string, unknown>;
  const email = typeof parsed.email === "string" ? parsed.email : "";
  const password = typeof parsed.password === "string" ? parsed.password : "";

  const emailOk = safeEqualSecret(email, opts.adminEmail);
  const passwordOk = safeEqualSecret(password, opts.adminPassword);

  if (!emailOk || !passwordOk) {
    if (opts.rateLimiter) {
      opts.rateLimiter.recordFailure(clientIp, AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET);
    }
    sendUnauthorized(res);
    return true;
  }

  // Success — reset rate-limit counter and return the gateway token.
  if (opts.rateLimiter) {
    opts.rateLimiter.reset(clientIp, AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET);
  }
  sendJson(res, 200, { token: opts.gatewayToken });
  return true;
}
