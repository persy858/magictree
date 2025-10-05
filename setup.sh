#!/bin/bash

echo "🌳 神树 DApp - Next.js 版本快速设置"
echo "===================================="
echo ""

# 创建项目目录
echo "📁 创建项目目录..."
mkdir -p magic-tree-dapp-nextjs
cd magic-tree-dapp-nextjs

# 创建目录结构
echo "📂 创建目录结构..."
mkdir -p app components contexts config types public

# 初始化 package.json
echo "📦 初始化项目..."
npm init -y

# 安装依赖
echo "⬇️  安装依赖..."
npm install next@latest react@latest react-dom@latest ethers@latest

# 安装开发依赖
npm install -D typescript @types/react @types/node @types/react-dom
npm install -D tailwindcss postcss autoprefixer

# 初始化 Tailwind
echo "🎨 初始化 Tailwind CSS..."
npx tailwindcss init -p

# 创建 .gitignore
echo "📝 创建 .gitignore..."
cat > .gitignore << 'EOF'
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
EOF

# 创建 .env.local.example
echo "🔐 创建环境变量示例..."
cat > .env.local.example << 'EOF'
# 合约地址 - 部署后从 Hardhat 输出中复制
NEXT_PUBLIC_CONTRACT_ADDRESS=YOUR_CONTRACT_ADDRESS_HERE
EOF

# 创建 README
echo "📖 创建 README..."
cat > README.md << 'EOF'
# 🌳 神树 DApp - Next.js 版本

基于 Next.js、React 和 Ethers.js 的区块链 DApp

## 快速开始

1. 安装依赖
```bash
npm install
```

2. 配置环境变量
```bash
cp .env.local.example .env.local
# 编辑 .env.local，设置合约地址
```

3. 启动开发服务器
```bash
npm run dev
```

4. 访问 http://localhost:3000

## 功能特性

- 🌳 种植和培育神树
- 🌿 施肥系统（1分钟冷却）
- 🍎 收获果实获得积分
- 🌍 中英文切换
- 💰 MetaMask 钱包集成
- 📱 响应式设计

## 技术栈

- Next.js 14
- React 18
- TypeScript
- Ethers.js 6
- Tailwind CSS
- Solidity

## 部署

```bash
npm run build
npm run start
```

或部署到 Vercel：
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## License

MIT
EOF

echo ""
echo "✅ 项目结构创建完成！"
echo ""
echo "📋 下一步："
echo "1. 将所有组件文件复制到对应目录"
echo "2. 配置 .env.local 文件"
echo "3. 运行 npm run dev"
echo ""
echo "🎉 完成！"