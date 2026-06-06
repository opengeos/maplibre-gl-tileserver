import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const exampleEntries = [
  resolve(__dirname, "index.html"),
  resolve(__dirname, "examples/geotiff-viewer/index.html"),
  resolve(__dirname, "examples/cog-viewer/index.html"),
  resolve(__dirname, "examples/dem-hillshade/index.html"),
  resolve(__dirname, "examples/maplibre/index.html"),
  resolve(__dirname, "examples/react/index.html"),
];

export default defineConfig({
  plugins: [react()],
  base: "/",
  optimizeDeps: {
    entries: exampleEntries,
  },
  server: {
    fs: {
      deny: ["dist", "dist-examples"],
    },
  },
  build: {
    outDir: "dist-examples",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        geotiff: resolve(__dirname, "examples/geotiff-viewer/index.html"),
        cog: resolve(__dirname, "examples/cog-viewer/index.html"),
        dem: resolve(__dirname, "examples/dem-hillshade/index.html"),
        maplibre: resolve(__dirname, "examples/maplibre/index.html"),
        react: resolve(__dirname, "examples/react/index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
