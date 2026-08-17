import fs from "fs"
import path from "path"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  // Determine stage (local | prod)
  // Fallback to mode if VITE_STAGE is not set
  const stage = env.VITE_STAGE || mode;

  const host = env.VITE_HOST || 'localhost';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: host,
      port: 5173,
      https: {
        key: fs.readFileSync('./certs/dev.fynverse.app-key.pem'),
        cert: fs.readFileSync('./certs/dev.fynverse.app.pem'),
      }
    },
  }
})

