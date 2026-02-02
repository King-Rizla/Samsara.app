import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
// Using esbuild for JSX transform (built into Vite) instead of @vitejs/plugin-react
// to avoid ESM-only plugin issues with electron-forge
export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  // Use relative paths for Electron file:// protocol
  base: "./",
  build: {
    outDir: path.resolve(__dirname, ".vite/renderer/main_window"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
});
