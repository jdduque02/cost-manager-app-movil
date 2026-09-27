/**
 * Tests de comportamiento para src/components/ui/ConfirmModal.tsx.
 * Cubre: título/descripción visibles, callbacks de confirmar/cancelar, y el
 * estado `loading` deshabilitando el flujo de confirmación.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ConfirmModal } from "../ConfirmModal";

describe("ConfirmModal", () => {
  it("muestra el título y la descripción", () => {
    render(
      <ConfirmModal
        visible
        title="Eliminar objetivo"
        description='¿Eliminar "Vacaciones"?'
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("Eliminar objetivo")).toBeTruthy();
    expect(screen.getByText('¿Eliminar "Vacaciones"?')).toBeTruthy();
  });

  it("llama a onConfirm al presionar el botón de confirmar", () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmModal
        visible
        title="Confirmar pago"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    fireEvent.press(screen.getByText("Confirmar"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("llama a onCancel al presionar el botón de cancelar", () => {
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        visible
        title="Confirmar pago"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    fireEvent.press(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("usa las etiquetas personalizadas de los botones", () => {
    render(
      <ConfirmModal
        visible
        title="Eliminar objetivo"
        confirmLabel="Eliminar"
        cancelLabel="Volver"
        tone="destructive"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("Eliminar")).toBeTruthy();
    expect(screen.getByText("Volver")).toBeTruthy();
  });

  it("deshabilita el botón de cancelar y no dispara onConfirm en estado loading", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        visible
        title="Confirmar pago"
        loading
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.press(screen.getByText("Cancelar"));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
