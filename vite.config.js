
import { defineConfig } from 'vite';

export default defineConfig({
  // 루트 디렉토리를 기준으로 빌드
  root: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000
  }
});
