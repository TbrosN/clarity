/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
        colors: {
            brand: {
                primary: '#FF9F87', // Soft Peach/Coral
                secondary: '#A8D5BA', // Sage Green
                dark: '#2C3E50', // Deep Blue
                light: '#F7F7F7', // Off-white
            }
        }
    },
  },
  plugins: [],
}
