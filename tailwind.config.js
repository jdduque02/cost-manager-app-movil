/** @type {import('tailwindcss').Config} */
function withOpacity(variable) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: withOpacity("--background"),
        foreground: withOpacity("--foreground"),
        surface: withOpacity("--surface"),
        "surface-2": withOpacity("--surface-2"),
        card: withOpacity("--card"),
        "card-foreground": withOpacity("--card-foreground"),
        popover: withOpacity("--popover"),
        "popover-foreground": withOpacity("--popover-foreground"),
        primary: withOpacity("--primary"),
        "primary-foreground": withOpacity("--primary-foreground"),
        secondary: withOpacity("--secondary"),
        "secondary-foreground": withOpacity("--secondary-foreground"),
        muted: withOpacity("--muted"),
        "muted-foreground": withOpacity("--muted-foreground"),
        accent: withOpacity("--accent"),
        "accent-foreground": withOpacity("--accent-foreground"),
        destructive: withOpacity("--destructive"),
        "destructive-foreground": withOpacity("--destructive-foreground"),
        success: withOpacity("--success"),
        "success-foreground": withOpacity("--success-foreground"),
        warning: withOpacity("--warning"),
        "warning-foreground": withOpacity("--warning-foreground"),
        info: withOpacity("--info"),
        "info-foreground": withOpacity("--info-foreground"),
        border: withOpacity("--border"),
        input: withOpacity("--input"),
        ring: withOpacity("--ring"),
        "chart-1": withOpacity("--chart-1"),
        "chart-2": withOpacity("--chart-2"),
        "chart-3": withOpacity("--chart-3"),
        "chart-4": withOpacity("--chart-4"),
        "chart-5": withOpacity("--chart-5"),
      },
      borderRadius: {
        DEFAULT: "14px",
        sm: "10px",
        md: "12px",
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
        "3xl": "26px",
      },
      fontFamily: {
        // Título/display — Space Grotesk. Una clase = una familia concreta
        // (NativeWind no soporta fallbacks ni combinar con font-semibold).
        display: ["SpaceGrotesk-SemiBold"],
        "display-medium": ["SpaceGrotesk-Medium"],
        "display-bold": ["SpaceGrotesk-Bold"],
        // Cuerpo — Schibsted Grotesk.
        sans: ["SchibstedGrotesk-Regular"],
        "sans-medium": ["SchibstedGrotesk-Medium"],
        "sans-semibold": ["SchibstedGrotesk-SemiBold"],
        "sans-bold": ["SchibstedGrotesk-Bold"],
        // Cifras / moneda.
        num: ["SpaceGrotesk-Medium"],
        "num-semibold": ["SpaceGrotesk-SemiBold"],
        // Alias de compatibilidad: arregla los usos existentes de font-mono
        // (apuntaban a una fuente que nunca se empaquetó) sin tocar pantallas.
        mono: ["SpaceGrotesk-Medium"],
      },
    },
  },
  plugins: [],
};
