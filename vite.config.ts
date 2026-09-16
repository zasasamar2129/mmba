import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        // Node built-ins can never run in the browser — externalize them so Vite
        // stops trying to resolve server-side modules (silences ~80 warnings).
        external: [
          /^node:.*/,
          'fs', 'path', 'os', 'crypto', 'net', 'http', 'https',
          'stream', 'util', 'zlib', 'url', 'assert', 'buffer',
          'tty', 'querystring', 'async_hooks', 'tls',
        ],
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': ['lucide-react', 'motion', 'clsx', 'tailwind-merge'],
            'vendor-utils': ['jalaali-js', 'xlsx', 'html-to-image', 'html2canvas'],
            'vendor-server': ['express', 'archiver', 'web-push', 'dotenv'],
            'vendor-ai': ['@google/genai'],
          },
        },
      },
      chunkSizeWarningLimit: 1500,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Allow serving on these hostnames (panel deployment domains)
      allowedHosts: [
        'panel.johannapage.website',
        'panel.mobilemeisam.ir',
      ],
    },
  };
});
