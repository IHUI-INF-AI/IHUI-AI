<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 主工作区「瘦身波」不采纳 · 128 删除意图只作证据（2026-11-08）

## 结论

`D:\IHUI-AI` 主工作区（当时 HEAD `1513c11c13`）长期挂着 128 个已暂存删除 + 85 个已暂存改写 + 66 个未暂存编辑 + 40 个未跟踪条目。经只读取证，判定为「一套没做完的仓库瘦身」，其**删除部分不采纳**。

## 驳回三条理由

1. **从未进过任何分支，无提交历史可追。** `git log --all --diff-filter=D` 对 `benchmarks/agent-capability/README.md`、`scripts/lib/gate-cache.mjs`、`docs/tickets/2026-11/*` 等路径均为空；删除只存在于本地索引与工作树，任何 ref 都不含这批删除。
2. **删掉的是刚建成的治理脚手架与票面。** `gate-cache`、`push-receipt`（连带 `.husky/pre-push` 的 receipt 段）、`tree-materialize`、`typecheck-concurrent`、`dist-content-cache` 均在删除集内；`docs/tickets/2026-11/` 整个目录 31 张票被清空；`benchmarks/agent-capability` 33 文件连同 `.github/workflows/agent-capability-eval.yml` 一并消失。
3. **留下三处悬空引用，ai-service 当场不可启动。** `app/routers/tools.py` 顶层 `from ..services.codebase_index_status import ...` 与 `codebase_symbol_catalog`、`app/services/agent_run_control.py` 顶层 `from .agent_resume_semantics import ResumeBlockedError`，两模块已被删除；`app/core/auto_context.py` 函数级导入同样指向已删文件。

## 处置

- 删除意图**只作证据保全，不作事实采纳**：`deletions.list`（128 行）。
- 三层保全落在 `D:\DevEnv\backups\main-wt-rescue-20261108\`：`tracked.patch`（含暂存+未暂存+二进制）、`untracked.zip`（39 文件，排除 `.worktrees-archive/**`、`*.log.old`、e2e png）、`deletions.list`、`MANIFEST.txt`（含 sha256）。快照分支 `rescue/main-wt-20261108`（`5f5554e97e`，不推送、不动 main）。
- 主工作区已 `reset --hard origin/main`（`edd55907b7`），删除波不再存在；`docs/tickets`、benchmark、治理脚本、ai-service 被删模块全部随 main 恢复。

## 验收入口

- `git -C D:/IHUI-AI status --porcelain=v2`：tracked 面应为 0，只剩未跟踪评审集。
- `git -C D:/IHUI-AI rev-parse --verify refs/heads/rescue/main-wt-20261108`：应指向 `5f5554e97e`。
- `Test-Path D:/IHUI-AI/apps/ai-service/app/services/codebase_index_status.py`：应为 True。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
