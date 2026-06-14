import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effaf6",
          100: "#d8f3e8",
          500: "#1f9f7a",
          600: "#157f63",
          900: "#0f3d32"
        },
        ink: "#17211f"
      }
    }
  },
  plugins: []
};

export default config;
