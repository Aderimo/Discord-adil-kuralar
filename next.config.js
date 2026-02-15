/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Netlify deployment için image optimization
  images: {
    unoptimized: false,
  },
  // Build sırasında type check hatalarını ignore et (Netlify uyumluluğu)
  typescript: {
    ignoreBuildErrors: false,
  },
  // ESLint uyarılarını build'i durdurmaktan çıkar
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
