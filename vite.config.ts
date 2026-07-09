import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://tonka13.github.io/magicGoldfish/ on GitHub Pages.
  base: '/magicGoldfish/',
  plugins: [react()],
})
