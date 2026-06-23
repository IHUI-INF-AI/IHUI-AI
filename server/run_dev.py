"""后端服务器启动脚本 - 带 reload 模式

在 Windows 上, uvicorn reload 模式需要 if __name__ == '__main__' 保护,
因为它使用 multiprocessing 创建子进程。

用法:
    python run_dev.py
"""
import os
import sys

if __name__ == "__main__":
    # 设置工作目录
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    # 标记 reload 模式, 让 graceful_shutdown 跳过信号注册
    os.environ["UVICORN_RELOAD"] = "true"

    # 启用开发环境快速启动模式
    # 跳过 OpenTelemetry、SQL监控、调度器、热配置等非必要初始化
    # 将启动时间从 ~150秒 降低到 ~30秒
    os.environ["DEV_FAST_START"] = "true"

    import uvicorn

    # reload 模式: 修改 Python 文件后自动重启
    # reload_dirs: 只监控 app 目录下的文件变化
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        reload_delay=1,
    )
