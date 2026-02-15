/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Netlify deployment için image optimization
  images: {
    unoptimized: false,
  },
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
