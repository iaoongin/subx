@echo off
chcp 65001 >nul
REM 订阅转换服务启动脚本
REM 用法: start.bat [--daemon]

if "%1"=="--daemon" (
    echo 正在后台启动服务器...
    start /B node index.js > logs\server.log 2>&1
    echo 服务器已在后台启动
    echo 查看日志: tail -f logs\server.log
    echo 停止服务: stop.bat
) else (
    echo 正在前台启动服务器...
    echo 按 Ctrl+C 停止服务器
    node index.js
)
