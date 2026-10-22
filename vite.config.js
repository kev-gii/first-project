import { defineConfig } from "vite";

// AURORA 交响乐团 · 静态演示站的构建配置
//
// 为什么这样配：
// - base: "./"
//     产物的所有资源链接都用相对路径，使 dist/ 既能在域名根
//     也能在子路径（如 GitHub Pages 的 /first-project/）下直接打开，
//     无需为不同部署环境改代码。
// - build.assetsDir: "vendor"
//     public/ 里的静态素材（assets/、data/）会被原样拷到 dist/ 根，
//     即 dist/assets/、dist/data/。把 Vite 自身打包出的 JS/CSS 块
//     放进 dist/vendor/，与静态素材分目录，避免混淆。
//
// 本地开发：npm run dev   （Vite HMR，public/ 素材按根路径提供）
// 生产构建：npm run build （输出到 dist/，交给 GitHub Pages 部署）

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "vendor",
    // 站点为纯静态、模块数量少，保留完整注释不划算，统一最小化
    minify: "esbuild",
    // 产物按内容哈希，天然长期缓存；素材文件名里带 hash 可安全 immutable 缓存
    rollupOptions: {
      output: {
        // 把 chunk 名做稳定可读：vendor/index.js、vendor/index.hash.js
        entryFileNames: "vendor/[name].[hash].js",
        chunkFileNames: "vendor/[name].[hash].js",
        assetFileNames: "vendor/[name].[hash][extname]",
      },
    },
  },
});
