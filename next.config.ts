import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // pdfjs-dist only needs "canvas" for server-side/Node PDF rendering,
      // which this app never uses (parsing happens in the browser). Alias it
      // unconditionally — the { browser: ... } form only covers the browser
      // bundle target and leaves the SSR (Node) target unresolved.
      canvas: './empty-module.js',
    },
  },
};

export default nextConfig;