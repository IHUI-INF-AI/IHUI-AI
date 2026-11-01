# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# IHUI CLI Docker 镜像
# 构建: docker build -t ihui-ai -f scripts/install/Dockerfile .
# 运行: docker run --rm -it -v "$(pwd):/workspace" -w /workspace ihui-ai
#       (Windows: -v "%cd%:/workspace")
# 注意:容器内无宿主 Git/编辑器,写工具改动仅作用于挂载的工作区目录。

# 供应链钉版(2026-11-01,与 apps/ai-service/Dockerfile 同一批同一条纪律):
#   基座按**镜像索引 digest** 钉死(多架构那一条,不是某个 arch 的子 digest;tag 留在注释里,
#   升级时 digest 与 tag 同批改 —— 只改一处就会构建失败,这是有意的)。
#   digest 现读自 hub.docker.com 的 tag 元数据(media_type=application/vnd.oci.image.index.v1+json,
#   该 tag 上次推送 2026-04-22)。
FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0
# 可变 tag 形态(仅供人读,真正生效的是上面 digest):node:20-slim

LABEL org.opencontainers.image.title="IHUI AI Coding Agent CLI"
LABEL org.opencontainers.image.source="https://aizhs.top"
LABEL org.opencontainers.image.description="IHUI AI Coding Agent — 对标 Claude Code / Codex"
LABEL org.opencontainers.image.licenses="MIT"

# 全局安装 IHUI CLI(从 npm registry)
#
# 钉到具体版本:未钉版的 `npm install -g ihui-cli` 每次构建取"当时最新",于是
# ① 同一个 Dockerfile 两次构建产出两个不同镜像(不可复现),② 供应链上一枚被投毒的
# 发布会被后续任何一次构建静默吃进来。升级办法(一条命令,刻意留在这里):
#   改 apps/cli/package.json 版本 → pnpm --filter ihui-cli publish → 把下面版本号同步更新
# 现读:published latest 与 apps/cli/package.json 同为 1.0.0(`npm view ihui-cli version`)。
RUN npm install -g --no-audit --no-fund ihui-cli@1.0.0

# 工作区挂载点(运行时 -v 挂载宿主目录)
RUN mkdir -p /workspace
WORKDIR /workspace

# 默认进入交互式 REPL;CI/CD 用 docker run ihui-ai "task" 或 --help
ENTRYPOINT ["ihui"]
CMD ["--help"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
