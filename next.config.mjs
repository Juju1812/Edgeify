/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "i.pravatar.cc" }
    ]
  },
  webpack: (config, { isServer }) => {
    // face-api.js pulls in Node-only modules (fs, encoding) through its
    // tfjs-core dependency. We never hit those code paths in the browser
    // (we load model weights via fetch from a CDN), but webpack still
    // resolves them. Stub them out for the client bundle.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        encoding: false
      };
    }
    return config;
  }
};

export default nextConfig;
