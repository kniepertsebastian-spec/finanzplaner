import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      injectRegister: false,
      manifest: {
        name: 'Finanz-PWA',
        short_name: 'Finanz-PWA',
        description: 'Persönliche Finanzverwaltung ohne Bank-Anbindung',
        theme_color: '#2a78d6',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'de',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    // Temporary: allows the Cloudflare quick-tunnel hostname through Vite's
    // dev-server host-header check (defends against DNS rebinding by default).
    allowedHosts: ['.trycloudflare.com'],
    // Temporary: routes API calls through the same origin as the tunnel below,
    // so the auth cookie stays same-site and no CORS/WebAuthn-origin juggling
    // is needed on the backend side beyond WEBAUTHN_ORIGIN.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  }
})
