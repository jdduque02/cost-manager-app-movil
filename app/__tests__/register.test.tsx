/**
 * Registro móvil: exige la casilla de autorización (Ley 1581/2012) y envía
 * accepted_terms_version como prueba. Los primitivos de UI se mockean a
 * componentes planos para aislar la lógica del formulario.
 */
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import RegisterScreen from "../(auth)/register";
import * as usersApi from "@/api/users.api";
import { toast } from "@/utils/toast";
import { LEGAL_VERSION } from "@/utils/legal";

jest.mock("expo-router", () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
jest.mock("@/api/users.api", () => ({ createUser: jest.fn().mockResolvedValue({}) }));
jest.mock("@/utils/toast", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/components/ui/SprigLogo", () => ({ SprigLogo: () => null }));
jest.mock("@/components/ui/Card", () => {
  const { View } = require("react-native");
  return { Card: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});
jest.mock("@/components/ui/Input", () => {
  const { TextInput } = require("react-native");
  return {
    Input: ({ label, ...props }: { label: string }) => (
      <TextInput accessibilityLabel={label} {...props} />
    ),
  };
});
jest.mock("@/components/ui/Button", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ children, onPress }: { children: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

function fillValidForm(utils: ReturnType<typeof render>) {
  fireEvent.changeText(utils.getByLabelText("Nombre completo"), "Juan Perez");
  fireEvent.changeText(utils.getByLabelText("Email"), "juan@email.com");
  fireEvent.changeText(utils.getByLabelText("Usuario"), "juan_perez");
  fireEvent.changeText(utils.getByLabelText("Contrasena"), "TestPass123!!");
  fireEvent.changeText(utils.getByLabelText("Confirmar contrasena"), "TestPass123!!");
}

describe("RegisterScreen consent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("blocks submit until the consent checkbox is accepted", () => {
    const utils = render(<RegisterScreen />);
    fillValidForm(utils);
    expect(utils.getByRole("checkbox").props.accessibilityState).toEqual({ checked: false });
    fireEvent.press(utils.getByText("Crear cuenta"));
    expect(toast.error).toHaveBeenCalledWith("Aceptacion requerida", expect.any(String));
    expect(usersApi.createUser).not.toHaveBeenCalled();
  });

  it("sends accepted_terms_version once accepted", async () => {
    const utils = render(<RegisterScreen />);
    fillValidForm(utils);
    fireEvent.press(utils.getByRole("checkbox"));
    fireEvent.press(utils.getByText("Crear cuenta"));
    await waitFor(() => expect(usersApi.createUser).toHaveBeenCalled());
    expect(usersApi.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ accepted_terms_version: LEGAL_VERSION }),
    );
  });
});
