// vite.config.ts
import { defineConfig } from "file:///C:/Users/Hacker/Documents/shadowtalk-ai-903ca615/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Hacker/Documents/shadowtalk-ai-903ca615/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { VitePWA } from "file:///C:/Users/Hacker/Documents/shadowtalk-ai-903ca615/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Hacker\\Documents\\shadowtalk-ai-903ca615";
var vite_config_default = defineConfig(({ mode }) => {
  const isProduction = mode === "production";
  return {
    base: "/",
    server: {
      host: "::",
      port: 8080,
      headers: {
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin"
      }
    },
    build: {
      target: "es2020",
      minify: isProduction ? "esbuild" : false,
      sourcemap: isProduction ? "hidden" : true,
      chunkSizeWarningLimit: 1e3,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage", "firebase/analytics", "firebase/remote-config"],
            "vendor-ui": ["lucide-react", "framer-motion", "@radix-ui/react-dialog", "@radix-ui/react-toast", "sonner"],
            "vendor-query": ["@tanstack/react-query"],
            "vendor-3d": ["three", "@react-three/fiber", "@react-three/drei"],
            "vendor-editor": ["@monaco-editor/react"],
            "vendor-ai": ["@mlc-ai/web-llm"]
          }
        }
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
        workbox: {
          maximumFileSizeToCacheInBytes: 10485760
        },
        manifest: {
          name: "ShadowTalk AI",
          short_name: "ShadowTalk",
          description: "Think AI. Think ShadowTalk. \u2014 Agentic AI Workspace",
          theme_color: "#050508",
          background_color: "#050508",
          display: "standalone",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxIYWNrZXJcXFxcRG9jdW1lbnRzXFxcXHNoYWRvd3RhbGstYWktOTAzY2E2MTVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEhhY2tlclxcXFxEb2N1bWVudHNcXFxcc2hhZG93dGFsay1haS05MDNjYTYxNVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvSGFja2VyL0RvY3VtZW50cy9zaGFkb3d0YWxrLWFpLTkwM2NhNjE1L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xyXG5cclxuLy8gU2hhZG93U2NhbiBNVlAgXHUyMDE0IExlYW4gYnVpbGQgY29uZmlnIChvcmlnaW5hbCBiYWNrZWQgdXAgYXMgdml0ZS5jb25maWcudHMuZnVsbC1iYWNrdXApXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICBjb25zdCBpc1Byb2R1Y3Rpb24gPSBtb2RlID09PSAncHJvZHVjdGlvbic7XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBiYXNlOiAnLycsXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgaG9zdDogXCI6OlwiLFxyXG4gICAgICBwb3J0OiA4MDgwLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgXCJDcm9zcy1PcmlnaW4tRW1iZWRkZXItUG9saWN5XCI6IFwicmVxdWlyZS1jb3JwXCIsXHJcbiAgICAgICAgXCJDcm9zcy1PcmlnaW4tT3BlbmVyLVBvbGljeVwiOiBcInNhbWUtb3JpZ2luXCIsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgdGFyZ2V0OiAnZXMyMDIwJyxcclxuICAgICAgbWluaWZ5OiBpc1Byb2R1Y3Rpb24gPyAnZXNidWlsZCcgOiBmYWxzZSxcclxuICAgICAgc291cmNlbWFwOiBpc1Byb2R1Y3Rpb24gPyAnaGlkZGVuJyA6IHRydWUsXHJcbiAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAgICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXHJcbiAgICAgICAgICAgICd2ZW5kb3ItZmlyZWJhc2UnOiBbJ2ZpcmViYXNlL2FwcCcsICdmaXJlYmFzZS9hdXRoJywgJ2ZpcmViYXNlL2ZpcmVzdG9yZScsICdmaXJlYmFzZS9zdG9yYWdlJywgJ2ZpcmViYXNlL2FuYWx5dGljcycsICdmaXJlYmFzZS9yZW1vdGUtY29uZmlnJ10sXHJcbiAgICAgICAgICAgICd2ZW5kb3ItdWknOiBbJ2x1Y2lkZS1yZWFjdCcsICdmcmFtZXItbW90aW9uJywgJ0ByYWRpeC11aS9yZWFjdC1kaWFsb2cnLCAnQHJhZGl4LXVpL3JlYWN0LXRvYXN0JywgJ3Nvbm5lciddLFxyXG4gICAgICAgICAgICAndmVuZG9yLXF1ZXJ5JzogWydAdGFuc3RhY2svcmVhY3QtcXVlcnknXSxcclxuICAgICAgICAgICAgJ3ZlbmRvci0zZCc6IFsndGhyZWUnLCAnQHJlYWN0LXRocmVlL2ZpYmVyJywgJ0ByZWFjdC10aHJlZS9kcmVpJ10sXHJcbiAgICAgICAgICAgICd2ZW5kb3ItZWRpdG9yJzogWydAbW9uYWNvLWVkaXRvci9yZWFjdCddLFxyXG4gICAgICAgICAgICAndmVuZG9yLWFpJzogWydAbWxjLWFpL3dlYi1sbG0nXVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgcmVhY3QoKSxcclxuICAgICAgVml0ZVBXQSh7XHJcbiAgICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXHJcbiAgICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbycsICdhcHBsZS10b3VjaC1pY29uLnBuZycsICdwd2EtMTkyeDE5Mi5wbmcnLCAncHdhLTUxMng1MTIucG5nJ10sXHJcbiAgICAgICAgd29ya2JveDoge1xyXG4gICAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDEwNDg1NzYwXHJcbiAgICAgICAgfSxcclxuICAgICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgICAgbmFtZTogJ1NoYWRvd1RhbGsgQUknLFxyXG4gICAgICAgICAgc2hvcnRfbmFtZTogJ1NoYWRvd1RhbGsnLFxyXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdUaGluayBBSS4gVGhpbmsgU2hhZG93VGFsay4gXHUyMDE0IEFnZW50aWMgQUkgV29ya3NwYWNlJyxcclxuICAgICAgICAgIHRoZW1lX2NvbG9yOiAnIzA1MDUwOCcsXHJcbiAgICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnIzA1MDUwOCcsXHJcbiAgICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXHJcbiAgICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgc3JjOiAncHdhLTE5MngxOTIucG5nJyxcclxuICAgICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzcmM6ICdwd2EtNTEyeDUxMi5wbmcnLFxyXG4gICAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXHJcbiAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXHJcbiAgICAgICAgICAgICAgcHVycG9zZTogJ2FueSBtYXNrYWJsZSdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgXVxyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgIF0sXHJcbiAgICByZXNvbHZlOiB7XHJcbiAgICAgIGFsaWFzOiB7XHJcbiAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH07XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRVLFNBQVMsb0JBQW9CO0FBQ3pXLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyxlQUFlO0FBSHhCLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sZUFBZSxTQUFTO0FBRTlCLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxRQUNQLGdDQUFnQztBQUFBLFFBQ2hDLDhCQUE4QjtBQUFBLE1BQ2hDO0FBQUEsSUFDRjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsUUFBUSxlQUFlLFlBQVk7QUFBQSxNQUNuQyxXQUFXLGVBQWUsV0FBVztBQUFBLE1BQ3JDLHVCQUF1QjtBQUFBLE1BQ3ZCLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLGNBQWM7QUFBQSxZQUNaLGdCQUFnQixDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxZQUN6RCxtQkFBbUIsQ0FBQyxnQkFBZ0IsaUJBQWlCLHNCQUFzQixvQkFBb0Isc0JBQXNCLHdCQUF3QjtBQUFBLFlBQzdJLGFBQWEsQ0FBQyxnQkFBZ0IsaUJBQWlCLDBCQUEwQix5QkFBeUIsUUFBUTtBQUFBLFlBQzFHLGdCQUFnQixDQUFDLHVCQUF1QjtBQUFBLFlBQ3hDLGFBQWEsQ0FBQyxTQUFTLHNCQUFzQixtQkFBbUI7QUFBQSxZQUNoRSxpQkFBaUIsQ0FBQyxzQkFBc0I7QUFBQSxZQUN4QyxhQUFhLENBQUMsaUJBQWlCO0FBQUEsVUFDakM7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLE1BQU07QUFBQSxNQUNOLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxRQUNkLGVBQWUsQ0FBQyxlQUFlLHdCQUF3QixtQkFBbUIsaUJBQWlCO0FBQUEsUUFDM0YsU0FBUztBQUFBLFVBQ1AsK0JBQStCO0FBQUEsUUFDakM7QUFBQSxRQUNBLFVBQVU7QUFBQSxVQUNSLE1BQU07QUFBQSxVQUNOLFlBQVk7QUFBQSxVQUNaLGFBQWE7QUFBQSxVQUNiLGFBQWE7QUFBQSxVQUNiLGtCQUFrQjtBQUFBLFVBQ2xCLFNBQVM7QUFBQSxVQUNULE9BQU87QUFBQSxZQUNMO0FBQUEsY0FDRSxLQUFLO0FBQUEsY0FDTCxPQUFPO0FBQUEsY0FDUCxNQUFNO0FBQUEsWUFDUjtBQUFBLFlBQ0E7QUFBQSxjQUNFLEtBQUs7QUFBQSxjQUNMLE9BQU87QUFBQSxjQUNQLE1BQU07QUFBQSxjQUNOLFNBQVM7QUFBQSxZQUNYO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDdEM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
