/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F8FA",
        paper: "#FFFFFF",
        ink: "#0E1116",
        graphite: "#5B6270",
        line: "#E4E7EC",
        brand: "#2954E5",
        "brand-dark": "#1E3FB8",
        verify: "#0F8A5F",
        "verify-light": "#E3F6EC",
        alert: "#D33A2C",
        "alert-light": "#FBEAE7",
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
