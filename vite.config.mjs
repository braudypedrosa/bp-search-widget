import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/bp-search-widget.js',
      name: 'BPSearchWidget',
      formats: ['iife'],
      fileName: () => 'bp-search-widget.min.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'bp-search-widget.css';
          }

          return assetInfo.name ?? '[name][extname]';
        },
      },
    },
  },
});
