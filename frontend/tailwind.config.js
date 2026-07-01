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
        // Los tonos originales (#0F8A5F, #D33A2C) daban 3.87:1 y 4.09:1 sobre
        // sus fondos "-light" -- por debajo del 4.5:1 que pide WCAG AA para
        // texto normal. Se oscurecieron lo mínimo necesario para cruzar el
        // umbral sin cambiar la familia de color (mismo verde/rojo).
        verify: "#0C7A53",
        "verify-light": "#E3F6EC",
        alert: "#C13224",
        "alert-light": "#FBEAE7",
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
