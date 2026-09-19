#!/bin/bash
# ATL 场景报备 Web - 停止脚本

echo "🛑 停止所有服务..."

for port in 3001 5173; do
  PIDS=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "   端口 $port: 杀掉 PID $PIDS"
    kill -9 $PIDS 2>/dev/null
  fi
done

# 兜底：杀 node server.js 和 vite
pkill -9 -f "node server.js" 2>/dev/null
pkill -9 -f "vite/bin/vite.js" 2>/dev/null

sleep 1

echo "✅ 已停止"