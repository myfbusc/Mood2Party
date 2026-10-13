import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → dist/index.html: one self-contained file (easy to share or host anywhere).
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
});
