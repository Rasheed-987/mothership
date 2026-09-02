// Next 14 does not support next.config.ts — TypeScript config arrived in Next 15.
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next 14 bundles server code with webpack, which cannot parse argon2's
    // native .node binary or mongoose's dynamic requires. Turbopack (Next 16)
    // handled these without configuration.
    serverComponentsExternalPackages: ['@node-rs/argon2', 'mongoose'],
  },
}

export default nextConfig
