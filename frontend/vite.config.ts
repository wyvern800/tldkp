import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "./build", // ou qualquer outra pasta que o Express use para servir arquivos estáticos
  },
  server: {
    watch: {
      usePolling: true,
    },
  },
});
