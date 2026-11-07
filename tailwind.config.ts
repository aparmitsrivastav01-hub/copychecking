import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { colors: { ink: "#080808", gold: "#E7B72E", paper: "#EEE9DE" }, fontFamily: { display: ["Arial Narrow", "Impact", "sans-serif"], sans: ["Arial", "Helvetica", "sans-serif"] } } },
  plugins: [],
};
export default config;
