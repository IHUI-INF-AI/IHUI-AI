FROM python:3.11-slim AS base

# 系统依赖: ffmpeg 视频切片 + libpq for psycopg2 (备用) + curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python 依赖 (分层缓存: 只在 pyproject 变更时重装)
COPY pyproject.toml ./
COPY app/__init__.py ./app/__init__.py
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "bcrypt<4.0" && \
    pip install --no-cache-dir -e .

# 复制源码
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY scripts/ ./scripts/

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/healthz || exit 1

# 非 root 运行
RUN useradd -m -u 1000 zhs && chown -R zhs:zhs /app
USER zhs

EXPOSE 8000

# 启动: alembic upgrade head + uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 --proxy-headers"]
