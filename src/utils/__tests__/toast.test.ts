/**
 * Tests unitarios para src/utils/toast.ts — verifica que `toast.<tipo>` y
 * `showToast` deleguen en `react-native-toast-message` con el `type` y
 * textos correctos, y que `hide()` delegue en `RNToast.hide`.
 */
import RNToast from "react-native-toast-message";
import { toast, showToast } from "../toast";

jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));

const mockShow = RNToast.show as jest.Mock;
const mockHide = RNToast.hide as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("toast", () => {
  it("success llama a RNToast.show con type success", () => {
    toast.success("Guardado", "Detalle");
    expect(mockShow).toHaveBeenCalledWith({ type: "success", text1: "Guardado", text2: "Detalle" });
  });

  it("error llama a RNToast.show con type error", () => {
    toast.error("Falló", "Detalle");
    expect(mockShow).toHaveBeenCalledWith({ type: "error", text1: "Falló", text2: "Detalle" });
  });

  it("info llama a RNToast.show con type info", () => {
    toast.info("Info");
    expect(mockShow).toHaveBeenCalledWith({ type: "info", text1: "Info", text2: undefined });
  });

  it("warning llama a RNToast.show con type warning", () => {
    toast.warning("Cuidado");
    expect(mockShow).toHaveBeenCalledWith({ type: "warning", text1: "Cuidado", text2: undefined });
  });

  it("hide llama a RNToast.hide", () => {
    toast.hide();
    expect(mockHide).toHaveBeenCalledTimes(1);
  });
});

describe("showToast", () => {
  it("delega en toast[type] con el type explícito", () => {
    showToast("error", "Algo pasó", "Reintenta");
    expect(mockShow).toHaveBeenCalledWith({
      type: "error",
      text1: "Algo pasó",
      text2: "Reintenta",
    });
  });
});
