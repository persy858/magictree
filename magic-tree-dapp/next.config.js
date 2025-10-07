/** @type {import('next').NextConfig} */
const nextConfig = {
    // 启用静态导出
    output: 'export',
    
    // 静态导出时必须禁用图片优化
    images: {
      unoptimized: true,
    },
    
    // 可选: 如果部署到 GitHub Pages 等子路径
    // basePath: '/your-repo-name',
    
    // 可选: 尾部斜杠处理
    trailingSlash: true,
    
    // TypeScript 配置
    typescript: {
      ignoreBuildErrors: false,
    },
    
    // ESLint 配置
    eslint: {
      ignoreDuringBuilds: false,
    },
    
    // 可选: 环境变量配置
    env: {
      CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  headers() {
    // Required by FHEVM 
    return Promise.resolve([
      {
        source: '/',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ]);
  }
  };
  
  module.exports = nextConfig;