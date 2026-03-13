import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleAuthLoginRequest } from "./auth-login.js";
import { getPairedDevice } from "../infra/device-pairing.js";

/** Starts a one-shot HTTP server that calls handleAuthLoginRequest and returns the result. */
async function startLoginServer(opts: {
  adminEmail?: string;
  adminPassword?: string;
  gatewayToken?: string;
  baseDir?: string;
}): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      await handleAuthLoginRequest(req, res, {
        adminEmail: opts.adminEmail,
        adminPassword: opts.adminPassword,
        gatewayToken: opts.gatewayToken ?? "test-token-123",
        baseDir: opts.baseDir,
      });
    },
  );

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };

  return {
    port: addr.port,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}

async function post(port: number, path: string, body: unknown) {
  const json = JSON.stringify(body);
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json,
  });
  return { status: res.status, body: await res.json() };
}

describe("handleAuthLoginRequest", () => {
  let server: { port: number; close: () => Promise<void> };
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "auth-login-test-"));
  });

  afterEach(async () => {
    await server?.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns 404 when admin credentials are not configured", async () => {
    server = await startLoginServer({ baseDir: tmpDir });
    const { status } = await post(server.port, "/auth/login", { email: "a@b.com", password: "pw" });
    expect(status).toBe(404);
  });

  it("returns 401 for wrong password", async () => {
    server = await startLoginServer({
      adminEmail: "admin@example.com",
      adminPassword: "correct",
      baseDir: tmpDir,
    });
    const { status } = await post(server.port, "/auth/login", {
      email: "admin@example.com",
      password: "wrong",
    });
    expect(status).toBe(401);
  });

  it("returns 200 and token for correct credentials", async () => {
    server = await startLoginServer({
      adminEmail: "admin@example.com",
      adminPassword: "secret",
      gatewayToken: "my-token",
      baseDir: tmpDir,
    });
    const { status, body } = await post(server.port, "/auth/login", {
      email: "admin@example.com",
      password: "secret",
    });
    expect(status).toBe(200);
    expect((body as { token: string }).token).toBe("my-token");
  });

  it("login is case-insensitive for email", async () => {
    server = await startLoginServer({
      adminEmail: "Admin@Example.COM",
      adminPassword: "secret",
      gatewayToken: "my-token",
      baseDir: tmpDir,
    });
    const { status } = await post(server.port, "/auth/login", {
      email: "admin@example.com",
      password: "secret",
    });
    expect(status).toBe(200);
  });

  it("auto-pairs the device when deviceId and publicKey are provided on success", async () => {
    // A real (but arbitrary) Ed25519 public key fingerprint + base64url-encoded key.
    // Values generated offline for test reproducibility.
    const publicKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 32 zero bytes base64url
    // SHA-256 of the 32-zero-byte key (pre-computed):
    const deviceId = "66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925";

    server = await startLoginServer({
      adminEmail: "admin@example.com",
      adminPassword: "secret",
      gatewayToken: "my-token",
      baseDir: tmpDir,
    });

    const { status } = await post(server.port, "/auth/login", {
      email: "admin@example.com",
      password: "secret",
      deviceId,
      publicKey,
    });
    expect(status).toBe(200);

    // Device should now be in the paired list.
    const paired = await getPairedDevice(deviceId, tmpDir);
    expect(paired).not.toBeNull();
    expect(paired?.deviceId).toBe(deviceId);
    expect(paired?.publicKey).toBe(publicKey);
  });

  it("returns 200 even when deviceId/publicKey are omitted (graceful no-pair)", async () => {
    server = await startLoginServer({
      adminEmail: "admin@example.com",
      adminPassword: "secret",
      gatewayToken: "my-token",
      baseDir: tmpDir,
    });
    const { status, body } = await post(server.port, "/auth/login", {
      email: "admin@example.com",
      password: "secret",
    });
    expect(status).toBe(200);
    expect((body as { token: string }).token).toBe("my-token");
  });
});
