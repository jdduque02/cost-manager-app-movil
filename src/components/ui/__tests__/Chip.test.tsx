/**
 * Tests de renderizado/comportamiento para src/components/ui/Chip.tsx
 *
 * No verifica valores animados (reanimated no corre un hilo de UI real en
 * Jest) — verifica el contrato observable: label, estado seleccionado
 * expuesto a accesibilidad, y que `onPress` se dispare.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Chip } from "../Chip";

describe("Chip", () => {
  it("renderiza el label", () => {
    render(<Chip label="Gasto" selected={false} onPress={() => {}} />);
    expect(screen.getByText("Gasto")).toBeTruthy();
  });

  it("expone el estado seleccionado a accesibilidad", () => {
    render(<Chip label="Ingreso" selected onPress={() => {}} />);
    expect(screen.getByRole("button").props.accessibilityState).toEqual({ selected: true });
  });

  it("expone selected: false cuando no está activo", () => {
    render(<Chip label="Ingreso" selected={false} onPress={() => {}} />);
    expect(screen.getByRole("button").props.accessibilityState).toEqual({ selected: false });
  });

  it("llama a onPress al presionar", () => {
    const onPress = jest.fn();
    render(<Chip label="Todas" selected={false} onPress={onPress} />);
    fireEvent.press(screen.getByText("Todas"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
