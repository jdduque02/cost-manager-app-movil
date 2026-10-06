/**
 * `capture_companies`/`assign_categories` viajan como string "true"/"false" en
 * el multipart; si no se pasan, no se envían (el backend aplica su default).
 */
import { uploadStatementImport } from "../statement-imports.api";
import { apiClient } from "../client";

jest.mock("../client", () => ({ apiClient: { post: jest.fn() } }));

const mockPost = apiClient.post as jest.Mock;
const file = { uri: "file:///a.pdf", name: "a.pdf", mimeType: "application/pdf" };

const sent = (field: string) => (mockPost.mock.calls[0][1] as FormData).get(field);

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ data: { id: 1, status: "pending" } });
});

it("envía assign_categories y capture_companies como string", async () => {
  await uploadStatementImport(7, [file], { assignCategories: true, captureCompanies: false });
  expect(sent("assign_categories")).toBe("true");
  expect(sent("capture_companies")).toBe("false");
});

it("no los envía si no se especifican", async () => {
  await uploadStatementImport(7, [file], {});
  expect(sent("assign_categories")).toBeNull();
  expect(sent("capture_companies")).toBeNull();
});
