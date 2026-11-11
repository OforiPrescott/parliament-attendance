import type { Config } from "tailwindcss";

/**
 * Brand tokens live in src/app/globals.css as CSS variables (HSL channels).
 * To align with the official Parliament of Ghana corporate identity manual,
 * change the values there — every component picks them up.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))", soft: "hsl(var(--primary-soft))" },
        gold: { DEFAULT: "hsl(var(--gold))", foreground: "hsl(var(--gold-foreground))", soft: "hsl(var(--gold-soft))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))", soft: "hsl(var(--destructive-soft))" },
        success: { DEFAULT: "hsl(var(--success))", soft: "hsl(var(--success-soft))" },
        warning: { DEFAULT: "hsl(var(--warning))", soft: "hsl(var(--warning-soft))" },
        info: { DEFAULT: "hsl(var(--info))", soft: "hsl(var(--info-soft))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        sidebar: { DEFAULT: "hsl(var(--sidebar))", foreground: "hsl(var(--sidebar-foreground))", muted: "hsl(var(--sidebar-muted))", accent: "hsl(var(--sidebar-accent))" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: { lg: "0.75rem", md: "0.5rem", sm: "0.375rem" },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)",
        elevated: "0 12px 40px -12px rgb(15 23 42 / 0.25)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { "fade-in": "fade-in .25s ease-out", "scale-in": "scale-in .18s ease-out" },
    },
  },
  plugins: [],
};
export default config;
