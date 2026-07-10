#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

if [[ "${1:-}" == "--daemon" ]]; then
    mkdir -p logs
    echo "正在后台启动服务器..."
    nohup node index.js >> logs/server.log 2>&1 &
    echo "服务器已在后台启动"
    echo "查看日志: tail -f logs/server.log"
else
    echo "正在前台启动服务器..."
    echo "按 Ctrl+C 停止服务器"
    exec node index.js
fi
