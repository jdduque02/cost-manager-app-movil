/**
 * Tests de comportamiento para src/components/ui/CurrencyInput.tsx: parseo/
 * formato es-CO (ya existente, sin test previo), gate de foco/error, y el
 * ciclo de montos de muestra (placeholder animado) — sin verificar valores
 * animados en sí, solo el contrato observable: qué texto se muestra y
 * cuándo se congela/detiene.
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { useReducedMotion, shakeError } from "@/utils/animations";
import { CurrencyInput, SAMPLE_AMOUNTS } from "../CurrencyInput";

jest.mock("@/utils/animations", () => {
  const actual = jest.requireActual("@/utils/animations");
  return {
    ...actual,
    useReducedMotion: jest.fn(() => false),
    shakeError: jest.fn(),
  };
});

const mockUseReducedMotion = useReducedMotion as jest.Mock;
const mockShakeError = shakeError as jest.Mock;

beforeEach(() => {
  mockUseReducedMotion.mockReturnValue(false);
  mockShakeError.mockClear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("CurrencyInput", () => {
  it("formatea el valor crudo a miles es-CO", () => {
    render(<CurrencyInput value="1234567" onChangeValue={() => {}} />);
    expect(screen.getByDisplayValue("1.234.567")).toBeTruthy();
  });

  it("muestra la primera muestra cuando está vacío y sin foco", () => {
    render(<CurrencyInput value="" onChangeValue={() => {}} />);
    expect(screen.getByText(SAMPLE_AMOUNTS[0])).toBeTruthy();
  });

  it("cicla a la siguiente muestra tras el hold", () => {
    render(<CurrencyInput value="" onChangeValue={() => {}} />);
    act(() => {
      jest.advanceTimersByTime(2500 + 200 + 10);
    });
    expect(screen.getByText(SAMPLE_AMOUNTS[1])).toBeTruthy();
  });

  it("se congela en la primera muestra con reduced motion", () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<CurrencyInput value="" onChangeValue={() => {}} />);
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(screen.getByText(SAMPLE_AMOUNTS[0])).toBeTruthy();
  });

  it("deja de mostrar la muestra al enfocar el campo", () => {
    render(<CurrencyInput testID="amount-input" value="" onChangeValue={() => {}} />);
    const input = screen.getByTestId("amount-input");
    fireEvent(input, "focus");
    expect(screen.queryByText(SAMPLE_AMOUNTS[0])).toBeNull();
  });

  it("no muestra la muestra cuando ya hay un valor", () => {
    render(<CurrencyInput value="1000" onChangeValue={() => {}} />);
    expect(screen.queryByText(SAMPLE_AMOUNTS[0])).toBeNull();
  });

  it("dispara el shake solo cuando el error aparece", () => {
    const { rerender } = render(<CurrencyInput value="" onChangeValue={() => {}} />);
    expect(mockShakeError).not.toHaveBeenCalled();

    rerender(<CurrencyInput value="" onChangeValue={() => {}} error="Monto requerido" />);
    expect(mockShakeError).toHaveBeenCalledTimes(1);

    rerender(<CurrencyInput value="" onChangeValue={() => {}} error="Monto requerido" />);
    expect(mockShakeError).toHaveBeenCalledTimes(1);
  });
});
