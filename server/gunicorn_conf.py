"""P20-7: gunicorn 生产部署配置.

gunicorn -c gunicorn_conf.py app.main:app
- workers: CPU 核数 * 2 + 1
- worker_class: uvicorn.workers.UvicornWorker (支持 WebSocket + async)
- preload_app: 启动时预加载 app, 减少 worker fork 后重复初始化
- max_requests + max_requests_jitter: 防内存泄漏 (定期重启 worker)
- timeout: 120s (LLM 长任务)
- keepalive: 5s (反向代理场景)
- accesslog/errorlog: stdout (docker logs 友好)
"""
import multiprocessing
import os

# ============================ 进程配置 ============================

# Worker 数: CPU 核数 * 2 + 1 (IO 密集型)
# 容器化部署时通过 WORKERS 环境变量覆盖
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000

# ============================ 性能调优 ============================

# 每个 worker 最多处理 N 个请求后重启 (防内存泄漏)
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "100"))

# 任务超时: LLM 长响应 120s
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
# 优雅重启超时
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
# keep-alive: 反向代理场景
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))

# ============================ 进程管理 ============================

# 预加载 app, 减少 worker fork 后初始化时间 (但要小心 db session 复用问题)
# 注意: preload_app=True 会在 master 进程预加载应用
# 必须确保不在模块级别创建 db session, 或在 post_fork hook 中重建连接池
# 否则 fork 出的 worker 会共享连接池导致并发问题
preload_app = os.getenv("GUNICORN_PRELOAD", "true").lower() == "true"

# ============================ 日志 ============================

accesslog = os.getenv("GUNICORN_ACCESS_LOG", "-")  # stdout
errorlog = os.getenv("GUNICORN_ERROR_LOG", "-")    # stderr
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
access_log_format = (
    '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)s'
)

# ============================ 进程名 ============================

proc_name = os.getenv("GUNICORN_PROC_NAME", "zhs-platform")

# ============================ 绑定 ============================

bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")

# ============================ 安全 ============================

# 限制请求行大小 (防 slowloris)
limit_request_line = int(os.getenv("GUNICORN_LIMIT_REQUEST_LINE", "4094"))
limit_request_fields = int(os.getenv("GUNICORN_LIMIT_REQUEST_FIELDS", "100"))
limit_request_field_size = int(os.getenv("GUNICORN_LIMIT_REQUEST_FIELD_SIZE", "8190"))
