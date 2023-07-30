import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: "/video_chat-app_react",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1600, },
})
