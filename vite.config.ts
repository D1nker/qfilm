import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@fonts": fileURLToPath(new URL("./assets/fonts", import.meta.url)),
    },
  },
  // Tauri affiche ses propres erreurs dans le terminal : ne pas les effacer
  clearScreen: false,
  server: {
    port: 5173,
    // Tauri pointe sur un port fixe : échouer plutôt que de basculer sur un autre
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**", "**/crates/**", "**/target/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
});
