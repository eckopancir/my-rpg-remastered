@echo off
cd /d "%~dp0"
echo Building client...
call npx vite build
if %errorlevel% neq 0 exit /b %errorlevel%
echo Copying to OpenServer...
xcopy /y /e /i dist\* "C:\OpenServer\domains\rpg.local\"
xcopy /y /e /i api\* "C:\OpenServer\domains\rpg.local\api\"
xcopy /y /e /i cron "C:\OpenServer\domains\rpg.local\cron\"
echo Done!
