@echo off
rem Laptop Telegram inbox: checks the bot every 2 min (scheduled task ContentInboxLocal).
cd /d C:\Users\ethan\content-agent
set INBOX_LOCAL=1
set PATH=C:\Users\ethan\AppData\Roaming\Python\Python312\Scripts;%PATH%
"C:\Program Files\nodejs\node.exe" scripts\telegram-inbox.js --process >> inbox-local.log 2>&1
