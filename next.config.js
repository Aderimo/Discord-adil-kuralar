/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // API tabanlı backend mimarisi için
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
