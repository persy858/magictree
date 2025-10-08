#!/bin/bash

echo "🔧 修复模块导入问题..."
echo "================================"
echo ""

# 删除 node_modules 和锁文件
echo "🗑️  清理旧的依赖..."
rm -rf node_modules
rm -f package-lock.json
rm -f yarn.lock
rm -rf cache
rm -rf artifacts
rm -rf typechain-types
rm -rf types

echo "✅ 清理完成"
echo ""

# 重新安装依赖
echo "📦 重新安装依赖..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ 依赖安装成功"
    echo ""
else
    echo "❌ 依赖安装失败"
    exit 1
fi

# 编译合约
echo "🔨 编译合约..."
npx hardhat compile

if [ $? -eq 0 ]; then
    echo "✅ 合约编译成功"
    echo ""
else
    echo "❌ 合约编译失败"
    exit 1
fi

# 运行测试
echo "🧪 运行测试..."
echo "================================"
npx hardhat test

if [ $? -eq 0 ]; then
    echo ""
    echo "================================"
    echo "✅ 所有问题已修复！测试通过！"
    echo ""
else
    echo ""
    echo "================================"
    echo "⚠️  测试失败，请检查错误信息"
    echo ""
fi
