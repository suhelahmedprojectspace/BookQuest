import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,
  
  // Configure external image domains
  images: {
    // ✅ New approach: remotePatterns (recommended for Next.js 12.3.0+)
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'images.amazon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.amazon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'books.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.amazon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ecx.images-amazon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'prodimage.images-bn.com',
        port: '',
        pathname: '/**',
      }
    ],
    
    // ✅ Legacy approach: domains (deprecated but still works as fallback)
    domains: [
      'images.amazon.com',
      'm.media-amazon.com', 
      'images-na.ssl-images-amazon.com',
      'books.google.com',
      'covers.openlibrary.org',
      'img.amazon.com',
      'ecx.images-amazon.com',
      'prodimage.images-bn.com'
    ]
  }
};

export default nextConfig;
