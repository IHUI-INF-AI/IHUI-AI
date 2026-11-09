<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 远端分支清点（只读）· 2026-11-08

> 性质：**只读清点**。没有删除/重命名任何分支，没有提交、没有推送、没有修改产品代码，没有跑质量门。唯一落盘是本文件。

## 0. 快照与口径

| 项 | 值 |
|---|---|
| 基线 main | `82aac6deba6d94e14443238e976cb5320a85021b`（2026-11-08 21:51:17 +0800） |
| 未合远端分支 | **172** 条（`git branch -r --no-merged <baseline>`） |
| 其中 cross-end-auto-\* | **58** 条（用户口径 57；两次读数间从 56 涨到 58，该线仍在长。另有 1 条同源旧命名 `cross-end-sync-204002`，非 auto 前缀） |
| 非流水线分支 | 114 条 |
| 清理期间 main 仍在前进 | 是。首轮读数时 main 为 `0994e3a9`，21:51 前进到 `82aac6de`；本表全部读数固定钉在 `82aac6de` 计算 |

口径说明：

- **实质提交数**：`git rev-list --count --no-merges <main>..<branch>`，即不含合并提交。
- **最近提交**：分支 tip 的 committer date（只取日期；cross-end-auto 的原始时区为 UTC）。
- **涉及顶层目录**：
  `git diff --name-only <main>...<branch>`（merge-base→分支 tip，只算分支自己的改动），取路径第一段。
- **覆盖判据**：`git cherry`（patch-id 是否已在 main）+ `git diff --name-only <main> <branch>`（分支改过的文件当前是否与 main 逐字节一致）+ `git branch -r --contains`（是否已被后续分支整支包含）。**不是按分支名/日期猜**。
- **cherry 超时**：4 条（`ihui-backup/main-20260927-r1`、`agent/l14497-g343-residual`、`agent/l29234-g77-gen-close`、`agent/l29253-a4a10`，单条 90s 上限），这些行标注“超时”，不作覆盖结论。
- **未核对项**：本机没有 `gh`/GitHub 凭据，**没有核对哪些分支还挂着 open PR**。执行删除前必须先查 PR 状态。

## 1. 总览

| 定性 | 数量 | 处置基调 |
|---|---|---|
| 有实质增量且仍有效（A） | 68 | 保留/复核后合；不得直接删 |
| 已被后续分支或 main 覆盖（B） | 12 | 可安全弃（含 5 条“随载体分支合入”） |
| 流水线自动快照（C） | 58 | 关自动建 + 定期清理；只留最新 1 条 |
| 陈旧历史线（D） | 34 | 多为可弃/归档后弃；备份线与台账快照单独确认 |
| **合计** | **172** | |

关键事实：58 条 cross-end-auto 全部由 `bot@ihui.top` 造出、每支恰好 **1 笔** main 外提交、**只有 9 个不同 patch-id**；4 个核心派生文件中 `distribution/index.css` 在 58 支里**逐字节相同**，3 个 mobile-rn 屏幕有 **56 支相同、仅最新 2 支不同**（web 源文件当天变更后重新派生）。

## 2. 全量清点表（非流水线 114 条）

> A 类的“仍有效”指 main 外确有未合增量；是否值得继续做需业务确认。标“文档/台账面”的只动计划/README/文档，风险低。

