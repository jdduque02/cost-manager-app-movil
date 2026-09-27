/**
 * Tests de renderizado/comportamiento para src/components/ui/SegmentedControl.tsx
 * (toggle Lista/Calendario). No verifica el indicador deslizante en sí
 * (requiere `onLayout` con medidas reales, no disponibles en Jest) — cubre
 * el contrato: opciones renderizadas, `onChange` con el valor correcto, y
 * accesibilidad de la opción activa.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SegmentedControl, type SegmentedOption } from "../SegmentedControl";

type Tab = "lista" | "calendario";

const OPTIONS: SegmentedOption<Tab>[] = [
  { value: "lista", label: "Lista" },
  { value: "calendario", label: "Calendario" },
];

describe("SegmentedControl", () => {
  it("renderiza todas las opciones", () => {
    render(<SegmentedControl options={OPTIONS} value="lista" onChange={() => {}} />);
    expect(screen.getByText("Lista")).toBeTruthy();
    expect(screen.getByText("Calendario")).toBeTruthy();
  });

  it("marca la opción activa como seleccionada", () => {
    render(<SegmentedControl options={OPTIONS} value="calendario" onChange={() => {}} />);
    const buttons = screen.getAllByRole("button");
    const selected = buttons.filter((b) => b.props.accessibilityState?.selected);
    expect(selected).toHaveLength(1);
  });

  it("llama a onChange con el value de la opción presionada", () => {
    const onChange = jest.fn();
    render(<SegmentedControl options={OPTIONS} value="lista" onChange={onChange} />);
    fireEvent.press(screen.getByText("Calendario"));
    expect(onChange).toHaveBeenCalledWith("calendario");
  });
});
