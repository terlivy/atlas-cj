#!/bin/bash
# ATL 场景报备 Web - 一键启动脚本
# 同时启动后端 (3001) + 前端 (5173)

PROJECT_DIR="$HOME/Desktop/ATL数据采集场景报备/web"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

# 防重入：杀掉已有的进程
echo "🔧 清理旧进程..."
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
sleep 1

# 启动后端
echo "🚀 启动后端 (3001)..."
cd "$BACKEND_DIR" || exit 1
nohup node server.js > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "   后端 PID: $BACKEND_PID → $LOG_DIR/backend.log"

# 启动前端
echo "🚀 启动前端 (5173)..."
cd "$FRONTEND_DIR" || exit 1
nohup node node_modules/vite/bin/vite.js --port 5173 --host 127.0.0.1 > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "   前端 PID: $FRONTEND_PID → $LOG_DIR/frontend.log"

# 等待服务就绪
sleep 3

# 健康检查
echo ""
echo "🔍 健康检查..."
if curl -s http://localhost:3001/api/health > /dev/null; then
  echo "   ✅ 后端: http://localhost:3001"
else
  echo "   ❌ 后端启动失败，查看日志: $LOG_DIR/backend.log"
fi

if curl -s http://127.0.0.1:5173 > /dev/null; then
  echo "   ✅ 前端: http://127.0.0.1:5173"
else
  echo "   ❌ 前端启动失败，查看日志: $LOG_DIR/frontend.log"
fi

# 数据统计
echo ""
echo "📊 数据统计:"
curl -s http://localhost:3001/api/stats | python3 -c "
import sys, json
try:
  d = json.loads(sys.stdin.read())
  print(f'   场景数: {d.get(\"场景数\", 0)}')
  print(f'   工位数: {d.get(\"工位数\", 0)}')
  print(f'   图片数: {d.get(\"图片数\", 0)}')
  print(f'   采集人: {d.get(\"采集人数\", 0)}')
except Exception as e:
  print(f'   ⚠️ 解析失败: {e}')
"

echo ""
echo "🎉 启动完成！浏览器打开: http://127.0.0.1:5173/"
echo ""
echo "💡 常用命令:"
echo "   停止: $PROJECT_DIR/stop.sh"
echo "   后端日志: tail -f $LOG_DIR/backend.log"
echo "   前端日志: tail -f $LOG_DIR/frontend.log"