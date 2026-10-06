/**
 * getTrm/getCachedTrm: la TRM se guarda como última conocida para consolidar
 * el patrimonio sin conexión (R6.5); sin ninguna guardada, null (R6.4).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTrm, getCachedTrm } from "../banking.api";
import { apiClient } from "../client";

jest.mock("../client", () => ({
  apiClient: { get: jest.fn() },
  isListPayload: jest.fn(),
  unwrapList: jest.fn(),
}));
jest.mock("@/database/local.repository", () => ({}));

const mockGet = apiClient.get as jest.Mock;
const TRM = { value: 4100.25, valid_from: "2026-10-03", valid_to: "2026-10-06", source: "datos.gov.co" };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("getTrm", () => {
  it("pide /currency/trm, toma data[0], convierte value a número y la guarda", async () => {
    mockGet.mockResolvedValueOnce({ data: [{ ...TRM, value: "4100.25" }] });

    expect(await getTrm()).toEqual(TRM);
    expect(mockGet).toHaveBeenCalledWith("/currency/trm");
    expect(await getCachedTrm()).toEqual(TRM);
  });

  it("sin conexión la última TRM guardada sigue disponible", async () => {
    mockGet.mockResolvedValueOnce({ data: [TRM] });
    await getTrm();
    mockGet.mockRejectedValueOnce(new Error("Network Error"));

    await expect(getTrm()).rejects.toThrow("Network Error");
    expect(await getCachedTrm()).toEqual(TRM);
  });

  it("una TRM inválida no se guarda ni pisa la anterior", async () => {
    mockGet.mockResolvedValueOnce({ data: [TRM] });
    await getTrm();
    mockGet.mockResolvedValueOnce({ data: [{ ...TRM, value: "abc" }] });

    await expect(getTrm()).rejects.toThrow();
    expect(await getCachedTrm()).toEqual(TRM);
  });
});

describe("getCachedTrm", () => {
  it("devuelve null si nunca se obtuvo o lo guardado está corrupto", async () => {
    expect(await getCachedTrm()).toBeNull();
    await AsyncStorage.setItem("sprig.trm.last", "{no-json");
    expect(await getCachedTrm()).toBeNull();
  });
});
