@echo off
set PATH=C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2;C:\Users\Administrator\.local\bin;%PATH%
cd /d G:\IHUI-AI\apps\ai-service
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8803
