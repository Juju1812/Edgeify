import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Sans display font for headings — pulls Inter via system stack
        // (we ship via globals.css @import) and falls back gracefully.
        display: ["var(--font-display)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-display)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      colors: {
        ink: {
          950: "#04060c",
          900: "#070b18",
          800: "#0b1124",
          700: "#0f172e"
        },
        // Edge palette — primary identity. Electric cyan is the headline
        // accent; coral is the secondary energy color. Both reserved for
        // calls-to-action and key status moments so they stay potent.
        edge: {
          cyan: "#22e9ff",       // primary accent — electric cyan
          coral: "#ff5d8f",      // secondary accent — coral magenta
          amber: "#ffb547",      // tertiary highlight — warm amber
          deep: "#001a1f",       // deep cyan ink for backgrounds
          ember: "#3a0a1c"       // deep coral ink for backgrounds
        },
        // Legacy palette — kept so existing rank colors and per-page
        // accents still render. New surfaces should prefer `edge.*`.
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
        glow: "0 0 30px rgba(34, 233, 255, 0.32)",
        "glow-coral": "0 0 30px rgba(255, 93, 143, 0.30)",
        card: "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.6)"
      },
      animation: {
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        float: "float 6s ease-in-out infinite",
        "edge-sweep": "edge-sweep 8s linear infinite"
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
        },
        "edge-sweep": {
          "0%": { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "200% 0%" }
        }
      }
    }
  },
  plugins: []
};

export default config;
