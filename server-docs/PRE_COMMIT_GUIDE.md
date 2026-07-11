# Pre-commit 钩子指南（Pre-commit Guide）

> 迁移自旧架构 `server/docs/PRE_COMMIT_GUIDE.md`，适配新架构（TS Monorepo + Husky + lint-staged）。

## 1. 概述

IHUI-AI 使用 [Husky](https://typicode.github.io/husky/) 管理 Git hooks，在提交前自动执行代码质量检查，阻止不合规代码进入仓库。

钩子配置位于 `.husky/pre-commit`。

## 2. 钩子执行流程

```
git commit → .husky/pre-commit → lint-staged → 通过则提交 / 失败则中止
```

## 3. pre-commit 执行的检查项

| 检查项       | 工具                             | 作用              | 失败处理                       |
| ------------ | -------------------------------- | ----------------- | ------------------------------ |
| 代码格式化   | Prettier                         | 统一代码风格      | 自动修复后重试                 |
| Lint         | ESLint                           | 静态错误/坏味道   | 自动修复可修复项，剩余报错中止 |
| 类型检查     | tsc                              | 类型错误          | 中止提交                       |
| 敏感信息扫描 | `scripts/check-api-key-leak.mjs` | 检测 API Key 泄漏 | 中止提交                       |

## 4. lint-staged 配置

`package.json` 中的 `lint-staged` 段定义了针对暂存文件的增量检查：

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

## 5. 本地使用

### 5.1 正常提交

```bash
git add .
git commit -m "feat: 新增功能"
# Husky 自动触发 pre-commit，执行 lint-staged
```

### 5.2 跳过钩子（仅紧急情况）

```bash
git commit --no-verify -m "hotfix: 紧急修复"
```

> ⚠️ 跳过钩子会绕过所有质量检查，仅限生产紧急 hotfix 使用，并在事后补跑检查。

### 5.3 手动运行检查

```bash
# 全量 lint
pnpm lint

# 全量类型检查
pnpm turbo run typecheck

# 手动执行敏感信息扫描
node scripts/check-api-key-leak.mjs
```

## 6. 常见问题

### Q1：pre-commit 报 ESLint 错误如何处理？

```bash
# 自动修复
pnpm eslint --fix <file>

# 查看剩余错误
pnpm eslint <file>
```

### Q2：pre-commit 很慢怎么办？

- lint-staged 仅检查暂存文件，已是增量。
- 若仍慢，检查是否有大型生成文件被误加入暂存。
- 类型检查走 `tsc --noEmit`，如耗时过长可临时 `--no-verify` 提交并在 CI 验证。

### Q3：如何新增 pre-commit 检查项？

1. 在 `.husky/pre-commit` 中追加命令，或
2. 在 `package.json` 的 `lint-staged` 中追加文件匹配规则。

## 7. 与 CI 的关系

pre-commit 是**第一道防线**（本地、增量、快速），CI（`.github/workflows/ci.yml`）是**第二道防线**（全量、严格）。两者检查项应保持一致，pre-commit 失败的代码不应进入 CI。
