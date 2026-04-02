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
    // Prisma ve bcryptjs'i bundle etme, runtime'da node_modules'tan al (Netlify Lambda için)
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    outputFileTracingIncludes: {
      '/api/**': [
        './node_modules/@prisma/client/**/*',
        './node_modules/.prisma/**/*',
      ],
    },
  },
};

module.exports = nextConfig;
