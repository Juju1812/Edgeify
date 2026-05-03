import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      colors: {
        ink: {
          950: "#070512",
          900: "#0b0820",
          800: "#100c2e",
          700: "#15113d"
        },
        mog: {
          purple: "#7c3aed",
          violet: "#9d5cff",
          pink: "#d946ef",
          glow: "#a855f7"
        },
        rank: {
          sub: "#f59e0b",
          avg: "#94a3b8",
          chad: "#22d3ee",
          giga: "#a855f7",
          mogger: "#f43f5e",
          mythic: "#fde047"
        }
      },
      boxShadow: {
        glow: "0 0 30px rgba(168, 85, 247, 0.35)",
        card: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.6)"
      },
      animation: {
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
        "float": "float 6s ease-in-out infinite"
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.85)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
