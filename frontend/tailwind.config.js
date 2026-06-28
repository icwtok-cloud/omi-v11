/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F6F4EC",
        ink: "#1F2420",
        graphite: "#5B5F58",
        line: "#D8D4C4",
        verify: "#1D6F52",
        "verify-light": "#E1F0E8",
        alert: "#A3402B",
        "alert-light": "#F6E4DD",
        amber: "#9C6B12",
        "amber-light": "#F5EBD5",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
        sans: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
