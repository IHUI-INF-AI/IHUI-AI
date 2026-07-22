# IHUI CLI Docker 镜像
# 构建: docker build -t ihui-ai -f scripts/install/Dockerfile .
# 运行: docker run --rm -it -v "$(pwd):/workspace" -w /workspace ihui-ai
#       (Windows: -v "%cd%:/workspace")
# 注意:容器内无宿主 Git/编辑器,写工具改动仅作用于挂载的工作区目录。

FROM node:20-slim

LABEL org.opencontainers.image.title="IHUI AI Coding Agent CLI"
LABEL org.opencontainers.image.source="https://ihui.ai"
LABEL org.opencontainers.image.description="IHUI AI Coding Agent — 对标 Claude Code / Codex"
LABEL org.opencontainers.image.licenses="MIT"

# 全局安装 IHUI CLI(从 npm registry)
RUN npm install -g @ihui/cli

# 工作区挂载点(运行时 -v 挂载宿主目录)
RUN mkdir -p /workspace
WORKDIR /workspace

# 默认进入交互式 REPL;CI/CD 用 docker run ihui-ai "task" 或 --help
ENTRYPOINT ["ihui"]
CMD ["--help"]
