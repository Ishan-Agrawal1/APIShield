import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@apishield/contracts'],
};

export default nextConfig;
