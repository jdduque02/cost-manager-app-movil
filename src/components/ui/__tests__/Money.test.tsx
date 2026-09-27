import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Money } from "../Money";
import { formatCurrency } from "@/utils/format";

it("formatea en COP por defecto y en USD cuando se indica, sin mezclar", () => {
  render(
    <>
      <Money value={1500000} />
      <Money value={12.5} currency="USD" />
    </>,
  );
  expect(screen.getByText(formatCurrency(1500000))).toBeTruthy();
  expect(screen.getByText(formatCurrency(12.5, "USD"))).toBeTruthy();
});
