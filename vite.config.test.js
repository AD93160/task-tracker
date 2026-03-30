import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Replace firebase.js with our mock
      {
        find: /^\.\/firebase$/,
        replacement: path.resolve(__dirname, 'src/mocks/firebase.js'),
      },
      // Replace firebase/auth with our mock
      {
        find: 'firebase/auth',
        replacement: path.resolve(__dirname, 'src/mocks/firebase-auth.js'),
      },
      // Replace firebase/firestore with our mock
      {
        find: 'firebase/firestore',
        replacement: path.resolve(__dirname, 'src/mocks/firebase-firestore.js'),
      },
    ],
  },
});
