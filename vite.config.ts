import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.GITHUB_ACTIONS ? "/-/" : "/",
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: "dist",
  }
});
