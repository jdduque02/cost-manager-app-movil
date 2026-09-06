export type Scheme = "light" | "dark";

/**
 * Espejo en JS de los tokens de `global.css`. RN no tiene `getComputedStyle`,
 * así que cualquier color que se necesite como string (gráficas,
 * LinearGradient, lucide `color`, tabBarStyle, placeholderTextColor) se lee
 * de aquí en vez de intentar leer una variable CSS.
 *
 * `src/theme/__tests__/palette.parity.test.ts` afirma que estos valores
 * coinciden byte a byte con `global.css` — mantenerlos sincronizados a mano.
 */
export interface TokenSet {
  background: string;
  foreground: string;
  surface: string;
  surface2: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  gradientCardFrom: string;
  gradientCardTo: string;
}

function rgb(channels: string): string {
  return `rgb(${channels.trim().replace(/\s+/g, ", ")})`;
}

export const PALETTE: Record<Scheme, TokenSet> = {
  light: {
    background: rgb("244 241 231"),
    foreground: rgb("26 26 26"),
    surface: rgb("255 255 255"),
    surface2: rgb("230 239 230"),
    card: rgb("255 255 255"),
    cardForeground: rgb("26 26 26"),
    popover: rgb("255 255 255"),
    popoverForeground: rgb("26 26 26"),
    primary: rgb("30 92 58"),
    primaryForeground: rgb("255 255 255"),
    secondary: rgb("230 239 230"),
    secondaryForeground: rgb("26 26 26"),
    muted: rgb("230 239 230"),
    mutedForeground: rgb("85 90 94"),
    accent: rgb("212 165 58"),
    accentForeground: rgb("26 26 26"),
    destructive: rgb("215 49 75"),
    destructiveForeground: rgb("252 247 247"),
    success: rgb("47 125 83"),
    successForeground: rgb("255 255 255"),
    warning: rgb("232 185 74"),
    warningForeground: rgb("26 26 26"),
    info: rgb("0 114 213"),
    infoForeground: rgb("243 245 248"),
    border: rgb("230 232 236"),
    input: rgb("230 232 236"),
    ring: rgb("47 125 83"),
    chart1: rgb("30 92 58"),
    chart2: rgb("212 165 58"),
    chart3: rgb("47 125 83"),
    chart4: rgb("232 185 74"),
    chart5: rgb("85 90 94"),
    gradientCardFrom: rgb("255 255 255"),
    gradientCardTo: rgb("244 241 231"),
  },
  dark: {
    background: rgb("26 26 26"),
    foreground: rgb("244 241 231"),
    surface: rgb("30 92 58"),
    surface2: rgb("47 125 83"),
    card: rgb("30 92 58"),
    cardForeground: rgb("244 241 231"),
    popover: rgb("30 92 58"),
    popoverForeground: rgb("244 241 231"),
    primary: rgb("212 165 58"),
    primaryForeground: rgb("26 26 26"),
    secondary: rgb("47 125 83"),
    secondaryForeground: rgb("244 241 231"),
    muted: rgb("47 125 83"),
    mutedForeground: rgb("230 239 230"),
    accent: rgb("212 165 58"),
    accentForeground: rgb("26 26 26"),
    destructive: rgb("251 86 104"),
    destructiveForeground: rgb("252 247 247"),
    success: rgb("212 165 58"),
    successForeground: rgb("26 26 26"),
    warning: rgb("232 185 74"),
    warningForeground: rgb("26 26 26"),
    info: rgb("44 162 255"),
    infoForeground: rgb("243 245 248"),
    border: rgb("47 125 83"),
    input: rgb("47 125 83"),
    ring: rgb("212 165 58"),
    chart1: rgb("212 165 58"),
    chart2: rgb("30 92 58"),
    chart3: rgb("232 185 74"),
    chart4: rgb("47 125 83"),
    chart5: rgb("85 90 94"),
    gradientCardFrom: rgb("30 92 58"),
    gradientCardTo: rgb("23 70 46"),
  },
};

/** Aplica una opacidad a un color `rgb(r, g, b)` producido por esta paleta. */
export function alpha(color: string, opacity: number): string {
  const match = color.match(/rgb\(([^)]+)\)/);
  if (!match) return color;
  return `rgba(${match[1]}, ${opacity})`;
}
