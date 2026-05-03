/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F0FFF4",
          100: "#D1FAE5",
          600: "#059669",
          700: "#2D6A4F",
          800: "#52796F",
          900: "#1B4332",
        },
      },
    },
  },
  plugins: [],
};
