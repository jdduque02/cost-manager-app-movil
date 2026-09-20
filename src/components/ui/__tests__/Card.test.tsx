/**
 * Tests de comportamiento para src/components/ui/Card.tsx.
 * Cubre el bug que este cambio corrige: antes, la tarjeta solo se volvía
 * `Pressable` cuando recibía `onPress` — pasar solo `onLongPress` (patrón de
 * borrado unificado en transactions.tsx/objectives.tsx) la dejaba como
 * `View` no interactivo y el long-press nunca se disparaba.
 */
import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Card } from "../Card";

describe("Card", () => {
  it("dispara onLongPress cuando solo se provee onLongPress (sin onPress)", () => {
    const onLongPress = jest.fn();
    render(
      <Card onLongPress={onLongPress}>
        <Text>Contenido</Text>
      </Card>,
    );

    fireEvent(screen.getByText("Contenido"), "longPress");
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("dispara onPress cuando se provee", () => {
    const onPress = jest.fn();
    render(
      <Card onPress={onPress}>
        <Text>Contenido</Text>
      </Card>,
    );

    fireEvent.press(screen.getByText("Contenido"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renderiza como no interactivo cuando no recibe onPress ni onLongPress", () => {
    const onLongPress = jest.fn();
    render(
      <Card>
        <Text>Contenido</Text>
      </Card>,
    );

    fireEvent(screen.getByText("Contenido"), "longPress");
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
