import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // pdfjs-dist only needs "canvas" for server-side/Node PDF rendering,
      // which this app never uses (parsing happens in the browser).
      canvas: { browser: './empty-module.js' },
    },
  },
};

export default nextConfig;