import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const exposeNextPublic = (mode) => {
  const raw = loadEnv(mode, process.cwd(), '')
  return ['NEXT_PUBLIC_API_BASE', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].reduce(
    (acc, key) => ({
      ...acc,
      [`import.meta.env.${key}`]: JSON.stringify(raw[key]),
    }),
    {},
  )
}

export default defineConfig(({ mode }) => {
  const nextPublicDefines = exposeNextPublic(mode)

  return {
    base: './',
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      open: true,
      allowedHosts: ['.ngrok-free.dev']
    },
    define: nextPublicDefines,
  }
})
