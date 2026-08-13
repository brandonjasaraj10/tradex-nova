// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { nodePolyfills } from "file:///home/project/node_modules/vite-plugin-node-polyfills/dist/index.js";
import fs from "fs";
import path from "path";
var __vite_injected_original_dirname = "/home/project";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ["path", "util", "buffer", "process"],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    }),
    {
      name: "copy-public-files",
      apply: "build",
      async closeBundle() {
        const publicDir = path.resolve(__vite_injected_original_dirname, "public");
        const outDir = path.resolve(__vite_injected_original_dirname, "dist");
        const filesToCopy = [
          "tradex_logo.png",
          "tradex-icon.svg",
          "tradex-logo.svg",
          "tradex-tab-icon.svg",
          "TradeX_AutoSync.mq4",
          "TradeX_AutoSync.mq5",
          "favicon.ico",
          "favicon.svg",
          "favicon-16x16.png",
          "favicon-16x16.svg",
          "favicon-32x32.png",
          "favicon-32x32.svg",
          "favicon-48x48.png",
          "favicon-64x64.png",
          "apple-touch-icon.png",
          "apple-touch-icon.svg",
          "icon-192x192.png",
          "icon-192x192.svg",
          "icon-512x512.png",
          "icon-512x512.svg",
          "site.webmanifest",
          "sitemap.xml",
          "robots.txt"
        ];
        for (const file of filesToCopy) {
          try {
            const src = path.join(publicDir, file);
            const dest = path.join(outDir, file);
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
            }
          } catch (e) {
          }
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  define: {
    global: "globalThis"
  },
  publicDir: false
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBub2RlUG9seWZpbGxzIH0gZnJvbSAndml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHMnO1xuaW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBub2RlUG9seWZpbGxzKHtcbiAgICAgIGluY2x1ZGU6IFsncGF0aCcsICd1dGlsJywgJ2J1ZmZlcicsICdwcm9jZXNzJ10sXG4gICAgICBnbG9iYWxzOiB7XG4gICAgICAgIEJ1ZmZlcjogdHJ1ZSxcbiAgICAgICAgZ2xvYmFsOiB0cnVlLFxuICAgICAgICBwcm9jZXNzOiB0cnVlXG4gICAgICB9XG4gICAgfSksXG4gICAge1xuICAgICAgbmFtZTogJ2NvcHktcHVibGljLWZpbGVzJyxcbiAgICAgIGFwcGx5OiAnYnVpbGQnLFxuICAgICAgYXN5bmMgY2xvc2VCdW5kbGUoKSB7XG4gICAgICAgIGNvbnN0IHB1YmxpY0RpciA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdwdWJsaWMnKTtcbiAgICAgICAgY29uc3Qgb3V0RGlyID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ2Rpc3QnKTtcblxuICAgICAgICBjb25zdCBmaWxlc1RvQ29weSA9IFtcbiAgICAgICAgICAndHJhZGV4X2xvZ28ucG5nJyxcbiAgICAgICAgICAndHJhZGV4LWljb24uc3ZnJyxcbiAgICAgICAgICAndHJhZGV4LWxvZ28uc3ZnJyxcbiAgICAgICAgICAndHJhZGV4LXRhYi1pY29uLnN2ZycsXG4gICAgICAgICAgJ1RyYWRlWF9BdXRvU3luYy5tcTQnLFxuICAgICAgICAgICdUcmFkZVhfQXV0b1N5bmMubXE1JyxcbiAgICAgICAgICAnZmF2aWNvbi5pY28nLFxuICAgICAgICAgICdmYXZpY29uLnN2ZycsXG4gICAgICAgICAgJ2Zhdmljb24tMTZ4MTYucG5nJyxcbiAgICAgICAgICAnZmF2aWNvbi0xNngxNi5zdmcnLFxuICAgICAgICAgICdmYXZpY29uLTMyeDMyLnBuZycsXG4gICAgICAgICAgJ2Zhdmljb24tMzJ4MzIuc3ZnJyxcbiAgICAgICAgICAnZmF2aWNvbi00OHg0OC5wbmcnLFxuICAgICAgICAgICdmYXZpY29uLTY0eDY0LnBuZycsXG4gICAgICAgICAgJ2FwcGxlLXRvdWNoLWljb24ucG5nJyxcbiAgICAgICAgICAnYXBwbGUtdG91Y2gtaWNvbi5zdmcnLFxuICAgICAgICAgICdpY29uLTE5MngxOTIucG5nJyxcbiAgICAgICAgICAnaWNvbi0xOTJ4MTkyLnN2ZycsXG4gICAgICAgICAgJ2ljb24tNTEyeDUxMi5wbmcnLFxuICAgICAgICAgICdpY29uLTUxMng1MTIuc3ZnJyxcbiAgICAgICAgICAnc2l0ZS53ZWJtYW5pZmVzdCcsXG4gICAgICAgICAgJ3NpdGVtYXAueG1sJyxcbiAgICAgICAgICAncm9ib3RzLnR4dCdcbiAgICAgICAgXTtcblxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXNUb0NvcHkpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3JjID0gcGF0aC5qb2luKHB1YmxpY0RpciwgZmlsZSk7XG4gICAgICAgICAgICBjb25zdCBkZXN0ID0gcGF0aC5qb2luKG91dERpciwgZmlsZSk7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzcmMpKSB7XG4gICAgICAgICAgICAgIGZzLmNvcHlGaWxlU3luYyhzcmMsIGRlc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIFNraXAgZmlsZXMgdGhhdCBjYW4ndCBiZSBjb3BpZWRcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIF0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J11cbiAgfSxcbiAgZGVmaW5lOiB7XG4gICAgZ2xvYmFsOiAnZ2xvYmFsVGhpcycsXG4gIH0sXG4gIHB1YmxpY0RpcjogZmFsc2Vcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBQ2xCLFNBQVMscUJBQXFCO0FBQzlCLE9BQU8sUUFBUTtBQUNmLE9BQU8sVUFBVTtBQUpqQixJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixjQUFjO0FBQUEsTUFDWixTQUFTLENBQUMsUUFBUSxRQUFRLFVBQVUsU0FBUztBQUFBLE1BQzdDLFNBQVM7QUFBQSxRQUNQLFFBQVE7QUFBQSxRQUNSLFFBQVE7QUFBQSxRQUNSLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRixDQUFDO0FBQUEsSUFDRDtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsTUFBTSxjQUFjO0FBQ2xCLGNBQU0sWUFBWSxLQUFLLFFBQVEsa0NBQVcsUUFBUTtBQUNsRCxjQUFNLFNBQVMsS0FBSyxRQUFRLGtDQUFXLE1BQU07QUFFN0MsY0FBTSxjQUFjO0FBQUEsVUFDbEI7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUVBLG1CQUFXLFFBQVEsYUFBYTtBQUM5QixjQUFJO0FBQ0Ysa0JBQU0sTUFBTSxLQUFLLEtBQUssV0FBVyxJQUFJO0FBQ3JDLGtCQUFNLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSTtBQUNuQyxnQkFBSSxHQUFHLFdBQVcsR0FBRyxHQUFHO0FBQ3RCLGlCQUFHLGFBQWEsS0FBSyxJQUFJO0FBQUEsWUFDM0I7QUFBQSxVQUNGLFNBQVMsR0FBRztBQUFBLFVBRVo7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixRQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsV0FBVztBQUNiLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
