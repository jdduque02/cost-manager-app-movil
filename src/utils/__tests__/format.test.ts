import { formatDateTime } from "../format";
import { formatEventDetails } from "@/screens/AccessHistoryScreen";

describe("formatDateTime", () => {
  it("acepta epoch en ms como string (Keycloak) igual que ISO", () => {
    const ms = Date.UTC(2026, 8, 25, 15, 30);
    expect(formatDateTime(String(ms))).toBe(formatDateTime(new Date(ms).toISOString()));
    expect(formatDateTime(String(ms))).not.toBe("—");
  });

  it("null o inválido → '—' (lastAccess puede venir null)", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("no-es-fecha")).toBe("—");
  });
});

describe("formatEventDetails", () => {
  it("aplana el objeto de Keycloak a texto (nunca un objeto como child de <Text>)", () => {
    expect(
      formatEventDetails({ username: "ana", auth_method: "openid-connect", empty: "", n: null }),
    ).toBe("username: ana · auth_method: openid-connect");
    expect(formatEventDetails({ nested: { a: 1 } })).toBe('nested: {"a":1}');
    expect(formatEventDetails({})).toBe("");
  });
});
