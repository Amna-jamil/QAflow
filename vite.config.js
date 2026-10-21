import { defineConfig } from 'vite';
const localServer = { target: 'http://127.0.0.1:3001', changeOrigin: false };
export default defineConfig({ server: { proxy: { '/api': localServer, '/artifacts': localServer, '/demo': localServer } } });
