/**
 * Tests unitarios para src/api/client.ts
 *
 * Cubre: redactSensitive (función exportada pura)
 * Los interceptores de Axios requieren integración con el servidor,
 * por lo que se testean de forma aislada con mocks.
 */

import { redactSensitive } from "../client";

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
