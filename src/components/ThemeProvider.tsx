import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedScheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedScheme: "dark",
  setTheme: () => {},
});

const STORAGE_KEY = "cost-manager-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = (useRNColorScheme() as "light" | "dark") ?? "dark";
  const [theme, setThemeState] = useState<Theme>("system");
  const resolvedScheme = theme === "system" ? systemScheme : theme;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setThemeState(stored);
      }
    });
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    AsyncStorage.setItem(STORAGE_KEY, newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedScheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
