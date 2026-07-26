# Contributing to IHUI AI / 贡献指南

感谢你对 IHUI AI 的兴趣!本文档指导你如何参与贡献。

## 快速开始

```bash
# 1. Fork & Clone
git clone https://github.com/<your-username>/IHUI-AI.git
cd IHUI-AI

# 2. 安装依赖(Node.js 20+, pnpm 9+)
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库/Redis/API Key

# 4. 启动数据库
docker compose up -d postgres redis

# 5. 运行数据库迁移
pnpm db:migrate

# 6. 启动开发服务器
pnpm dev
# web: http://localhost:3000
# api: http://localhost:3001
# ai-service: http://localhost:8000
```

## 开发规范

### 代码风格
- TypeScript Strict Mode
- ESLint + Prettier(配置在 `packages/eslint-config/`)
- 提交前自动检查(pre-commit hook)

### 提交规范(Conventional Commits)
```
<type>(<scope>): <subject>

feat: 新功能
fix: 修复 bug
docs: 文档
style: 格式(不影响代码逻辑)
refactor: 重构
test: 测试
chore: 构建/工具
```

### 分支命名
- `feat/<feature-name>` — 新功能
- `fix/<bug-description>` — Bug 修复
- `docs/<topic>` — 文档

## 提交 Pull Request

1. 创建功能分支:`git checkout -b feat/your-feature`
2. 提交改动:`git commit -m "feat(scope): 描述"`
3. 推送:`git push origin feat/your-feature`
4. 在 GitHub 创建 PR,描述改动内容 + 测试方式

### PR 检查清单
- [ ] 代码通过 `pnpm typecheck`
- [ ] 代码通过 `pnpm lint`
- [ ] 测试通过 `pnpm test`
- [ ] 新功能有对应测试
- [ ] 文档已更新(如需要)
- [ ] commit message 符合 Conventional Commits

## 多端同步开发

IHUI AI 是 8 端 monorepo(web/api/ai-service/desktop/extension/mobile-rn/miniapp-taro/cli)。新功能默认需要 8 端同步(详见 `AGENTS.md` §9)。

## 报告 Issue

- Bug 报告:使用 Bug Report 模板
- 功能建议:使用 Feature Request 模板
- 安全漏洞:见 `SECURITY.md`(私密报告)

## 行为准则

参与本项目的所有贡献者需遵守 `CODE_OF_CONDUCT.md`。

## License

贡献的代码将在 Apache License 2.0 下发布。
