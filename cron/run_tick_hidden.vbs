' Windowless launcher for cron/tick.php (Task Scheduler shows a console
' window for php.exe every minute otherwise). Run with:
'   wscript.exe run_tick_hidden.vbs
CreateObject("Wscript.Shell").Run """C:\OpenServer\modules\php\PHP_8.0\php.exe"" ""C:\OpenServer\domains\rpg.local\cron\tick.php""", 0, False
