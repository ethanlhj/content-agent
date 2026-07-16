@echo off
echo === removing old pipeline task === > "%~dp0refresh-task.log"
schtasks /delete /tn ContentAgentDaily /f >> "%~dp0refresh-task.log" 2>&1
echo === creating daily pull task (11:30 AM) === >> "%~dp0refresh-task.log"
powershell -NoProfile -Command "$a = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c cd /d C:\Users\ethan\content-agent && git pull --rebase >> pull.log 2>&1'; $t = New-ScheduledTaskTrigger -Daily -At 11:30am; $s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable; Register-ScheduledTask -TaskName 'ContentDeskPull' -Action $a -Trigger $t -Settings $s -Force" >> "%~dp0refresh-task.log" 2>&1
echo === verifying === >> "%~dp0refresh-task.log"
schtasks /query /tn ContentDeskPull /fo LIST >> "%~dp0refresh-task.log" 2>&1
