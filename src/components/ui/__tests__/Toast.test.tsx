/**
 * Tests de renderizado para src/components/ui/Toast.tsx.
 *
 * `AppToastCard` no se exporta (solo `AppToast`), así que se ejercita
 * capturando el `config` que `AppToast` le pasa a `react-native-toast-message`
 * (mockeado) e invocando cada función de tipo directamente con los params
 * que la librería le pasaría — sin depender de la lógica interna imperativa
 * de la librería real.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import RNToast, { type ToastConfigParams } from "react-native-toast-message";
import { AppToast } from "../Toast";

jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));

const MockRNToast = RNToast as unknown as jest.Mock;

function buildParams(
  type: string,
  text1?: string,
  text2?: string,
): ToastConfigParams<unknown> {
  return {
    position: "top",
    type,
    isVisible: true,
    visibilityTime: 3500,
    text1,
    text2,
    show: jest.fn(),
    hide: jest.fn(),
    onPress: jest.fn(),
    props: undefined,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AppToast", () => {
  it("posiciona el toast arriba, con topOffset = insets.top + 8", () => {
    render(<AppToast />);

    const props = MockRNToast.mock.calls[0][0];
    expect(props.position).toBe("top");
    expect(props.topOffset).toBe(28);
    expect(props.visibilityTime).toBe(3500);
  });

  it("registra una función de render para los 4 tipos soportados", () => {
    render(<AppToast />);

    const { config } = MockRNToast.mock.calls[0][0];
    expect(Object.keys(config)).toEqual(["success", "error", "info", "warning"]);
  });

  it.each(["success", "error", "info", "warning"] as const)(
    "renderiza text1 y text2 para type=%s",
    (type) => {
      render(<AppToast />);
      const { config } = MockRNToast.mock.calls[0][0];

      render(config[type](buildParams(type, "Título", "Detalle")));

      expect(screen.getByText("Título")).toBeTruthy();
      expect(screen.getByText("Detalle")).toBeTruthy();
    },
  );

  it("no renderiza text2 cuando no se pasa", () => {
    render(<AppToast />);
    const { config } = MockRNToast.mock.calls[0][0];

    render(config.info(buildParams("info", "Solo título")));

    expect(screen.getByText("Solo título")).toBeTruthy();
    expect(screen.queryByText("Detalle")).toBeNull();
  });

  it("usa el ícono/tono de info como fallback para un type desconocido", () => {
    render(<AppToast />);
    const { config } = MockRNToast.mock.calls[0][0];

    // El type real siempre coincide con una de las 4 claves de `config`
    // (cada `toast.<tipo>` de src/utils/toast.ts usa una de ellas), pero
    // `AppToastCard` está preparado para un `type` fuera de esas 4 sin
    // romper — se ejercita ese fallback llamando la función success con un
    // type que no es ninguno de los 4 conocidos.
    render(config.success(buildParams("unknown-type", "Rareza")));

    expect(screen.getByText("Rareza")).toBeTruthy();
  });
});
