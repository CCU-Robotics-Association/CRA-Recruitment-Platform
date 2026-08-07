import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ command }) => ({
  root: '.',
  // 生产构建产物托管在 /admin/ 前缀下；开发模式由 vite dev server 直接服务根路径
  base: command === 'build' ? '/admin/' : '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@admin': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../../dist/admin',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      // 开发模式：管理端 API 代理到后端服务
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
