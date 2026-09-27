/**
 * Tests unitarios para src/api/client.ts
 *
 * Cubre: redactSensitive (función exportada pura)
 * Los interceptores de Axios requieren integración con el servidor,
 * por lo que se testean de forma aislada con mocks.
 */

import { AxiosError, AxiosHeaders } from "axios";
import {
  redactSensitive,
  classifyApiError,
  isQueueableError,
  apiErrorMessage,
  BLOCKED_NETWORK_MESSAGE,
  SessionExpiredError,
} from "../client";

const httpError = (status: number, data: unknown) =>
  new AxiosError(`status ${status}`, "ERR_BAD_REQUEST", undefined, null, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

// ─── classifyApiError / isQueueableError / apiErrorMessage ────────────────────

describe("classifyApiError", () => {
  it("sin respuesta (red/timeout) → network, encolable", () => {
    const err = new AxiosError("timeout", "ECONNABORTED");
    expect(classifyApiError(err)).toBe("network");
    expect(isQueueableError(err)).toBe(true);
  });

  it("403 con cuerpo HTML (Cloud Armor) → blocked, no encolable", () => {
    const err = httpError(403, "<!doctype html><title>403 Forbidden</title>");
    expect(classifyApiError(err)).toBe("blocked");
    expect(isQueueableError(err)).toBe(false);
    expect(apiErrorMessage(err, "x")).toBe(BLOCKED_NETWORK_MESSAGE);
  });

  it("403 con el JSON del API (p. ej. OwnershipGuard) → client, no blocked", () => {
    const err = httpError(403, { status: 403, message: "Sin permiso", timestamp: "t" });
    expect(classifyApiError(err)).toBe("client");
    expect(apiErrorMessage(err, "x")).toBe("Sin permiso");
  });

  it("400 → client, no encolable; sin message usa el fallback", () => {
    const err = httpError(400, { status: 400, timestamp: "t" });
    expect(classifyApiError(err)).toBe("client");
    expect(isQueueableError(err)).toBe(false);
    expect(apiErrorMessage(err, "fallback")).toBe("fallback");
  });

  it("apiErrorMessage ignora claves i18n sin traducir y message vacío", () => {
    expect(apiErrorMessage(httpError(401, { message: "auth.CREDENTIALS_INVALID", timestamp: "t" }), "fb")).toBe("fb");
    expect(apiErrorMessage(httpError(400, { message: "", timestamp: "t" }), "fb")).toBe("fb");
  });

  it("5xx (aunque sea HTML del balanceador) → server, encolable", () => {
    const err = httpError(502, "<html>Bad Gateway</html>");
    expect(classifyApiError(err)).toBe("server");
    expect(isQueueableError(err)).toBe(true);
  });

  it("408 y 429 son transitorios → server, encolables", () => {
    for (const status of [408, 429]) {
      const err = httpError(status, { message: "x", timestamp: "t" });
      expect(classifyApiError(err)).toBe("server");
      expect(isQueueableError(err)).toBe(true);
    }
  });

  it("errores que no son de axios → null, no encolables", () => {
    expect(classifyApiError(new SessionExpiredError())).toBeNull();
    expect(classifyApiError(new Error("SQLite"))).toBeNull();
    expect(isQueueableError(new Error("SQLite"))).toBe(false);
  });
});

// ─── redactSensitive ──────────────────────────────────────────────────────────

describe("redactSensitive", () => {
  it("redacta el campo 'password'", () => {
    const result = redactSensitive({
      password: "secreto123",
      username: "user",
    });
    expect(result.password).toBe("[REDACTED]");
    expect(result.username).toBe("user");
  });

  it("redacta el campo 'access_token'", () => {
    const result = redactSensitive({ access_token: "eyJabc...", status: true });
    expect(result.access_token).toBe("[REDACTED]");
    expect(result.status).toBe(true);
  });

  it("redacta el campo 'refresh_token'", () => {
    const result = redactSensitive({ refresh_token: "abc123" });
    expect(result.refresh_token).toBe("[REDACTED]");
  });

  it("redacta el campo 'token'", () => {
    const result = redactSensitive({ token: "tok", data: "ok" });
    expect(result.token).toBe("[REDACTED]");
    expect(result.data).toBe("ok");
  });

  it("no modifica campos no sensibles", () => {
    const obj = { name: "Juan", amount: 100, currency: "COP" };
    const result = redactSensitive(obj as unknown as Record<string, unknown>);
    expect(result).toEqual(obj);
  });

  it("redacta campos con 'password' como subcadena (p.ej. confirm_password)", () => {
    const result = redactSensitive({ confirm_password: "abc" });
    expect(result.confirm_password).toBe("[REDACTED]");
  });

  it("no muta el objeto original", () => {
    const original = { password: "secret", name: "test" };
    redactSensitive(original as unknown as Record<string, unknown>);
    expect(original.password).toBe("secret");
  });

  it("maneja objetos vacíos sin lanzar error", () => {
    expect(redactSensitive({})).toEqual({});
  });
});
