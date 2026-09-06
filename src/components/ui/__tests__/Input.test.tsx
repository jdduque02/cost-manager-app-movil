/**
 * Tests de comportamiento de foco/error para src/components/ui/Input.tsx.
 * No verifica los valores animados (borde/shake) directamente — reanimated
 * no corre un hilo de UI real en Jest — pero sí que:
 *  - los callbacks onFocus/onBlur del consumidor se sigan invocando,
 *  - el texto de error se muestre,
 *  - el shake se dispare (vía el mock de `shakeError`) solo cuando el error
 *    pasa de vacío a tener texto, no en cada re-render con error presente.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { shakeError } from "@/utils/animations";
import { Input } from "../Input";

jest.mock("@/utils/animations", () => {
  const actual = jest.requireActual("@/utils/animations");
  return {
    ...actual,
    useReducedMotion: () => false,
    shakeError: jest.fn(),
  };
});

const mockShakeError = shakeError as jest.Mock;

beforeEach(() => {
  mockShakeError.mockClear();
});

describe("Input", () => {
  it("renderiza el label cuando se provee", () => {
    render(<Input label="Nombre" value="" onChangeText={() => {}} />);
    expect(screen.getByText("Nombre")).toBeTruthy();
  });

  it("muestra el texto de error", () => {
    render(<Input value="" onChangeText={() => {}} error="Campo requerido" />);
    expect(screen.getByText("Campo requerido")).toBeTruthy();
  });

  it("sigue invocando onFocus/onBlur del consumidor", () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    render(
      <Input
        testID="name-input"
        value=""
        onChangeText={() => {}}
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByTestId("name-input");
    fireEvent(input, "focus");
    fireEvent(input, "blur");
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("dispara el shake solo cuando el error aparece (vacío -> con texto)", () => {
    const { rerender } = render(<Input value="" onChangeText={() => {}} />);
    expect(mockShakeError).not.toHaveBeenCalled();

    rerender(<Input value="" onChangeText={() => {}} error="Requerido" />);
    expect(mockShakeError).toHaveBeenCalledTimes(1);

    rerender(<Input value="" onChangeText={() => {}} error="Requerido" />);
    expect(mockShakeError).toHaveBeenCalledTimes(1);
  });
});
