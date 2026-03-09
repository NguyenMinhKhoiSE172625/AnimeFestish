import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_/,
        },
      },
      format: {
        comments: false,
      },
    },
  },
  server: {
    proxy: {
      "/api3": {
        target: "https://phim.nguonc.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api3/, ""),
      },
      "/api2": {
        target: "https://phimapi.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api2/, ""),
      },
      "/api": {
        target: "https://ophim1.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
