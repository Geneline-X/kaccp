import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript type checking disabled during builds
  typescript: {
    ignoreBuildErrors: true,
  },
  // Note: ESLint configuration moved to .eslintrc or eslint.config.js in Next.js 16
  // Linting is skipped during builds by default when using custom ESLint config
};

export default nextConfig;
