@echo off
title Printer Agent - Lay du lieu may in
echo ====================================================
echo  Dang ket noi may in Ricoh va cap nhat Google Sheet...
echo ====================================================
cd /d "g:\My TASK\toi_uu_lai_bot_chat\quan_ly_van_phong_pham"
node printer_angent.js

echo.
if %ERRORLEVEL% EQU 0 (
    echo [THANH CONG] Da cap nhat xong du lieu len Google Sheet!
) else (
    echo [LOI] Co loi xay ra. Vui long kiem tra log loi!
)
echo.
echo Cua so se tu dong sau 5 giay...
timeout /t 5 > nul
