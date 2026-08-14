import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Enables listening on local IP / localhost
    hmr: {
      host: 'localhost',
      port: 5173,
    },
  },
});

