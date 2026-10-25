@echo off
chcp 65001 >nul
title KREIT · Web Portal
echo ===================================================
echo    🧬 Запуск веб-портала KREIT (GENY NETWORK)
echo ===================================================
echo Локальный сервер доступен по адресу: http://localhost:3000
echo.
python local_server.py
pause
