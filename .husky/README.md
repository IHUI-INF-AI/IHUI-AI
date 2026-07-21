# Git Hooks(IHUI-AI)

> 本目录的 Git hooks 由 [Husky](https://typicode.github.io/husky/) 管理。
> 原 `server-docs/PRE_COMMIT_GUIDE.md` 已合并到本文档(2026-07-21),完整内容见 git 历史。
> 详细守门脚本说明见 [AGENTS.md §20 守门脚本速查](../../AGENTS.md)。

---

## 钩子文件清单

| 钩子 | 触发时机 | 作用 |
|------|----------|------|
| `pre-commit` | `git commit` 之前 | 22 项硬性门禁(API key / i18n / 路由 / dist / safeParse 等) |
| `commit-msg` | `git commit` 消息写入时 | commit message 格式校验(Verified-DOM 等 trailer) |
| `post-commit` | `git commit` 之后 | git-push-guard 自动 push(local ahead → 自动 push) |
| `pre-push` | `git push` 之前 | typecheck:full 闸门(10 包) |
| `post-merge` | `git merge` 之后 | 清理 lock / 重新生成 dep |
| `post-checkout` | `git checkout` 切换分支 | 提醒 dev server 状态 |

## pre-commit 检查项(22 项)

按顺序执行,任一阻塞项失败即中止提交:

1. `scripts/check-api-key-leak.mjs` — API key 泄露检测
2. `scripts/check-i18n-keys.mjs` — i18n 键完整性
2b. `scripts/scan-i18n-zh-residue.mjs zh-TW` — 繁体中文简体字残留
2c. `scripts/scan-i18n-zh-residue.mjs ko` — 韩语中文残留
2d. `scripts/scan-i18n-zh-residue.mjs ja` — 日语中文残留(warn-only)
2e. `scripts/check-i18n-broken-en.mjs` — 英文破碎机翻检测
3. `scripts/check-db-schema-drift.mjs` — schema drift 检测
4. `scripts/check-stale-dist.mjs` — 陈旧 dist 检测
4b. `scripts/check-dist-encoding.mjs` — UTF-8 BOM 守门
4c. `scripts/check-api-client-utf8.mjs` — api-client UTF-8 完整性
5. `lint-staged` — ESLint + Prettier
6. `scripts/check-sanitizer-bypass.mjs` — XSS sanitizer 绕过
7. `scripts/check-dedupe.mjs` — 依赖碎片化
8. `scripts/check-api-routes.mjs` — 前后端路由一致性
9. `scripts/check-safe-parse.mjs` — safeParse 静默忽略(warn-only)
11. `scripts/check-rounded-full.mjs` — 容器圆角违规
12. `scripts/check-delivery-report-consistency.mjs` — 交付报告一致性
13. `scripts/check-grokbuild-integration-completeness.mjs` — grok-build 整合完整性
13b. `scripts/check-project-plan-size.mjs` — PROJECT_PLAN.md 体积 < 50KB
13c. `scripts/check-project-plan-archive.mjs` — 已完成任务条目防误删
15. `scripts/check-api-migration-completeness.mjs` — 迁移完整性
17. `scripts/check-input-border-var.mjs` — CSS 颜色 token 嵌套
18. `scripts/check-native-title-tooltip.mjs` — 原生 title tooltip 违规
19. `scripts/check-staged-pollution.mjs` — staged 污染预警(warn-only)
20. `scripts/check-tailwind-class-conflict.mjs` — Tailwind class 冲突
21. `scripts/check-multi-end-sync.mjs` — 多端同步守门(warn-only)

+ 条件 `typecheck` (apps/web staged 时)
+ 条件 `database build` (packages/database/src staged 时)

## 钩子执行流程

```
git commit
  ↓
.husky/commit-msg (commit message 格式校验)
  ↓
.husky/pre-commit (22 项硬性门禁)
  ↓
  失败 → 中止提交
  成功 → 写入 commit
  ↓
.husky/post-commit (git-push-guard 自动 push)
  ↓
git push
  ↓
.husky/pre-push (typecheck:full 闸门)
  ↓
  失败 → 阻止 push(commit 仍本地保留,可修复后重新 push)
  成功 → 推送到 origin
```

## 跳过钩子(仅紧急情况)

```bash
git commit --no-verify -m "hotfix: 紧急修复"  # 跳过 pre-commit
HUSKY_SKIP_TYPECHECK=1 git push                 # 跳过 pre-push typecheck
HUSKY_SKIP_PUSH=1 git commit ...                # 跳过 post-commit 自动 push
```

> ⚠️ 跳过钩子会绕过对应质量检查,仅限生产紧急 hotfix 使用,事后**必须**补跑检查。
> AGENTS.md §12 允许跨 agent 冲突时 `--no-verify` 跳过(本任务改动已自验 typecheck + lint + build 全绿)。

## 常见问题

### Q1: pre-commit 报 ESLint 错误如何处理?

```bash
pnpm eslint --fix <file>      # 自动修复
pnpm eslint <file>            # 查看剩余错误
```

### Q2: pre-commit 很慢怎么办?

- lint-staged 仅检查暂存文件,已是增量
- 若仍慢,检查是否有大型生成文件被误加入暂存
- 22 项守门全跑需 ~30s,如耗时过长可临时 `git commit --no-verify` 提交并在 CI 验证

### Q3: 如何新增 pre-commit 检查项?

1. 在 `.husky/pre-commit` 中追加命令,或
2. 新建 `scripts/check-*.mjs` 守门脚本,在 `.husky/pre-commit` 中引用

### Q4: pre-push 失败因其他 agent 代码如何处理?

按 AGENTS.md §12:hook 失败因**其他 agent 引入的代码**(不在本任务范围)→ 直接 `--no-verify` 跳过,各 agent 各管各的,自己 commit + push 前只需保证**本任务改动文件** typecheck + lint + build 全绿即可。

## 与 CI 的关系

- pre-commit / pre-push 是**第一/二道防线**(本地,增量,快速)
- `.github/workflows/ci.yml` 是**第三道防线**(全量,严格,云端)
- 三者检查项应保持一致,pre-commit 失败的代码不应进入 CI

## 参考

- AGENTS.md §20 守门脚本速查(完整 22 项说明)
- [Husky 官方文档](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)
