@echo off
chcp 65001 >nul
title KREIT · Web Portal
echo ===================================================
echo    🧬 Запуск веб-портала KREIT (GENY NETWORK)
echo ===================================================
echo Сервер будет доступен по адресу: http://localhost:3000
echo.
python server.py
pause