| # | 分支 | 实质提交数 | 最近提交 | 涉及顶层目录 | 定性 | 依据（读数） |
|---|---|---|---|---|---|---|
| 1 | `fix/api-misc-p1-1108` | 4 | 2026-11-08 | README.en.md, README.md, apps | 有实质增量且仍有效 | cherry +4/-0；14/14 文件当前不同；在飞工作树 D:/IHUI-AI-wt-api-misc-p1-1108 |
| 2 | `fix/crossui-p0-p1-1108` | 4 | 2026-11-08 | apps, packages | 有实质增量且仍有效 | cherry +4/-0；27/27 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-crossui-p0-1108 |
| 3 | `feat/craft-anything-mcp-1108` | 3 | 2026-11-08 | README.en.md, README.md, apps, packages | 有实质增量且仍有效 | cherry +3/-0；18/18 文件当前不同 |
| 4 | `fix/redscan-main-red-1108` | 25 | 2026-11-08 | apps, packages | 有实质增量且仍有效 | cherry +25/-0；83/83 文件当前不同；在飞工作树 D:/DevEnv/main-clean-1108 |
| 5 | `fix/api-admin-rbac-p1-1108` | 59 | 2026-11-08 | PROJECT_PLAN.md, README.en.md, README.md, apps, packages …(+1) | 有实质增量且仍有效 | cherry +59/-0；118/118 文件当前不同；在飞工作树 D:/IHUI-AI-wt-admin-rbac-1108 |
| 6 | `fix/plan-findings-1108` | 1 | 2026-11-08 | PROJECT_PLAN.md, docs | 有实质增量且仍有效（文档/台账面） | cherry +1/-0；2/2 文件当前不同；在飞工作树 D:/IHUI-AI-cut1 |
| 7 | `feat/cli-wb-port-1108` | 2 | 2026-11-08 | README.en.md, README.md, apps | 有实质增量且仍有效 | cherry +2/-0；22/22 文件当前不同 |
| 8 | `feat/qoder-port-1108` | 4 | 2026-11-08 | README.en.md, README.md, apps, config, packages | 有实质增量且仍有效 | cherry +4/-0；44/44 文件当前不同 |
| 9 | `feat/trae-parity-1108` | 4 | 2026-11-08 | README.en.md, README.md, apps, packages | 有实质增量且仍有效 | cherry +4/-0；26/26 文件当前不同 |
| 10 | `wt/super-agent-isolation-1107` | 5 | 2026-11-08 | PROJECT_PLAN.md, README.en.md, README.md, apps, packages | 有实质增量且仍有效 | cherry +5/-0；26/26 文件当前不同 |
| 11 | `feat/super-agent-event-sources-1107` | 2 | 2026-11-07 | PROJECT_PLAN.md, README.en.md, README.md, apps, packages | 有实质增量且仍有效 | cherry +2/-0；17/17 文件当前不同 |
| 12 | `feat/super-agent-web-panel-1107` | 2 | 2026-11-07 | PROJECT_PLAN.md, README.en.md, README.md, apps, packages …(+1) | 有实质增量且仍有效 | cherry +2/-0；20/20 文件当前不同 |
| 13 | `feat/super-agent-slow-judge-1107` | 1 | 2026-11-07 | PROJECT_PLAN.md, apps, packages | 有实质增量且仍有效 | cherry +1/-0；11/11 文件当前不同 |
| 14 | `fix/main-gate-reds-1107` | 10 | 2026-11-07 | README.en.md, README.md, apps, packages, scripts | 有实质增量且仍有效 | cherry +8/-2；10/12 文件当前不同 |
| 15 | `fix/loomy-ship-out` | 3 | 2026-11-07 | PROJECT_PLAN.md, apps, scripts | 有实质增量且仍有效 | cherry +2/-1；3/5 文件当前不同 |
| 16 | `fix/api-defect-mining-1107` | 22 | 2026-11-07 | .husky, README.en.md, README.md, apps, docs …(+1) | 有实质增量且仍有效 | cherry +22/-0；95/95 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-api-defect-mining-1107 |
| 17 | `fix/cli-defect-mining-1107` | 9 | 2026-11-07 | apps, docs | 有实质增量且仍有效 | cherry +9/-0；14/14 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-cli-defect-mining-1107 |
| 18 | `fix/db-defect-mining-1107` | 15 | 2026-11-07 | .github, README.en.md, README.md, apps, deploy …(+3) | 有实质增量且仍有效 | cherry +14/-1；48/51 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-db-defect-mining-1107 |
| 19 | `fix/mobile-rn-existing-test-reds-1106` | 4 | 2026-11-07 | README.en.md, README.md, apps | 有实质增量且仍有效 | cherry +4/-0；4/10 文件当前不同 |
| 20 | `fix/web-deep-audit-1107` | 11 | 2026-11-07 | README.en.md, README.md, apps, packages, scripts | 有实质增量且仍有效 | cherry +11/-0；48/48 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-web-deep-audit-1107 |
| 21 | `feat/hooks-dispatch-and-control-frames-1106` | 1 | 2026-11-07 | README.md, apps, packages | 有实质增量且仍有效 | cherry +1/-0；8/21 文件当前不同 |
| 22 | `chore/readme-slim-1107` | 5 | 2026-11-07 | README.en.md, README.md, docs, scripts | 有实质增量且仍有效 | cherry +5/-0；6/6 文件当前不同 |
| 23 | `fix/credential-plaintext-1106` | 1 | 2026-11-07 | README.en.md, README.md, apps | 有实质增量且仍有效 | cherry +1/-0；14/14 文件当前不同 |
| 24 | `chore/repo-hygiene-1106` | 1 | 2026-11-07 | README.en.md, README.md, docs, scripts | 有实质增量且仍有效 | cherry +1/-0；4/4 文件当前不同 |
| 25 | `integrate/release-20261106` | 25 | 2026-11-07 | AGENTS.md, README.en.md, README.md, apps, docs …(+4) | 有实质增量且仍有效 | cherry +24/-1；106/125 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/integrate-release-20261106 |
| 26 | `feat/cli-resume-and-diff-preview-1106` | 7 | 2026-11-07 | README.en.md, README.md, apps, docs, packages …(+1) | 有实质增量且仍有效 | cherry +5/-2；30/31 文件当前不同 |
| 27 | `fix/infra-defect-mining-1107` | 23 | 2026-11-07 | .github, .husky, README.en.md, README.md, deploy …(+3) | 有实质增量且仍有效 | cherry +23/-0；51/51 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-infra-defect-mining-1107 |
| 28 | `fix/ui-defect-mining-1107` | 13 | 2026-11-07 | README.en.md, README.md, apps, packages, scripts | 有实质增量且仍有效 | cherry +13/-0；67/67 文件当前不同 |
| 29 | `fix/ai-service-audit-1107` | 13 | 2026-11-07 | apps, scripts | 有实质增量且仍有效 | cherry +13/-0；34/34 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-ai-service-audit |
| 30 | `fix/desktop-defect-mining-1107` | 16 | 2026-11-07 | README.md, apps, scripts | 有实质增量且仍有效 | cherry +16/-0；28/28 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-desktop-defect-mining-1107 |
| 31 | `feat/gate-300-clean` | 9 | 2026-11-07 | AGENTS.md, README.en.md, README.md, apps, scripts | 有实质增量且仍有效 | cherry +6/-3；13/96 文件当前不同；在飞工作树 D:/ihui-gate300-replay |
| 32 | `feat/agent-team-edit-conflict-1106` | 1 | 2026-11-07 | README.en.md, README.md, apps | 有实质增量且仍有效 | cherry +1/-0；10/10 文件当前不同 |
| 33 | `fix/web-coldstart-restore-1106` | 5 | 2026-11-07 | README.en.md, README.md, apps | 有实质增量且仍有效 | cherry +5/-0；10/10 文件当前不同 |
| 34 | `fix/web-test-drift-1106` | 4 | 2026-11-07 | README.en.md, README.md, apps, packages | 有实质增量且仍有效 | cherry +4/-0；52/52 文件当前不同 |
| 35 | `fix/db-schema-drift-share-token-1106` | 1 | 2026-11-07 | README.en.md, README.md, packages | 有实质增量且仍有效 | cherry +1/-0；4/4 文件当前不同 |
| 36 | `fix/main-typecheck-reds-1106` | 2 | 2026-11-07 | apps, packages | 有实质增量且仍有效 | cherry +2/-0；7/7 文件当前不同 |
| 37 | `feat/cap-idempotent-changeset-1106` | 7 | 2026-11-07 | PROJECT_PLAN.md, README.en.md, README.md, apps, config …(+2) | 有实质增量且仍有效 | cherry +6/-1；51/57 文件当前不同 |
| 38 | `feat/rn-compat-primitives-20261106` | 2 | 2026-11-06 | README.en.md, README.md, apps | 有实质增量且仍有效 | cherry +2/-0；2/7 文件当前不同 |
| 39 | `feat/cli-b49-capability-1106` | 3 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +3/-0；6/6 文件当前不同 |
| 40 | `test/live-doc-collision-f9-align-1106` | 1 | 2026-11-06 | scripts | 有实质增量且仍有效 | cherry +1/-0；1/1 文件当前不同 |
| 41 | `feat/bounded-sysjob-verdict-1106` | 1 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +1/-0；4/4 文件当前不同 |
| 42 | `feat/audit-observability-tri-state-1106` | 1 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +1/-0；6/6 文件当前不同 |
| 43 | `fix/web-rum-startup-marks-1106` | 1 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +1/-0；4/4 文件当前不同 |
| 44 | `fix/ai-service-prompt-batch-1106` | 2 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +2/-0；3/4 文件当前不同 |
| 45 | `fix/miniapp-distribution-spacing-1106` | 1 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +1/-0；1/1 文件当前不同 |
| 46 | `fix/ai-service-unread-fs-store-1106` | 5 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +5/-0；17/19 文件当前不同 |
| 47 | `fix/ai-service-admission-runtime-1106` | 2 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +2/-0；6/7 文件当前不同 |
| 48 | `feat/self-heal-rescan-merge-1106` | 1 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +1/-0；3/3 文件当前不同 |
| 49 | `feat/agent-trace-report-lanes-b49` | 1 | 2026-11-06 | packages | 有实质增量且仍有效 | cherry +1/-0；6/6 文件当前不同 |
| 50 | `fix/cli-i18n-scan-incomplete` | 1 | 2026-11-06 | packages | 有实质增量且仍有效 | cherry +1/-0；5/5 文件当前不同 |
| 51 | `feat/send-admission-ahead` | 1 | 2026-11-06 | packages | 有实质增量且仍有效 | cherry +1/-0；3/3 文件当前不同 |
| 52 | `converge/saas-prometheus-exposure` | 3 | 2026-11-06 | README.en.md, README.md, deploy | 有实质增量且仍有效 | cherry +3/-0；5/5 文件当前不同 |
| 53 | `converge/cli-atomic-write` | 2 | 2026-11-06 | README.en.md, README.md, apps | 有实质增量且仍有效 | cherry +2/-0；10/10 文件当前不同 |
| 54 | `converge/ci-060-061-062` | 4 | 2026-11-06 | README.en.md, README.md, docs, packages, scripts | 有实质增量且仍有效 | cherry +4/-0；10/10 文件当前不同 |
| 55 | `fix/cli-typecheck-tests-1105` | 23 | 2026-11-06 | README.en.md, README.md, apps, scripts | 有实质增量且仍有效 | cherry +23/-0；109/111 文件当前不同 |
| 56 | `fix/message-center-flake` | 1 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +1/-0；1/1 文件当前不同 |
| 57 | `dependabot/npm_and_yarn/ws-8.22.0` | 1 | 2026-11-06 | apps, pnpm-lock.yaml | 有实质增量且仍有效 | cherry +1/-0；3/3 文件当前不同 |
| 58 | `fix/test-python-qoder-midnight-1106` | 1 | 2026-11-06 | apps | 有实质增量且仍有效 | cherry +1/-0；1/1 文件当前不同 |
| 59 | `fix/plan-ledger-close-1106` | 2 | 2026-11-06 | .ihui-agent, PROJECT_PLAN.md, README.en.md, README.md, scripts | 有实质增量且仍有效 | cherry +2/-0；7/7 文件当前不同 |
| 60 | `fix/knip-unused-exports-1105` | 1 | 2026-11-05 | apps | 有实质增量且仍有效 | cherry +1/-0；4/4 文件当前不同 |
| 61 | `fix/orphan-deletion-guard` | 2 | 2026-11-05 | README.md, apps, scripts | 有实质增量且仍有效 | cherry +2/-0；6/6 文件当前不同 |
| 62 | `fix/plan-row-restore-1105` | 8 | 2026-11-05 | .ihui-agent, PROJECT_PLAN.md, README.en.md, README.md, apps …(+1) | 有实质增量且仍有效 | cherry +7/-1；8/9 文件当前不同 |
| 63 | `fix/flakes-predictive-plaza` | 2 | 2026-11-05 | apps | 有实质增量且仍有效 | cherry +2/-0；2/2 文件当前不同 |
| 64 | `fix/miniapp-locales-pin` | 1 | 2026-11-05 | apps | 有实质增量且仍有效 | cherry +1/-0；3/3 文件当前不同 |
| 65 | `fix/app-icp-filing-claim-1105` | 1 | 2026-11-05 | PROJECT_PLAN.md | 有实质增量且仍有效（文档/台账面） | cherry +1/-0；1/1 文件当前不同 |
| 66 | `fix/knip-trash-prune-entry` | 1 | 2026-11-05 | knip.jsonc | 有实质增量且仍有效 | cherry +1/-0；1/1 文件当前不同 |
| 67 | `fix/desktop-update-manifest` | 1 | 2026-11-05 | README.en.md, README.md, scripts | 有实质增量且仍有效 | cherry +1/-0；8/8 文件当前不同 |
| 68 | `land/b49-1105` | 15 | 2026-11-05 | apps, docs, packages | 有实质增量且仍有效 | cherry +2/-13；29/74 文件当前不同 |
| 69 | `agent/l14361-g811-imagepool` | 1 | 2026-10-20 | PROJECT_PLAN.md | 已被后续分支或 main 覆盖（可安全弃） | cherry +0/-1；1/1 文件当前不同 |
| 70 | `agent/l29247-notify-single` | 1 | 2026-10-20 | PROJECT_PLAN.md | 已被后续分支或 main 覆盖（可安全弃） | cherry +0/-1；1/1 文件当前不同 |
| 71 | `converge/desktop-auto-refresh` | 1 | 2026-11-06 | apps | 已被后续分支或 main 覆盖（可安全弃） | cherry +0/-1；0/1 文件当前不同 |
| 72 | `cross-end-sync-204002` | 2 | 2026-11-04 | .github | 已被后续分支或 main 覆盖（可安全弃） | cherry +0/-2；0/1 文件当前不同 |
| 73 | `dependabot/github_actions/actions/deploy-pages-5.0.1` | 1 | 2026-11-02 | .github | 已被后续分支或 main 覆盖（可安全弃） | cherry +0/-1；1/1 文件当前不同 |
| 74 | `dependabot/github_actions/gitleaks/gitleaks-action-3.0.0` | 1 | 2026-11-02 | .github | 已被后续分支或 main 覆盖（可安全弃） | cherry +0/-1；1/1 文件当前不同 |
| 75 | `feat/homefont-v1` | 2 | 2026-11-03 | apps | 已被后续分支或 main 覆盖（可安全弃） | cherry +0/-2；0/5 文件当前不同 |
| 76 | `fix/backend-gates-263-197-52-94-260-62` | 6 | 2026-11-06 | README.en.md, README.md, apps, packages, pnpm-lock.yaml …(+2) | 已被后续分支或 main 覆盖（可安全弃） | cherry +6/-0；24/24 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-backend-gates-1106 |
| 77 | `fix/cli-unread-not-empty-1106` | 2 | 2026-11-06 | apps | 已被后续分支或 main 覆盖（可安全弃） | cherry +2/-0；3/3 文件当前不同 |
| 78 | `fix/gate-299-shell-form` | 4 | 2026-11-06 | README.en.md, README.md, scripts | 已被后续分支或 main 覆盖（可安全弃） | cherry +4/-0；7/7 文件当前不同 |
| 79 | `fix/gates-173-207-265-267-47-1106` | 1 | 2026-11-06 | AGENTS.md, README.en.md, README.md, apps, scripts | 已被后续分支或 main 覆盖（可安全弃） | cherry +1/-0；5/11 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-gates-5git |
| 80 | `fix/ui-gates-1106-r2` | 9 | 2026-11-07 | apps, packages, scripts | 已被后续分支或 main 覆盖（可安全弃） | cherry +9/-0；54/54 文件当前不同；在飞工作树 D:/IHUI-AI/.worktrees/wt-ui-gates-1106-r2 |
| 81 | `probe/artifacts-v7v8` | 4 | 2026-11-03 | .github | 陈旧历史线 | cherry +4/-0；2/2 文件当前不同 |
| 82 | `ci-knip-1103` | 2 | 2026-11-03 | apps, deploy, docs, knip.jsonc, packages …(+1) | 陈旧历史线 | cherry +1/-1；44/120 文件当前不同 |
| 83 | `dependabot/github_actions/actions/checkout-7.0.1` | 1 | 2026-11-03 | .github | 陈旧历史线（Dependabot） | cherry +1/-0；48/48 文件当前不同 |
| 84 | `dependabot/github_actions/actions/setup-node-7.1.0` | 1 | 2026-11-03 | .github | 陈旧历史线（Dependabot） | cherry +1/-0；39/39 文件当前不同 |
| 85 | `dependabot/github_actions/actions/upload-artifact-7.0.2` | 1 | 2026-11-03 | .github | 陈旧历史线（Dependabot） | cherry +1/-0；22/22 文件当前不同 |
| 86 | `dependabot/npm_and_yarn/babel/plugin-transform-spread-8.0.8` | 1 | 2026-11-01 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 87 | `dependabot/npm_and_yarn/radix-ui/react-tooltip-1.4.1` | 1 | 2026-11-01 | apps, packages, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；3/3 文件当前不同 |
| 88 | `dependabot/npm_and_yarn/babel/plugin-transform-block-scoping-8.0.8` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 89 | `dependabot/npm_and_yarn/tarojs/plugin-platform-tt-4.3.1` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 90 | `dependabot/npm_and_yarn/bullmq-6.4.2` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 91 | `dependabot/npm_and_yarn/three-0.186.1` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 92 | `dependabot/npm_and_yarn/babel/plugin-transform-named-capturing-groups-regex-8.0.1` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 93 | `dependabot/npm_and_yarn/react-hook-form-7.91.0` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 94 | `dependabot/npm_and_yarn/tarojs/plugin-platform-swan-4.3.1` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 95 | `dependabot/npm_and_yarn/vscode-jsonrpc-10.0.0` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 96 | `dependabot/npm_and_yarn/drizzle-orm-0.45.4` | 1 | 2026-10-31 | apps, packages, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；3/3 文件当前不同 |
| 97 | `dependabot/npm_and_yarn/radix-ui/react-select-2.4.1` | 1 | 2026-10-31 | packages, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 98 | `dependabot/npm_and_yarn/expo-status-bar-58.0.4` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 99 | `dependabot/npm_and_yarn/fastify/compress-9.2.2` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 100 | `dependabot/npm_and_yarn/expo-secure-store-58.0.2` | 1 | 2026-10-31 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 101 | `wip/collect-20261029` | 6 | 2026-10-29 | README.en.md, README.ja.md, README.ko.md, README.md, apps …(+2) | 陈旧历史线 | cherry +6/-0；27/27 文件当前不同 |
| 102 | `cursor/readme-opening-476a` | 14 | 2026-10-29 | .loomy-attachments, README.en.md, README.ja.md, README.ko.md, README.md …(+3) | 陈旧历史线 | cherry +14/-0；36/42 文件当前不同 |
| 103 | `dependabot/npm_and_yarn/multi-491a176d85` | 1 | 2026-10-29 | apps, pnpm-lock.yaml | 陈旧历史线（Dependabot） | cherry +1/-0；3/3 文件当前不同 |
| 104 | `dependabot/github_actions/actions/setup-go-7` | 1 | 2026-10-29 | .github | 陈旧历史线（Dependabot） | cherry +1/-0；1/1 文件当前不同 |
| 105 | `dependabot/github_actions/gitleaks/gitleaks-action-3` | 1 | 2026-10-29 | .github | 陈旧历史线（Dependabot） | cherry +1/-0；1/1 文件当前不同 |
| 106 | `dependabot/github_actions/actions/setup-java-6` | 1 | 2026-10-29 | .github | 陈旧历史线（Dependabot） | cherry +1/-0；2/2 文件当前不同 |
| 107 | `dependabot/github_actions/docker/setup-qemu-action-4` | 1 | 2026-10-29 | .github | 陈旧历史线（Dependabot） | cherry +1/-0；1/1 文件当前不同 |
| 108 | `dependabot/github_actions/actions/setup-python-7` | 1 | 2026-10-29 | .github | 陈旧历史线（Dependabot） | cherry +1/-0；9/9 文件当前不同 |
| 109 | `dependabot/github_actions/mozilla-actions/sccache-action-0.0.11` | 1 | 2026-10-29 | .github | 陈旧历史线（Dependabot） | cherry +1/-0；1/1 文件当前不同 |
| 110 | `agent/l29234-g77-gen-close` | 1 | 2026-10-20 | PROJECT_PLAN.md | 陈旧历史线 | cherry 90s 超时；main 外 1 笔；1/1 文件当前不同 |
| 111 | `agent/l14497-g343-residual` | 1 | 2026-10-20 | PROJECT_PLAN.md | 陈旧历史线 | cherry 90s 超时；main 外 1 笔；1/1 文件当前不同 |
| 112 | `agent/l29253-a4a10` | 1 | 2026-10-20 | PROJECT_PLAN.md | 陈旧历史线 | cherry 90s 超时；main 外 1 笔；1/1 文件当前不同 |
| 113 | `rc-live` | 957 | 2026-10-19 | .github | 陈旧历史线（CI 心跳日志） | cherry +954/-3；46/46 文件当前不同 |
| 114 | `ihui-backup/main-20260927-r1` | 7778 | 2026-09-28 | .actrc, .arts, .check-api-routes-ignore.json, .dockerignore, .easignore …(+56) | 陈旧历史线 | cherry 90s 超时；main 外 7778 笔；7550/13727 文件当前不同 |

