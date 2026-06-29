import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import { createSvgIconsPlugin } from "vite-plugin-svg-icons";
import type { ViteDevServer } from "vite";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// 检查是否为 WebSocket 升级请求
// ⚠️ 重要：只根据 HTTP headers 判断，不要根据 URL 路径判断
const isWebSocketUpgrade = (req: any): boolean => {
  if (!req || !req.headers) return false;
  // 只检查 upgrade header，这是 WebSocket 升级请求的唯一可靠标识
  const upgrade = req.headers.upgrade;
  if (upgrade && typeof upgrade === "string" && upgrade.toLowerCase() === "websocket") {
    return true;
  }
  return false;
};

// 自定义插件：过滤Sass弃用警告和设置HTTP响应头
const filterSassWarnings = () => {
  return {
    name: "filter-sass-warnings",
    configureServer(server: ViteDevServer) {
      const originalWarn = console.warn;

      console.warn = (...args: any[]) => {
        const isSassDeprecationWarning = args.some(
          (arg) =>
            typeof arg === "string" &&
            (arg.includes("Sass") ||
              arg.includes("dart-sass") ||
              arg.includes("legacy-js-api")),
        );

        if (!isSassDeprecationWarning) {
          originalWarn.apply(console, args);
        }
      };

      // 设置HTTP响应头
      // ⚠️ 重要：必须在所有其他中间件之前，且必须跳过 WebSocket 请求
      server.middlewares.use((req, res, next) => {
        // 跳过 WebSocket 升级请求，让 Vite 的 WebSocket 服务器处理
        // 不设置任何响应头，直接传递给下一个中间件
        if (isWebSocketUpgrade(req)) {
          return next();
        }
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http://localhost:* http://127.0.0.1:* blob:; font-src 'self' data: http: https:; connect-src 'self' ws: wss: https: http://127.0.0.1:* http://localhost:*; frame-src 'self'; worker-src 'self' blob:; child-src 'self' blob:",
        );
        next();
      });

      // 处理静态资源缓存
      server.middlewares.use((req, res, next) => {
        // 跳过 WebSocket 升级请求
        if (isWebSocketUpgrade(req)) {
          return next();
        }
        const url = req.url || "";
        if (
          /\.(png|jpg|jpeg|gif|svg|ico|webp|ttf|woff|woff2|eot|otf|css|js)$/i.test(
            url,
          )
        ) {
          res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          );
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
        next();
      });

      server.httpServer?.once("close", () => {
        console.warn = originalWarn;
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = 8083; // 固定端口 8083

  return {
    root: process.cwd(), // 明确指定项目根目录
    publicDir: "public", // 明确指定 public 目录
    plugins: [
      vue(),
      // SVG 图标插件
      createSvgIconsPlugin({
        iconDirs: [resolve(process.cwd(), "src/assets/icons/svg")],
        symbolId: "icon-[name]",
        inject: "body-last",
        customDomId: "__svg__icons__dom__",
      }),
      // 自动导入Vue和Element Plus的API
      AutoImport({
        imports: ["vue", "vue-router", "vuex"],
        resolvers: [
          ElementPlusResolver({
            importStyle: false,
          }),
        ],
        dts: "src/auto-imports.d.ts",
        eslintrc: {
          enabled: true,
          filepath: "./.eslintrc-auto-import.json",
          globalsPropValue: true,
        },
      }),
      // 自动注册组件
      Components({
        resolvers: [
          ElementPlusResolver({
            importStyle: false,
          }),
        ],
        dts: "src/components.d.ts",
      }),
      // 过滤Sass弃用警告
      filterSassWarnings(),
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
      fallback: {
        path: require.resolve("path-browserify"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: port,
      strictPort: true,
      open: false,
      cors: true,
      proxy: {
        // 代理所有 /dev-api 开头的请求到本地后端服务
        // 根据测试，后端 API 需要 /ai-program 前缀
        "/dev-api": {
          target: `http://192.168.1.25:8080`,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/dev-api/, "/ai-program"), // 将 /dev-api 替换为 /ai-program
        },
        // 兼容其他可能的 API 路径
        "/prod-api": {
          target: `http://192.168.1.25:8080`,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/prod-api/, "/ai-program"), // 将 /prod-api 替换为 /ai-program
        },
        // WebSocket 代理配置
        "/ws": {
          target: `wss://zca.aizhs.top/cozeZhsApi`,
          changeOrigin: true,
          secure: true,
          ws: true, // 启用WebSocket代理
          rewrite: (path) => path, // 保持路径不变
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('WebSocket 代理错误:', err);
            });
          },
        },
      },
    },
    build: {
      outDir: "dist",
      assetsDir: "static",
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          chunkFileNames: "static/js/[name]-[hash].js",
          entryFileNames: "static/js/[name]-[hash].js",
          assetFileNames: "static/[ext]/[name]-[hash].[ext]",
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("vue") && !id.includes("vue-router") && !id.includes("vuex")) {
                return "vendor-vue";
              }
              if (id.includes("element-plus")) {
                return "vendor-element-plus";
              }
              if (id.includes("vue-router")) {
                return "vendor-router";
              }
              if (id.includes("vuex")) {
                return "vendor-vuex";
              }
              if (id.includes("axios")) {
                return "vendor-axios";
              }
              if (id.includes("echarts")) {
                return "vendor-echarts";
              }
              return "vendor-others";
            }
          },
        },
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          includePaths: [
            resolve(__dirname, "src"),
            resolve(__dirname, "node_modules"),
          ],
          additionalData: `@use "sass:math";`,
        },
      },
    },
    envPrefix: "VITE_",
    optimizeDeps: {
      entries: ["src/main.ts"],
      include: ["element-plus", "vue", "vue-router", "vuex", "axios"],
    },
  };
});

