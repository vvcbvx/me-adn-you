import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          cart: path.resolve(__dirname, 'cart.html'),
          orders: path.resolve(__dirname, 'orders.html'),
          checkout: path.resolve(__dirname, 'checkout.html'),
          adminLogin: path.resolve(__dirname, 'admin/login.html'),
          adminDashboard: path.resolve(__dirname, 'admin/dashboard.html'),
          adminProducts: path.resolve(__dirname, 'admin/products.html'),
          adminOrders: path.resolve(__dirname, 'admin/orders.html'),
        },
      },
    },
    server: {
      // ✅ إضافة النطاقات المسموحة لحل مشكلة Cloudflare Tunnel
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '.trycloudflare.com',
        '.ngrok-free.app',
        '.loca.lt',
      ],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      port: 3000,
      host: '0.0.0.0',
    },
  };
});