# /goal 目标状态

**目标**: 完整做完所有 P0/P1/P2/P3 后续建议（8 项），直到没有建议工作为止，工作收尾

**启动时间**: 2026-07-02 (本轮)
**目标状态**: 🟡 active

## 8 项建议任务清单

| # | 优先级 | 任务 | 状态 | 验证 |
|---|---|---|---|---|
| 1 | P0 | 修复 knip Configuration hints (3 个) | ✅ done (commit 7481a829) | `npm run scan:knip` 0 hints |
| 2 | P0 | 生成 docs/PENDING_COMPONENTS.md 清单 | ✅ done (commit a77afa3d) | 文件存在，含 19 个 component (5 组分类) |
| 3 | P1 | 完整 e2e 回归（无 -g 过滤） | pending | `npx playwright test` 全量通过 |
| 4 | P1 | AGENTS.md 加 port-drift + line-endings 守门 | ✅ done (commit 7481b7d8) | AGENTS.md +97 行 (端口 33 行 + 行尾 53 行) |
| 5 | P2 | clean.mjs 集成 _archive 清理 | ✅ done (commit 488f00fd) | `npm run clean -- --archive` 30 天前 _archive 自动删 |
| 6 | P2 | knip 结果落库 + commit 时校验 | 🟡 in-progress | knip.json 变更触发 scan:knip:hints (5-10s) |
| 7 | P3 | 拆分 admin views 接入 components/api/ | pending | 6-8 个 component 接入 |
| 8 | P3 | knip 排除动态 import 误报 | pending | false positive 减少 |

## 硬性指标（全部满足才算达成）

| # | 指标 | 验证命令 | 当前状态 |
|---|---|---|---|
| 1 | knip Configuration hints 0 个 | `npm run scan:knip` | ✅ 0 hints (1 个 reduntant 模式已用 `!src/main.ts` 排除) |
| 2 | PENDING_COMPONENTS.md 存在且含 18 个 component | 文件 grep | pending |
| 3 | 完整 e2e 回归全通过 | `npx playwright test` | pending |
| 4 | AGENTS.md 含 port-drift + line-endings 章节 | grep 关键字 | pending |
| 5 | clean.mjs 集成 _archive 清理 | `node scripts/clean.mjs --dry-run` | pending |
| 6 | lint-staged 含 knip 校验 | grep "knip" package.json | pending |
| 7 | 6 项核心守门全过 | typecheck/i18n/tokens/contrast/dead-code/knip | pending |
| 8 | 8 项 commit 全部 push 到 origin/main | `git log origin/main..HEAD` 退出码 0 | pending |

## 软性指标

- P3-7 接入 ≥ 6 个 component
- P3-8 false positive 减少 ≥ 50%

## 红线

- 不改 _theme-tokens.ts / _theme-tokens.scss
- 不动 AI 面板 / 边框 / 登录按钮样式
- 不删任何 view 文件
- 每个 P 项 1 个 commit（清晰可追溯）

## 评估校验规则

每完成 1 项 P 任务后跑相关验证，验证通过则 commit + 进入下一项；
全部完成后跑 6 项核心守门 + 推送，输出最终交付报告。
