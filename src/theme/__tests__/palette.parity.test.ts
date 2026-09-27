import fs from "fs";
import path from "path";
import { PALETTE, type Scheme } from "../palette";

/**
 * Evita que `global.css` (fuente para NativeWind) y `palette.ts` (fuente
 * para JS: gráficas, LinearGradient, lucide, tabBarStyle) diverjan en
 * silencio — se editan a mano por separado y nada más los conecta.
 */

const CSS_TO_TOKEN_KEY: Record<string, keyof (typeof PALETTE)["light"]> = {
  background: "background",
  foreground: "foreground",
  surface: "surface",
  "surface-2": "surface2",
  card: "card",
  "card-foreground": "cardForeground",
  popover: "popover",
  "popover-foreground": "popoverForeground",
  primary: "primary",
  "primary-foreground": "primaryForeground",
  secondary: "secondary",
  "secondary-foreground": "secondaryForeground",
  muted: "muted",
  "muted-foreground": "mutedForeground",
  accent: "accent",
  "accent-foreground": "accentForeground",
  destructive: "destructive",
  "destructive-foreground": "destructiveForeground",
  success: "success",
  "success-foreground": "successForeground",
  warning: "warning",
  "warning-foreground": "warningForeground",
  info: "info",
  "info-foreground": "infoForeground",
  border: "border",
  input: "input",
  ring: "ring",
  "chart-1": "chart1",
  "chart-2": "chart2",
  "chart-3": "chart3",
  "chart-4": "chart4",
  "chart-5": "chart5",
  "gradient-card-from": "gradientCardFrom",
  "gradient-card-to": "gradientCardTo",
};

function parseCssBlock(css: string, selector: ":root" | ".dark"): Record<string, string> {
  const blockRegex =
    selector === ":root"
      ? /:root\s*\{([^}]*)\}/
      : /\.dark\s*\{([^}]*)\}/;
  const match = css.match(blockRegex);
  if (!match) throw new Error(`No se encontró el bloque ${selector} en global.css`);
  const body = match[1];
  const vars: Record<string, string> = {};
  const varRegex = /--([a-z0-9-]+):\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = varRegex.exec(body)) !== null) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

function rgbChannelsToString(channels: string): string {
  return `rgb(${channels.trim().replace(/\s+/g, ", ")})`;
}

describe("palette parity: global.css vs src/theme/palette.ts", () => {
  const cssPath = path.resolve(__dirname, "../../../global.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  const schemes: { selector: ":root" | ".dark"; scheme: Scheme }[] = [
    { selector: ":root", scheme: "light" },
    { selector: ".dark", scheme: "dark" },
  ];

  for (const { selector, scheme } of schemes) {
    it(`${scheme}: cada token de global.css coincide con PALETTE.${scheme}`, () => {
      const cssVars = parseCssBlock(css, selector);
      const tokenSet = PALETTE[scheme];

      for (const [cssName, tokenKey] of Object.entries(CSS_TO_TOKEN_KEY)) {
        const cssValue = cssVars[cssName];
        expect(cssValue).toBeDefined();
        const expected = rgbChannelsToString(cssValue);
        expect(tokenSet[tokenKey]).toBe(expected);
      }
    });
  }
});
