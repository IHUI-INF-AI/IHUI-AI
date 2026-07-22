FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir uv
# hatchling 构建后端要求 packages=["app"] 存在,需先复制源码
COPY pyproject.toml ./
COPY app/ ./app/
RUN uv pip install --system --no-cache-dir .

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
