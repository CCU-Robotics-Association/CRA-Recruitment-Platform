import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ command }) => ({
  root: '.',
  // 生产构建产物托管在 /user/ 前缀下；开发模式由 vite dev server 直接服务根路径
  base: command === 'build' ? '/user/' : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@user': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../../dist/user',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    proxy: {
      // 开发模式：用户端 API 代理到后端服务
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
