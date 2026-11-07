@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动农语 AI...
echo 启动后请访问终端显示的网址。按 Ctrl+C 可以停止服务。
node server.mjs
pause