## 3. cross-end-auto 专组（58 条）

### 3.1 谁造的

造分支的是 [`.github/workflows/cross-end-sync.yml`](file:///D:/IHUI-AI/.github/workflows/cross-end-sync.yml) 的「提交并推送派生结果」步骤（[L155-L166](file:///D:/IHUI-AI/.github/workflows/cross-end-sync.yml#L155-L166)）：

- 先尝试 `git push origin HEAD:TARGET`（TARGET = PR head_ref 或 ref_name）；
- **push 失败**时执行 `BR="cross-end-auto-${github.run_id}"` → `git checkout -b` → `git push origin BR` → `gh pr create --base TARGET`。

main 受分支保护，所以每次「推到 main 且命中 paths」都会 push 失败一次，就新增一条分支 + 一个 PR。分支名里的后缀是 `github.run_id`，天然一次一分支、无去重。

触发面（[L12-L51](file:///D:/IHUI-AI/.github/workflows/cross-end-sync.yml#L12-L51)）：`push` 到 main/develop/release/* 且改动命中 apps/web、apps/mobile-rn、apps/miniapp-taro、packages/design-tokens、ui-react、ui-native、shared、scripts/sync-cross-end-cascade.mjs、gen-*/land-*/parity-auto/check-*/heal-*/plan-rn-token-pairing 等；`pull_request` 同 paths；`workflow_dispatch`；`schedule: 23 */6 * * *`（每 6 小时一次）。

### 3.2 多久长一个

首条 **2026-11-06 15:00:32Z**，末条 **2026-11-08 13:51:17Z**：**46.8 小时长 58 条 ≈ 1.24 条/小时 ≈ 30 条/天**。相邻间隔：最短 5 分钟、中位 **35 分钟**、最长 239 分钟。也就是说主要不是 6 小时定时任务在造，而是每次 main 推送命中派生目录就造一条。

### 3.3 会不会自动清理

**不会。** 全仓检索 `.github/workflows/*.yml` 与 `scripts/*.mjs`：没有任何 `git push origin --delete` / `refs/heads/... DELETE` / `gh pr close`；[`weekly-cleanup.yml`](file:///D:/IHUI-AI/.github/workflows/weekly-cleanup.yml) 只清运行产物，不碰分支。GitHub 的 “merge 后自动删头分支” 也不适用——这些自动 PR 没有被合，分支就一直留着。只在 main 合入才会自然消失。

### 3.4 是不是同一组派生件

是。58 条全部：

- 相对 main 只有 **1 笔**提交（parent 是当时的 main tip），作者全是 `bot@ihui.top`；
- 每支只动 **4–10 个文件**，全部在 `apps/` 下；
- 文件集合是同一组派生件：`apps/miniapp-taro/src/pages/distribution/index.css`、`apps/mobile-rn/src/screens/{FinanceScreen,FollowingScreen,HelpDetailScreen}.tsx`，后期还含 `apps/web/app/(main)/edu/attendance/SelfAttendanceTable.tsx`、`apps/web/app/(main)/sag2/PageClient.tsx`、vip/wallet 派生物；
- **9 个不同 patch-id**（G1×13、G2×10、G3×9、G4×7、G5×5、G6×5、G7×4、G8×3、G9×2），即同一补丁被重复提交 2–13 次；
- `distribution/index.css` 在 58 支中逐字节一致；3 个 mobile-rn 屏幕 **56 支一致**，仅最新 2 支（`cross-end-auto-42485797170`、`-42486425274`）因当天 web 源变更而重新派生。

**重要**：这组派生物当前**不在 main**——58 支里没有任何一支的改动文件全部与 main 相同（`stillDiffFiles` 最少也有 4 个，且核心 4 个派生文件全部仍差）。删分支等于删掉“待落地的派生结果”，但该结果是 `scripts/sync-cross-end-cascade.mjs` 可从 main 重新确定性生成的。

### 3.5 建议（仅建议，未动手）

1. **关掉“一次一分支”**：
   - 把 fallback 改成复用固定分支（例如 `cross-end-auto/pending`），用 `--force-with-lease` 只更新这一条，并复用同一个 PR（或评论触发重跑）；
   - 或把触发面收窄为“仅 `schedule` + 手动”，push 触发改为只做只读预览（`--json` 出漂移报告），不再 push；
   - 或 `gh pr create` 前先按 head 分支查重、存在则 `gh pr edit` 而不是新建。
2. **定期清理**：加一个每周（或每日）job，删除 `cross-end-auto-*` 中“超过 3 天且无 open PR”的分支；保留至多最新 1 条。现在 58 条里 56 条是纯重复，清理收益立竿见影。
3. **保留哪些**：只保留最新 `cross-end-auto-42486425274` 作为“当前派生结果”的参照；其余 57 条可批量删。等派生结果经正常 PR 落进 main 后，连这 1 条也可删。
4. **落地冲突提醒**：当前 main 工作树里 `apps/miniapp-taro/src/pages/distribution/index.css`、`apps/web/app/(main)/edu/attendance/SelfAttendanceTable.tsx`、`apps/web/app/(main)/sag2/PageClient.tsx` 已有**未提交的人改 WIP**；重跑派生/落 PR 前要先避让，别把别人的 WIP 带进自动提交（workflow 的 `git add` 只 stage 目录，不区分文件归属）。

| # | 分支 | 提交 | 最近提交(UTC) | 文件数 | patch-id 组 | 依据 |
|---|---|---|---|---|---|---|
| 1 | `cross-end-auto-42238334641` | 1 | 2026-11-06 15:00 | 5 | G5 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 2 | `cross-end-auto-42242310903` | 1 | 2026-11-06 15:26 | 5 | G5 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 3 | `cross-end-auto-42243946736` | 1 | 2026-11-06 15:38 | 5 | G5 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 4 | `cross-end-auto-42253787644` | 1 | 2026-11-06 16:40 | 5 | G5 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 5 | `cross-end-auto-42256733940` | 1 | 2026-11-06 16:59 | 5 | G5 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 6 | `cross-end-auto-42259615280` | 1 | 2026-11-06 17:19 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 7 | `cross-end-auto-42260566188` | 1 | 2026-11-06 17:25 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 8 | `cross-end-auto-42265940283` | 1 | 2026-11-06 17:58 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 9 | `cross-end-auto-42268686853` | 1 | 2026-11-06 18:19 | 6 | G8 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 10 | `cross-end-auto-42269893384` | 1 | 2026-11-06 18:26 | 6 | G8 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 11 | `cross-end-auto-42279119124` | 1 | 2026-11-06 19:29 | 6 | G8 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 12 | `cross-end-auto-42286300382` | 1 | 2026-11-06 20:17 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 13 | `cross-end-auto-42291486393` | 1 | 2026-11-06 20:55 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 14 | `cross-end-auto-42293487246` | 1 | 2026-11-06 21:07 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 15 | `cross-end-auto-42306577924` | 1 | 2026-11-06 22:47 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 16 | `cross-end-auto-42311094203` | 1 | 2026-11-06 23:25 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 17 | `cross-end-auto-42318697536` | 1 | 2026-11-07 00:37 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 18 | `cross-end-auto-42322427632` | 1 | 2026-11-07 01:14 | 4 | G2 | 1 笔 bot 提交；4/4 文件当前仍与 main 不同 |
| 19 | `cross-end-auto-42329318306` | 1 | 2026-11-07 02:32 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 20 | `cross-end-auto-42333853984` | 1 | 2026-11-07 03:29 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 21 | `cross-end-auto-42337579172` | 1 | 2026-11-07 04:18 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 22 | `cross-end-auto-42341214049` | 1 | 2026-11-07 05:11 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 23 | `cross-end-auto-42345468151` | 1 | 2026-11-07 06:11 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 24 | `cross-end-auto-42346284818` | 1 | 2026-11-07 06:22 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 25 | `cross-end-auto-42347427407` | 1 | 2026-11-07 06:37 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 26 | `cross-end-auto-42348737011` | 1 | 2026-11-07 06:55 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 27 | `cross-end-auto-42351066789` | 1 | 2026-11-07 07:28 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 28 | `cross-end-auto-42352422762` | 1 | 2026-11-07 07:47 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 29 | `cross-end-auto-42362457095` | 1 | 2026-11-07 10:11 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 30 | `cross-end-auto-42367889585` | 1 | 2026-11-07 11:27 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 31 | `cross-end-auto-42370923859` | 1 | 2026-11-07 12:10 | 5 | G1 | 1 笔 bot 提交；4/5 文件当前仍与 main 不同 |
| 32 | `cross-end-auto-42373008504` | 1 | 2026-11-07 12:36 | 9 | G3 | 1 笔 bot 提交；5/9 文件当前仍与 main 不同 |
| 33 | `cross-end-auto-42376008405` | 1 | 2026-11-07 13:19 | 9 | G3 | 1 笔 bot 提交；5/9 文件当前仍与 main 不同 |
| 34 | `cross-end-auto-42376592901` | 1 | 2026-11-07 13:27 | 9 | G3 | 1 笔 bot 提交；5/9 文件当前仍与 main 不同 |
| 35 | `cross-end-auto-42378975702` | 1 | 2026-11-07 13:58 | 9 | G3 | 1 笔 bot 提交；5/9 文件当前仍与 main 不同 |
| 36 | `cross-end-auto-42383871099` | 1 | 2026-11-07 15:00 | 9 | G3 | 1 笔 bot 提交；5/9 文件当前仍与 main 不同 |
| 37 | `cross-end-auto-42384902472` | 1 | 2026-11-07 15:13 | 9 | G3 | 1 笔 bot 提交；5/9 文件当前仍与 main 不同 |
| 38 | `cross-end-auto-42387535253` | 1 | 2026-11-07 15:44 | 9 | G3 | 1 笔 bot 提交；5/9 文件当前仍与 main 不同 |
| 39 | `cross-end-auto-42387860641` | 1 | 2026-11-07 15:50 | 9 | G3 | 1 笔 bot 提交；5/9 文件当前仍与 main 不同 |
| 40 | `cross-end-auto-42388539638` | 1 | 2026-11-07 15:58 | 9 | G3 | 1 笔 bot 提交；5/9 文件当前仍与 main 不同 |
| 41 | `cross-end-auto-42402263917` | 1 | 2026-11-07 18:41 | 10 | G7 | 1 笔 bot 提交；6/10 文件当前仍与 main 不同 |
| 42 | `cross-end-auto-42412657518` | 1 | 2026-11-07 20:52 | 10 | G7 | 1 笔 bot 提交；6/10 文件当前仍与 main 不同 |
| 43 | `cross-end-auto-42418936727` | 1 | 2026-11-07 22:10 | 10 | G7 | 1 笔 bot 提交；6/10 文件当前仍与 main 不同 |
| 44 | `cross-end-auto-42431386684` | 1 | 2026-11-08 00:55 | 10 | G7 | 1 笔 bot 提交；6/10 文件当前仍与 main 不同 |
| 45 | `cross-end-auto-42448362873` | 1 | 2026-11-08 04:54 | 9 | G6 | 1 笔 bot 提交；6/9 文件当前仍与 main 不同 |
| 46 | `cross-end-auto-42454507320` | 1 | 2026-11-08 06:26 | 9 | G6 | 1 笔 bot 提交；6/9 文件当前仍与 main 不同 |
| 47 | `cross-end-auto-42459360537` | 1 | 2026-11-08 07:40 | 9 | G6 | 1 笔 bot 提交；6/9 文件当前仍与 main 不同 |
| 48 | `cross-end-auto-42465230334` | 1 | 2026-11-08 09:04 | 9 | G6 | 1 笔 bot 提交；6/9 文件当前仍与 main 不同 |
| 49 | `cross-end-auto-42467969964` | 1 | 2026-11-08 09:41 | 9 | G6 | 1 笔 bot 提交；6/9 文件当前仍与 main 不同 |
| 50 | `cross-end-auto-42478879147` | 1 | 2026-11-08 12:17 | 6 | G4 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 51 | `cross-end-auto-42479386797` | 1 | 2026-11-08 12:29 | 6 | G4 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 52 | `cross-end-auto-42481180415` | 1 | 2026-11-08 12:41 | 6 | G4 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 53 | `cross-end-auto-42481796533` | 1 | 2026-11-08 12:51 | 6 | G4 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 54 | `cross-end-auto-42482210951` | 1 | 2026-11-08 12:57 | 6 | G4 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 55 | `cross-end-auto-42482823683` | 1 | 2026-11-08 13:05 | 6 | G4 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 56 | `cross-end-auto-42483404763` | 1 | 2026-11-08 13:11 | 6 | G4 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 57 | `cross-end-auto-42485797170` | 1 | 2026-11-08 13:46 | 6 | G9 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |
| 58 | `cross-end-auto-42486425274` | 1 | 2026-11-08 13:51 | 6 | G9 | 1 笔 bot 提交；6/6 文件当前仍与 main 不同 |

## 4. 可执行清单（删除仅为建议，未执行）

### 4.1 可安全删（判据成立）

| 组 | 数量 | 清单/判据 |
|---|---|---|
| C · cross-end-auto | 58 | 全部 `cross-end-auto-*`。判据：1 笔 bot 派生提交、9 个 patch-id 重复、可由脚本重生成；保留最新 1 条即可 |
| B · 已被 main 覆盖 | 7 | `agent/l14361-g811-imagepool`、`agent/l29247-notify-single`、`converge/desktop-auto-refresh`、`cross-end-sync-204002`、`dependabot/github_actions/actions/deploy-pages-5.0.1`、`dependabot/github_actions/gitleaks/gitleaks-action-3.0.0`、`feat/homefont-v1`。判据：`git cherry` 全为 `-`（patch-id 已在 main）或改动文件与 main 逐字节一致 |
| B · 已被后续分支整支包含 | 5 | `fix/backend-gates-263-197-52-94-260-62`、`fix/gate-299-shell-form`、`fix/gates-173-207-265-267-47-1106`、`fix/ui-gates-1106-r2`（4 条在 `integrate/release-20261106` 内）；`fix/cli-unread-not-empty-1106`（在 `feat/cli-resume-and-diff-preview-1106` 内）。**前提：载体分支保留并最终合入**，否则不能删 |
| Dependabot 线 | 25 | 全部 D 类 `dependabot/*`（另有 2 条已 patch 覆盖的 B 类计在上表）。判据：单笔 bot 提交、无人工改动；删后 Dependabot 会按计划重新开。删前仍需确认没有 open PR |
| D · rc-live | 1 | `rc-live`。判据：957 笔全是 `github-actions[bot]` 的 `rc log heartbeat`/`rc shot` 心跳日志，`.github` 面；属运行日志线 |

合计建议可删：**96 条**（C58 + B12 + Dependabot25 + rc-live1）。

### 4.2 必须合（main 外有实质代码增量，且不是“重复快照”）

| 优先级 | 分支 | 读数 | 说明 |
|---|---|---|---|
| P0 | `integrate/release-20261106` | 25 笔 / 125 改 / 106 仍差 | release 集成载体；**整支包含 4 条 B 类**，应先合它，再删被包含分支 |
| P1 | `fix/api-admin-rbac-p1-1108` | 59 笔 / 118 仍差 | 体量最大，11-08 仍在推；越权/RBAC P1 |
| P1 | `fix/redscan-main-red-1108` | 25 笔 / 83 仍差 | 主分支红灯清收；在飞工作树 D:/DevEnv/main-clean-1108 |
| P1 | `fix/cli-typecheck-tests-1105` | 23 笔 / 109 仍差 | CLI 类型/用例线 |
| P1 | `fix/infra-defect-mining-1107` | 23 笔 / 51 仍差 | 基础设施缺陷批；在飞工作树 |
| P1 | `fix/api-defect-mining-1107` | 22 笔 / 95 仍差 | API 缺陷批；在飞工作树 |
| P1 | `fix/desktop-defect-mining-1107` | 16 笔 / 28 仍差 | 桌面端缺陷批；在飞工作树 |
| P1 | `fix/db-defect-mining-1107` | 15 笔 / 48 仍差 | DB 缺陷批；在飞工作树 |
| P1 | `fix/ai-service-audit-1107` | 13 笔 / 34 仍差 | AI 服务审计批；在飞工作树 |
| P1 | `fix/ui-defect-mining-1107` | 13 笔 / 67 仍差 | UI 缺陷批；在飞工作树 |
| P1 | `fix/web-deep-audit-1107` | 11 笔 / 48 仍差 | Web 深审批；在飞工作树 |
| P1 | `fix/main-gate-reds-1107` | 10 笔 / 12 改 / 10 仍差 | 主线红灯收口；已与 main 大量重合，合前先 rebase 复核 |
| P1 | `fix/cli-defect-mining-1107` | 9 笔 / 14 仍差 | CLI 缺陷批；在飞工作树 |
| P1 | `feat/gate-300-clean` | 9 笔 / 96 改 / 仅 13 仍差 | **83/96 已与 main 一致**；先复核剩余 13 文件，别整支硬合 |
| P1 | `fix/api-misc-p1-1108` | 4 笔 / 14 仍差 | 11-08 新线，在飞 |
| P1 | `fix/crossui-p0-p1-1108` | 4 笔 / 27 仍差 | 跨端 UI P0/P1，在飞 |
| P1 | `feat/qoder-port-1108` | 4 笔 / 44 仍差 | Qoder 能力移植，11-08 新线 |
| P1 | `feat/trae-parity-1108` | 4 笔 / 26 仍差 | Trae 对齐线，11-08 新线 |
| P2 | `wt/super-agent-isolation-1107` | 5 笔 / 26 仍差 | Super Agent 隔离线，在飞 |
| P1 | `feat/craft-anything-mcp-1108` | 3 笔 / 18 仍差 | MCP 能力线，11-08 新线 |

另有 3 条 Super Agent 线（`feat/super-agent-event-sources-1107`、`feat/super-agent-web-panel-1107`、`feat/super-agent-slow-judge-1107`）和 1 条 `feat/cli-resume-and-diff-preview-1106`（它包含 B 类 `fix/cli-unread-not-empty-1106`）也应随载体一起复核合入。

### 4.3 要人工看（不能按读数一刀切）

| 类别 | 分支 | 为什么不能直接删/合 |
|---|---|---|
| 陈旧但仍有独有内容 | `ci-knip-1103`、`cursor/readme-opening-476a`、`wip/collect-20261029`、`probe/artifacts-v7v8` | 11-03/10-29 的旧线；`ci-knip-1103` 仍有 44/120 文件与 main 不同（knip 收紧面），需确认是否已被新线吸收 |
| 台账快照 | `agent/l14497-g343-residual`、`agent/l29234-g77-gen-close`、`agent/l29253-a4a10` | 只改 `PROJECT_PLAN.md` 的 1 笔提交；cherry 超时无法判定覆盖，确认台账记录已落 main 后可删 |
| 备份线 | `ihui-backup/main-20260927-r1` | 2026-09-28 全量备份（7778 笔 / 13727 文件），cherry 超时；**删前先确认没有只存在于该备份的提交**，或打 tag/归档后再删 |
| A 类其余 | 见 §2 表中所有 A 行（除 §4.2 已列） | 均有 main 外未合增量；多为 11-05~11-08 的 defect/feat 线，是否仍有效取决于对应任务是否还挂着。**在飞工作树占用的分支一律先不动** |

### 4.4 明确不要做

- 不要用分支名/日期当删除判据；
- 不要删任何在飞工作树正在 checkout 的分支（表中“依据”列已标工作树路径）；
- 不要为了让 main 变绿而硬合 `feat/gate-300-clean` / `fix/main-gate-reds-1107`（它们与 main 高度重合，硬合会回退别人的新改动）；
- 删 `cross-end-auto-*` 前先确认那 1 条最新派生结果是否需要先落 PR，否则等于放弃当前派生内容。

## 5. 复现命令

```bash
git -C D:/IHUI-AI branch -r --no-merged 82aac6deba6d94e14443238e976cb5320a85021b | wc -l
git -C D:/IHUI-AI rev-list --count --no-merges 82aac6deba6d94e14443238e976cb5320a85021b..origin/<branch>
git -C D:/IHUI-AI diff --name-only 82aac6deba6d94e14443238e976cb5320a85021b...origin/<branch>
git -C D:/IHUI-AI cherry 82aac6deba6d94e14443238e976cb5320a85021b origin/<branch>
git -C D:/IHUI-AI branch -r --contains origin/<branch>
```

> 说明：以上命令全部为只读；本文档生成过程中唯一写入的文件就是本文件本身。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
