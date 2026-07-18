# 本地 CI 演练工作流

本目录用于在本地 Docker 中跑 GitHub Actions 工作流,使用 [nektos/act](https://github.com/nektos/act) 工具。

## 安装 act

```powershell
# Windows (Scoop)
scoop install act

# Windows (Chocolatey)
choco install act

# 或直接下载: https://github.com/nektos/act/releases
```

## 快速开始

```powershell
# 1. 复制 secrets 模板
Copy-Item .secrets.act.example .secrets.act

# 2. 跑指定工作流的指定 job
act -W .github/workflows/ci-monorepo.yml -j build

# 3. 跑所有 job
act -W .github/workflows/ci-monorepo.yml

# 4. dry-run(不实际执行,只打印步骤)
act -W .github/workflows/ci-monorepo.yml -n
```

## 文件说明

- `.actrc` — act 默认参数(镜像/workdir/env/secrets/volume)
- `.env.act` — 环境变量(与 GitHub Actions vars 对齐,无敏感信息)
- `.secrets.act.example` — secrets 模板,复制为 `.secrets.act` 后填入真实值
- `.secrets.act` — **被 .gitignore 忽略,不提交**

## 缓存加速

act 使用 `/tmp/act-cache` 作为 volume 缓存,重复运行会复用:

- node_modules
- pnpm store
- Playwright browsers
- Docker layers

## 与 GitHub Actions 的差异

1. **Docker 镜像**:本地用 `catthehacker/ubuntu:22.04`,GitHub 用 GitHub-hosted runners
2. **网络**:本地默认 `--network host`,可访问 localhost 服务;GitHub 隔离
3. **secrets**:本地从 `.secrets.act` 读取;GitHub 从 Actions secrets 读取
4. **artifact**:本地用 `--bind` 直接挂载;GitHub 用 artifact upload/download

## 常见问题

**Q: act 运行失败提示 "no event name"**
A: 加 `-W` 指定工作流文件,或加 `--eventpath` 指定 event payload

**Q: pnpm install 慢**
A: 首次运行会慢(下载依赖),后续复用 `/tmp/act-cache` 会快很多

**Q: Playwright 浏览器找不到**
A: `.env.act` 已设置 `PLAYWRIGHT_BROWSERS_PATH=/cache/ms-playwright`,首次运行会自动下载
