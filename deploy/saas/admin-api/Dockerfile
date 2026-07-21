# IHUI-AI SaaS Admin API Dockerfile
# 阶段 1:deps - 安装依赖(利用 Docker 缓存)
# 阶段 2:runtime - 复制 dist + 启动

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN corepack enable && corepack prepare pnpm@latest --activate 2>/dev/null || true
RUN npm install --omit=dev --no-audit --no-fund 2>&1 | tail -5 || \
    pnpm install --prod --frozen-lockfile 2>&1 | tail -5

# ---- 运行时镜像 ----
FROM node:20-alpine AS runtime
WORKDIR /app

# 系统工具(docker CLI 用于管理客户容器,git 用于备份元信息)
RUN apk add --no-cache docker-cli git bash

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src

# 非 root 用户(安全)
RUN addgroup -S app && adduser -S app -G app
# docker.sock 需要特定权限,简化使用 root(容器内仅监听 localhost,安全可控)
# USER app  # 暂不切换,因需要访问 docker.sock

ENV NODE_ENV=production
ENV PORT=8081
ENV HOST=127.0.0.1

EXPOSE 8081

# 启动(用 tsx 运行 TypeScript,无需构建)
CMD ["node", "--import", "tsx", "src/index.ts"]
