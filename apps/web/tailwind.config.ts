import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#070B16",
          elevated: "#0A1020",
        },
        surface: {
          solid: "#10182B",
          glass: "rgba(18, 27, 48, 0.62)",
        },
        brand: {
          primary: "#6D7CFF",
          cyan: "#31D8C2",
          amber: "#F5B84B",
          rose: "#FF6484",
        },
        text: {
          strong: "#F5F7FF",
          muted: "#94A3C3",
        },
      },
      borderRadius: {
        control: "16px",
        card: "20px",
        hero: "28px",
      },
    },
  },
  plugins: [],
};

export default config;