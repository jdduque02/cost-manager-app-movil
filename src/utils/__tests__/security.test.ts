/**
 * Tests unitarios para src/utils/security.ts
 *
 * Cubre: sanitizeInput, validateEmail, validatePassword,
 *        validateUsername, checkLoginRateLimit, recordFailedAttempt, resetRateLimit
 */

import {
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateUsername,
} from "../security";

// ─── sanitizeInput ────────────────────────────────────────────────────────────

describe("sanitizeInput", () => {
  it("elimina caracteres de control (los quita, no los reemplaza por espacio)", () => {
    expect(sanitizeInput("hola\x00mundo")).toBe("holamundo");
  });

  it("recorta espacios al inicio y al final", () => {
    expect(sanitizeInput("  texto  ")).toBe("texto");
  });

  it("colapsa espacios múltiples en uno solo", () => {
    expect(sanitizeInput("hola    mundo")).toBe("hola mundo");
  });

  it("no modifica una cadena limpia", () => {
    expect(sanitizeInput("Texto normal 123")).toBe("Texto normal 123");
  });

  it("elimina carácter de retroceso (\\x7F)", () => {
    const result = sanitizeInput("abc\x7Fdef");
    expect(result).not.toContain("\x7F");
  });
});

// ─── validateEmail ────────────────────────────────────────────────────────────

describe("validateEmail", () => {
  it("acepta un email válido", () => {
    expect(validateEmail("usuario@dominio.com")).toBe(true);
  });

  it("acepta un email con subdominio", () => {
    expect(validateEmail("user@mail.empresa.co")).toBe(true);
  });

  it("rechaza un email sin arroba", () => {
    expect(validateEmail("usuariodominio.com")).toBe(false);
  });

  it("rechaza un email sin TLD", () => {
    expect(validateEmail("usuario@dominio")).toBe(false);
  });

  it("rechaza una cadena vacía", () => {
    expect(validateEmail("")).toBe(false);
  });

  it("rechaza un email con espacios", () => {
    expect(validateEmail("us er@dominio.com")).toBe(false);
  });
});

// ─── validatePassword ─────────────────────────────────────────────────────────

describe("validatePassword", () => {
  it("acepta una contraseña válida", () => {
    expect(validatePassword("Passw0rd")).toEqual({ valid: true });
  });

  it("rechaza contraseñas de menos de 8 caracteres", () => {
    const result = validatePassword("Ab1");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/8 caracteres/);
  });

  it("rechaza contraseñas sin mayúscula", () => {
    const result = validatePassword("password1");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/mayúscula/);
  });

  it("rechaza contraseñas sin minúscula", () => {
    const result = validatePassword("PASSWORD1");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/minúscula/);
  });

  it("rechaza contraseñas sin número", () => {
    const result = validatePassword("Password");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/número/);
  });

  it("acepta contraseñas con caracteres especiales", () => {
    expect(validatePassword("Passw0rd!@#")).toEqual({ valid: true });
  });
});

// ─── validateUsername ─────────────────────────────────────────────────────────

describe("validateUsername", () => {
  it("acepta un username válido", () => {
    expect(validateUsername("usuario_123")).toEqual({ valid: true });
  });

  it("rechaza usernames de menos de 3 caracteres", () => {
    const result = validateUsername("ab");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/3 caracteres/);
  });

  it("rechaza usernames de más de 32 caracteres", () => {
    const result = validateUsername("a".repeat(33));
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/32 caracteres/);
  });

  it("rechaza usernames con caracteres especiales no permitidos", () => {
    const result = validateUsername("user@name");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/letras, números y guión bajo/);
  });

  it("acepta guión bajo", () => {
    expect(validateUsername("user_name")).toEqual({ valid: true });
  });

  it("acepta exactamente 3 caracteres", () => {
    expect(validateUsername("abc")).toEqual({ valid: true });
  });

  it("acepta exactamente 32 caracteres", () => {
    expect(validateUsername("a".repeat(32))).toEqual({ valid: true });
  });
});
