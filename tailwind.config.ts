import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ===== Paleta oficial PayBoom =====
        // Naranja "PAY" como color primario de acción
        brand: {
          50:  "#fff4ee",
          100: "#ffe4d2",
          200: "#ffc6a5",
          300: "#ffa172",
          400: "#fb7c45",
          500: "#f35514",   // PRIMARIO oficial
          600: "#d8410a",
          700: "#b3320a",
          800: "#902a10",
          900: "#762611",
          950: "#400f05",
        },
        // Turquesa "BOOM" como color secundario / acento
        teal: {
          50:  "#effdfd",
          100: "#cdf8fa",
          200: "#9bf0f4",
          300: "#5ee0e7",
          400: "#27c6d0",
          500: "#0caab5",
          600: "#009fa2",   // SECUNDARIO oficial
          700: "#067079",
          800: "#0a5a62",
          900: "#0d4a52",
          950: "#012a30",
        },
        // Crema oficial de fondo
        cream: {
          50:  "#fffcf8",
          100: "#fdfbf9",   // FONDO oficial
          200: "#f7f2eb",
          300: "#efe6d9",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae2",
          300: "#b0b9c7",
          400: "#8693a7",
          500: "#67748b",
          600: "#525d72",
          700: "#434c5d",
          800: "#3a414f",
          900: "#22252c",
          950: "#0f1218",
        },
      },
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,.06), 0 4px 16px rgba(15,23,42,.06)",
      },
    },
  },
  plugins: [],
};

export default config;
