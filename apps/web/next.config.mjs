/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // The workspace packages (@clauseguard/schemas, /ingestion, etc.) are
    // consumed directly from source and use explicit ".js" extensions on
    // relative imports for NodeNext-mode consumers (apps/api, scripts).
    // Webpack's resolver doesn't map ".js" -> ".ts" the way tsc/tsx do, so
    // without this alias every such import 404s under the Next.js bundler.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
