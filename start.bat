@echo off
setlocal EnableExtensions EnableDelayedExpansion
REM Subscription conversion service launcher.
REM Usage: start.bat [--daemon]

set "NODE_EXE=node"
where node >nul 2>&1
if errorlevel 1 (
    set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if exist "!CODEX_NODE!" (
        set "NODE_EXE=!CODEX_NODE!"
        echo Node was not found in PATH. Using the Codex bundled Node.
    ) else (
        echo Error: node.exe was not found in PATH or the Codex runtime.
        echo Install Node.js or add its directory to PATH.
        exit /b 1
    )
)

if "%1"=="--daemon" (
    echo Starting server in the background...
    start /B "" "%NODE_EXE%" index.js > logs\server.log 2>&1
    echo Server started in the background.
    echo Logs: logs\server.log
    echo Stop: stop.bat
) else (
    echo Starting server in the foreground...
    echo Press Ctrl+C to stop.
    "%NODE_EXE%" index.js
)
