import type { Config } from "tailwindcss";

/**
 * Design tokens — "Light" direction (design/mockups/option-b-light.png).
 * apple.com-style: off-white canvas, white rounded cards, soft diffuse
 * shadows, near-black type, one Apple-blue accent. Nothing is square.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "var(--font-inter)",
          "system-ui",
          "sans-serif"
        ]
      },
      colors: {
        canvas: "#f5f5f7",
        card: "#ffffff",
        ink: {
          DEFAULT: "#1d1d1f",
          2: "#424245",
          3: "#6e6e73",
          4: "#86868b"
        },
        line: "#e5e5ea",
        fill: {
          DEFAULT: "#f0f0f3",
          2: "#e8e8ed"
        },
        accent: {
          DEFAULT: "#0071e3",
          hover: "#0077ed",
          soft: "#e8f2fd",
          ink: "#0066cc"
        },
        good: "#1d9a4a",
        bad: "#d70015",
        warn: "#b25000"
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
        "3xl": "28px",
        "4xl": "36px"
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.06)",
        lift: "0 2px 6px rgba(0,0,0,0.05), 0 18px 48px rgba(0,0,0,0.10)",
        ring: "0 0 0 4px rgba(0,113,227,0.18)"
      },
      letterSpacing: {
        tightest: "-0.035em",
        tighter: "-0.025em",
        tight: "-0.015em"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        pulse: "pulse 1.6s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
