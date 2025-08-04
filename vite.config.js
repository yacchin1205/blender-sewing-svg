import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 8000
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: '../resources/oguri-c106.pdf',
          dest: 'resources'
        }
      ]
    })
  ]
});