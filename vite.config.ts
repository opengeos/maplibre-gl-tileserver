import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dts from "vite-plugin-dts";
import { viteStaticCopy } from "vite-plugin-static-copy";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src"],
      outDir: "dist/types",
      rollupTypes: false,
    }),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/gdal3.js/dist/package/gdal3WebAssembly.wasm",
          dest: "wasm",
        },
        {
          src: "node_modules/gdal3.js/dist/package/gdal3WebAssembly.data",
          dest: "wasm",
        },
        {
          src: "node_modules/gdal3.js/dist/package/gdal3.js",
          dest: "wasm",
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        browser: resolve(__dirname, "src/browser.ts"),
        maplibre: resolve(__dirname, "src/maplibre.ts"),
        server: resolve(__dirname, "src/server/index.ts"),
        react: resolve(__dirname, "src/react.ts"),
        cli: resolve(__dirname, "src/cli.ts"),
      },
      name: "MaplibreGlTileserver",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        const ext = format === "es" ? "mjs" : "cjs";
        return `${entryName}.${ext}`;
      },
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "maplibre-gl",
        "fastify",
        "@fastify/cors",
        "gdal3.js",
        "gdal3.js/node",
        "geotiff",
        "node:fs/promises",
        "node:fs",
        "node:path",
        "node:url",
        "node:crypto",
        "node:os",
        "node:worker_threads",
        "worker_threads",
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "maplibre-gl": "maplibregl",
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") return "maplibre-gl-tileserver.css";
          return assetInfo.name || "";
        },
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: false,
  },
});
