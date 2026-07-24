# 供应链安全:当前用 tag pinning(python:3.12-slim),生产部署前应改为 digest pinning:
#   docker pull python:3.12-slim
#   docker inspect --format='{{index .RepoDigests 0}}' python:3.12-slim
#   替换下面 FROM 行为:FROM python:3.12-slim@sha256:<digest>
FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv
# hatchling 构建后端要求 packages=["app"] 存在,需先复制源码
COPY pyproject.toml ./
COPY app/ ./app/
RUN uv pip install --system --no-cache-dir .

# 供应链安全:同 builder 阶段,生产部署前应改为 digest pinning(见顶部注释)
FROM python:3.12-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
# LSP 依赖:typescript-language-server 供 /api/v1/lsp/* 端点 subprocess 调用
RUN npm install -g typescript-language-server typescript
RUN useradd -m -u 1001 aiuser
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --chown=aiuser:aiuser . .
USER aiuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
