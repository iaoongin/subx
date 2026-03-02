@echo off
REM 订阅转换服务停止脚本

echo 正在停止所有 Node.js 进程...
taskkill /F /IM node.exe 2>nul

if %ERRORLEVEL% EQU 0 (
    echo 服务器已停止
) else (
    echo 没有运行中的 Node.js 进程
)
