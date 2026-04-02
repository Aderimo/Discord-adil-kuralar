/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    typedRoutes: true,
    // Prisma native binaries'i serverless bundle'a dahil et (Netlify/Lambda için gerekli)
    outputFileTracingIncludes: {
      '/api/**': [
        './node_modules/@prisma/client/**/*',
        './node_modules/.prisma/**/*',
      ],
    },
  },
};

module.exports = nextConfig;
