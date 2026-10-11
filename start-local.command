#!/bin/zsh

set -e

cd "$(dirname "$0")"

port="${1:-8000}"
echo "kaisei 本地预览已启动："
echo "  首页：     http://127.0.0.1:${port}/"
echo "  赴日计划： http://127.0.0.1:${port}/plan.html"
echo ""
echo "按 Control-C 停止服务器。"
echo ""

python3 -m http.server "$port" --bind 127.0.0.1
