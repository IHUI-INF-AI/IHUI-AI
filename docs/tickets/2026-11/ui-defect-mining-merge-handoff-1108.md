<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# UI 缺陷挖掘 13 笔合入交接账（2026-11-09）

> 目标归档位置：`docs/tickets/2026-11/ui-defect-mining-merge-handoff-1108.md`（当前分支冻结，待 main 转绿、推送前由承接方随批提交）。
> 本文件只做可复核记录，不含任何未落地改动。

## 0. 现状与冻结口径

| 项 | 值 |
|---|---|
| 集成分支 | `integrate/ui-defect-mining-1108` @ `c0ee26ecf3`（基于 `73a6352a83`，17 笔） |
| 合并分支 | `merge/wave-1108` @ `6bcdc56ae0`（`--no-ff`，18 笔） |
| 合并树 | `666c54fc2b`，与集成分支树逐字节一致 |
| origin/main | 仍 `73a6352a83`，未推送 |
| 跳钩子 | 0 次；无 `--no-verify` / `HUSKY_SKIP_*` |
| 复核 | `git diff --stat 73a6352a83..integrate/ui-defect-mining-1108`；`git rev-parse 'HEAD^{tree}' 'integrate/ui-defect-mining-1108^{tree}'` |

## 1. 17 笔逐笔映射（13 移植 + 4 门账）

| 原 sha | 落地 sha | 主题 | 文件集 | 目标夹具读数 |
|---|---|---|---|---|
| `c83a840b2b` | `c83a840b2b` | 语音录制生命周期 | 5=5 | `ui-voice-recorder-lifecycle` 4/4 |
| `077ee973a8` | `077ee973a8` | 签到助手双击互斥 | 4=4 | `ui-checkin-assistant-double-submit` 2/2 |
| `ce4edc08d3` | `1378c54ddd` | 绑定邮箱（A：保 `useCountdown`） | 5=5 | `ui-email-write-guard` 4/4 |
| `690febd688` | `ef4478996d` | 重发倒计时秒数上屏 | 16→23（+7 生成物） | `i18n-resend-countdown` 3/3 |
| `55fe360b10` | `564d350917` | mobile-rn 大小写键 | 9→16（+7 生成物） | `i18n-key-removals` 3/3 + parity 绿 |
| `5d6f05c331` | `b603657f60` | 小程序大小写键 | 11→17（丢 1、+7 生成物） | `check-i18n-keys --target=miniapp-taro --parity-only` 绿 |
| `2af63ba1bc` | `4623179dfc` | web checkin→checkinAssistant | 11=11 | web `checkin/i18n-keys` 6/6 |
| `b8bf01fb5f` | `3c3831db44` | 顶层大小写冲突新判据 | 5=5 | `i18n-top-level-case-conflict` 5/5 |
| `e96b9e9646` | `21be056541` | immutable ack 追认 | 1=1 | JSONL 9/9 可解析；guard `code=declared` |
| `d67dcef88c` | `29085fdd48` | 签到助手回屏刷新 | 3→4（+README.en） | `checkin-assistant-reappear` 4/4 |
| `23a236eac3` | `99467300f8` | phone 双冷却（A） | 13→14（+README.en） | `ui-phone-timer-guard` 14/14 |
| `6dd297054b` | `125d3b1f3f` | RN 签到按钮互斥 | 3→4（+README.en） | `checkin-sign-concurrency` 2/2 |
| `388331c88a` | `5bc619bdd4` | RN 收藏真分页（A 拆取） | 17→19（丢 6、+8 生成物） | `bookmark-pagination` 5/5 |

复算（逐笔夹具）：

```powershell
cd D:\IHUI-AI-wt-merge-wave-1108\apps\miniapp-taro
pnpm exec vitest run tests/ui-email-write-guard.test.ts tests/ui-phone-timer-guard.test.ts tests/ui-voice-recorder-lifecycle.test.ts tests/ui-checkin-assistant-double-submit.test.ts
cd ..\mobile-rn
pnpm exec vitest run tests/i18n-resend-countdown.test.tsx tests/checkin-assistant-reappear.test.tsx tests/checkin-sign-concurrency.test.tsx tests/bookmark-pagination.test.tsx
node --test scripts/tests/i18n-key-removals.test.mjs scripts/tests/i18n-top-level-case-conflict.test.mjs
```

## 2. 4 笔门账：各自改了什么

| # | 落地 sha | 文件 | 改的是判据还是文档 | 转绿的门 |
|---|---|---|---|---|
| 1 | `fb01cbda03` | `AGENTS.md` L270 | 文档点名（不改进门体/判据） | `[89]` R4 |
| 2 | `e98a6e0c7f` | `apps/ai-service/app/core/capability_matrix.py` | 台账补条目 `mcp_allow_private_endpoints` | 能力矩阵 J4 |
| 3 | `82fd706f3c` | `scripts/data/gate-body-direct-run-allowlist.json` | 删已腐烂条目 `check-cross-end-parity-drift.mjs` | `[312]` R3 |
| 4 | `c0ee26ecf3` | `packages/i18n/messages/miniapp-taro/{zh-CN,zh-TW,ja}.json` | 文案对齐（未加豁免、未改基线） | `[303p]` |

R4 补的原文（`AGENTS.md` L270，插在“归档机制(2026-10-16 退役)”条目前）：

```md
- **屏/路由登记同步由门 302r 判**(`scripts/check-screen-registration-sync.mjs`):提交期只报数(warn 档,不阻断)——新增 web 页 / RN 屏必须能在 `scripts/data/web-rn-screen-map.jsonl` 找到认领,新增小程序页必须进 `app.config.ts` pages / subPackages;幽灵登记键、pages 双向不一致同判;push 面兜底仍由 302p 承担;自查 `node scripts/check-screen-registration-sync.mjs --staged`;应急 `HUSKY_SKIP_SCREEN_REGISTRATION_SYNC=1`(跳过留痕)。
```

两笔早期跳钩子提交的补跑读数（临时分支 `tmp/hook-replay`，基线 `73a6352a83 + fb01cbda03 + e98a6e0c7f`，跑完已删）：

| 原落地 | 重放 sha | pre-commit |
|---|---|---|
| `c83a840b2b` | `f682a4982f` | rc=0 全绿 |
| `077ee973a8` | `326e4da69c` | rc=0 全绿 |

## 3. 丢弃清单（4 项）

| # | 丢弃内容 | 原因 |
|---|---|---|
| 1 | `packages/shared/src/hooks/use-paginated-list.ts` 分支版 | 分支版丢 `requestSeqRef` 过期响应丢弃，保 main（A 裁决） |
| 2 | `packages/i18n/messages/miniapp-taro/{en,ja,ko,zh-CN,zh-TW}.json` 的 `bookmark.loadMore/loadingMore` | 小程序端不做分页，不落死键 |
| 3 | `apps/miniapp-taro/src/pkg-shop/vip-trader/index/index.tsx` 分支 30 行块 | main 已是 23 行生成镜像壳（`gen-miniapp-mirror.mjs`），B 裁决 |
| 4 | 分支的 README 改动 | 不手合，统一由 `sync-readme-numbers.mjs` 重出 |

## 4. 新门禁 main 存量面 45 处 → 集成分支 0 处

复算命令（已验证：main 面 25/15/5 = 45，分支面 0/0/0）：

```powershell
# 1) 起 main 面 worktree，并放入分支的新判据（判据随 b8bf01fb5f 才存在）
git -C D:\IHUI-AI-git-repo worktree add C:\Users\Administrator\AppData\Local\Temp\wt-case45 73a6352a83
Copy-Item D:\IHUI-AI-wt-merge-wave-1108\scripts\check-i18n-keys.mjs       C:\Users\Administrator\AppData\Local\Temp\wt-case45\scripts\check-i18n-keys.mjs -Force
Copy-Item D:\IHUI-AI-wt-merge-wave-1108\scripts\lib\i18n-top-level-keys.mjs C:\Users\Administrator\AppData\Local\Temp\wt-case45\scripts\lib\i18n-top-level-keys.mjs -Force

# 2) 三个端分别读（必须是该 worktree 作为 cwd；脚本按 cwd 解 MESSAGES_ROOT）
cd C:\Users\Administrator\AppData\Local\Temp\wt-case45
node scripts/check-i18n-keys.mjs --target=miniapp-taro --worktree   # 25
node scripts/check-i18n-keys.mjs --target=mobile-rn --worktree      # 15
node scripts/check-i18n-keys.mjs --target=web --worktree            # 5

# 3) 集成分支面同样三条 → 0/0/0
cd D:\IHUI-AI-wt-merge-wave-1108
node scripts/check-i18n-keys.mjs --target=miniapp-taro --worktree
node scripts/check-i18n-keys.mjs --target=mobile-rn --worktree
node scripts/check-i18n-keys.mjs --target=web --worktree

# 4) 清理
git -C D:\IHUI-AI-git-repo worktree remove C:\Users\Administrator\AppData\Local\Temp\wt-case45 --force
```

自检：`node --test scripts/tests/i18n-top-level-case-conflict.test.mjs` 5/5。

## 5. 本地陈旧 main 的核查与处置（2026-11-09）

- 所在 gitdir：`D:/IHUI-AI-git-repo`（本仓共享 gitdir；在该目录直接跑 git 时 `git rev-parse --is-inside-work-tree` = false，160 个条目均为 git 内部对象，故 `git status` 报 “must be run in a work tree”）。**更正**：它不是"没有工作树"——`D:/IHUI-AI/.git` 是一个文件（内容 `gitdir: D:/IHUI-AI-git-repo`），工作树实体是 `D:/IHUI-AI`；这条陈旧线是在 separate-git-dir 结构下，直接写进共享 gitdir 的 `refs/heads/main` 的。
- 来源：2026-11-08 17:00–18:25 期间直接在本地 `main` 上提交了 14 笔（起点 `edd55907b7` = “merge fix/db-p2-1108”，末笔 `1e9f34aa34` = “docs(agents): 速查表补齐门 89 与 312/312p 点名(T13 存量红)”）。`git cherry origin/main main` 显示 14 笔全部为 `+`（origin/main 无等价补丁）。
- 当时的读数：`main...origin/main` = 14 ahead / 554 behind。
- 处置：先把 14 笔保全到 `archive/local-main-1e9f34aa34`，再用 `git update-ref refs/heads/main 73a6352a83` 把 `main` 归位到权威 tip。归位当时读数 `main...origin/main` = 0/0。**2026-11-09 复核**：该 ref 随后又被其它会话/自动化移动（本地出现 `2bb7c39959`，紧接着 T1 线把 `cfe4d6f731` / `4ac7febf4a` 推到 origin）——shared gitdir 的 `main` 仍会被多会话改写，机制风险见 §8.3。
- 若要回看旧线：`git log --oneline 73a6352a83..archive/local-main-1e9f34aa34`（14 笔）；逐笔定性见 §8。

## 6. push 门读数与后续

push 门 13 项：11 绿，2 红。

1. `[303p]` 跨端文案漂移：已修（`c0ee26ecf3`）——漂移 33→32、未裁 1→0、`state=clean`。
2. `[T1]` 全量 typecheck：**main 存量红，非本波带入**。同环境（同 worktree、同 node_modules）对跑：

```
origin/main 73a6352a83   api 28 | miniapp 4 | mobile-rn 1 | rn-app 4 | web 1 | cli 5
集成分支   c0ee26ecf3    api 28 | miniapp 3 | mobile-rn 1 | rn-app 4 | web 1 | cli 5
```

逐行比对：分支零新增，唯一差异是 23a2 顺手修掉的 `withdrawal/index.tsx(54,20)`。T1 存量归独立线，修复后先落 main。

后续（裁决）：

1. `merge/wave-1108 @ 6bcdc56ae0` 保持不动，不推、不拆、不加新提交。
2. T1 线报 main 转绿后：**merge 新 main 进 `merge/wave-1108`（不 rebase）**，重跑 push 门 13 项，再推。
3. merge 后若 `[T1]` 仍红：先拿纯净新 main 对跑确认归属；自家带入的修，存量的只报读数。

> **2026-11-09 解冻后收尾**：T1 线报 main `cfe4d6f731` 六包全 0；本线 fetch 到 `4ac7febf4a`（T1 收官票补记）后以它为父做 `--no-ff` merge（`ea54b6b9f8`）。push 门 13/13 绿：`[47p]` 首次独立调用因缺 `PUSH_SCOPE_FILES` 退回 HEAD 全量面，报了 190 个存量水印欠账；按真实 push scope（75 文件）复跑即绿，非本波欠账。已推 `origin/main = ea54b6b9f8`。

## 7. 已知 main 存量红（非本波，报告口径）

- `node scripts/check-i18n-keys.mjs --target=mobile-rn`（非 parity）在 main 面有 6 个既有缺失键：`login.*` 5 个 + `conversationImport.noValidContent`；hook 实际跑 `--parity-only`，不阻塞。
- 生成物钉变化（均由生成器重出，未手改）：miniapp `ui-routes.generated.ts` 两次、web `ui-routes.generated.ts` 一次、i18n 压缩载荷随输入重出、README 由 `sync-readme-numbers.mjs` 刷新。

## 8. `archive/local-main-1e9f34aa34` 14 笔定性审计（2026-11-09，只审计、未合任何一笔）

审计面：`73a6352a83..archive/local-main-1e9f34aa34`，共 14 笔。`git cherry origin/main <该分支>` 全 `+`（origin/main 无等价补丁），逐笔结论如下。

### 8.1 结论表

| sha | 主题 | 定性 | 判据（main 现值） | 建议 |
|---|---|---|---|---|
| `c23a27a36f` | soul 原子写用例 + `apps/cli/tests/types/scripts-lib.d.ts` | 真增量（测试面） | main 有实现 `apps/cli/src/memory/soul.ts`（DBG-44，L112 原子出口）；`memory.test.ts` L544-563 只覆盖"读坏/是目录"，未覆盖 rename EPERM 后旧文件逐字节不变、无 tmp 残留；`apps/cli/tests/types/` 不存在 | 合 test 97 行；`scripts-lib.d.ts` 视 `pnpm --filter @ihui/cli typecheck` 读数再定 |
| `3096f8251a` | 7 个 CLI 边界用例（+780） | 同波中间态，已被覆盖 | `c0ae2899f1` 又删、`7737e0c776` 以 +788 落回；净效果以 tip 为准 | 弃本笔，取 `7737` |
| `b8047903f5` | CI `continue-on-error` 清单 + immutable-guard 读真实索引票 | 真增量（文档） | main 无同名两篇；`continue-on-error` 仅散见于 DEPLOYMENT_RUNBOOK/TESTING/findings-deploy-gates，无逐条清单；immutable-guard 读共享索引票无等价 | 合 2 篇 83 行 |
| `d2803d8614` | `.gitignore` 9 行 | 真增量（低风险） | main 只有 `.screenshots/`，无 `.worktrees-archive/`、`apps/web/e2e/screenshots/**/*.png`、`*.log.old` | 合 9 行 |
| `41f10908ff` | 主工作区瘦身波不采纳票（30 行） | 真增量（文档/证据） | main 无"瘦身/128 删除意图"票 | 合 30 行；先核 `D:/DevEnv/backups/main-wt-rescue-20261108/` 与 `rescue/main-wt-20261108`(5f5554e97e) 是否仍在 |
| `c0ae2899f1` | 7 个用例退回未跟踪（-780） | 同波中间态 | `7737e0c776` 已把 7 文件全量落回 | 弃本笔 |
| `51c18c32ba` | CLI 6 文件写盘守卫（+45/-26） | 真增量（部分：4/6 文件） | main 已等价：`undo-redo.ts` 有 `commitAtomicWrite`、`mcp-credentials.ts` 有 `os-key-readback-mismatch`；main 仍裸写：`discovery.ts` L350、`plan-build.ts` L279、`updater.ts` mergeWriteCache L186、`worktree.ts` saveCachedCowKind L268 | 只取 discovery/plan-build/updater/worktree 4 文件；弃另两段 |
| `7737e0c776` | 7 个 DBG-43..49 用例（+788） | 真增量（测试面） | main 缺全部 7 文件；5 个锁定 main 仍未修的写盘路径，2 个（undo-redo/mcp-credentials）锁已修行为作回归 | 合 7 文件；必须与 `51c18c32ba` 的 4 文件同批 |
| `1d885516e9` | DG-06 双键取表 + 等锁/真跑分段 | 真增量（部分） | main 已有"按门查登记表 + defaultTimeoutMs + `GUARDIAN_GATE_TIMEOUT_MS` 覆盖"（`guardian-executor.mjs` L626/L635/L796、`land-gate-budgets.json`）；main **无** `gate-timeout-budget.mjs`、`gate-phase-watchdog.mjs`、`phaseProtocol`、`BLOCKED_BY_CONCURRENCY`；main T1 预算 405000 与 archive 547650 冲突 | 只取 phase 分段 + `BLOCKED_BY_CONCURRENCY`；弃 T1 预算行与重复取表 lib |
| `4fbfcec92d` | 钩子链引用完整性门（208 行）+ 三处注册 | 真增量（门体），编号冲突 | main 无 `check-hook-chain-refs.mjs`、无 `hook-chain` 引用；main `[312]` = `check-gate-body-direct-run-coverage.mjs` | 只取门体；编号必须重排（不得用 312/312p），`push-receipt.mjs` 与预算表随改 |
| `ea21e5efac` | 跨端收编显式暂停开关 | 真增量（运维开关） | main 无 `cross-end-landing-paused` / `pauseFile` | 合 79 行；当前仍多线并行，保留适用 |
| `591286e1d5` | gate-failure-kind C7/F5 锚点 | **已在主线以另一种形式存在** | main `6040fed71a` 同标题同根因；`git diff 6040fed71a 591286e1d5 -- scripts/tests/gate-failure-kind.test.mjs docs/tickets/2026-11/gate-failure-kind-stock-red-20261108.md` 为空；两笔 author 时间同为 13:18:23（同一补丁重放） | 弃 |
| `6263c6ac50` | removeWorktree 用例去 `withinRoot` | **本来就该作废** | main `worktree.ts` L752 起：非 legacy stat 时 `!opts?.withinRoot` 直接 throw；main 用例 L480/506/512 仍用 `{ withinRoot: tmpDir }`，archive 改成 `removeWorktree(wt)` 在 main 上必抛 | 弃 |
| `1e9f34aa34` | AGENTS.md +2 行（门 89、312/312p） | 部分已在主线 + 部分自相矛盾 | 第 1 行等价：main AGENTS L263 已点名 `check-gate-wiring.mjs`，README L2250、GATEKEEPERS L693 有速查；第 2 行依赖 `4fbfcec` 且 312 已被占用 | 弃原 2 行；若取 `4fbfcec`，改号后只补 1 行 |

计数：真增量 9 笔（含 2 笔同波中间态）、已在主线 1 笔、应作废 1 笔、部分/需改写 1 笔；合计 14。

### 8.2 真增量清单——**未合，等排期，不进本波 wave**

> 按裁决：真增量只登记，不顺手塞进 `merge/wave-1108`（该波已于 `ea54b6b9f8` 定稿推 main）。以下 9 笔（净取 7 个交付面）全部**未合**。

1. `c23a27a36f` soul 原子写用例（+ types 待定）——未合。
2. `7737e0c776` 7 个 CLI 用例——未合，须与 `51c18c32ba` 同批。
3. `51c18c32ba` 的 4/6 文件守卫（discovery/plan-build/updater/worktree）——未合。
4. `1d885516e9` 的 phase 分段 + `BLOCKED_BY_CONCURRENCY`——未合；T1 预算行与双键取表不取。
5. `4fbfcec92d` 的 `check-hook-chain-refs.mjs`——未合；编号需在新排期里重排。
6. `ea21e5efac` 跨端收编暂停开关——未合。
7. `d2803d8614` `.gitignore` 9 行——未合。
8. `b8047903f5` 两篇文档——未合。
9. `41f10908ff` 瘦身不采纳票——未合；先核证据路径。
   中间态 `3096f8251a` / `c0ae2899f1` 弃，不单列。

### 8.3 机制问题与来源追查

**这是机制问题，不是某个人的操作失误。** 这批提交落在 `D:/IHUI-AI-git-repo`（本仓共享 gitdir）的 `refs/heads/main` 上；在该目录直接调用 git 时 `--is-inside-work-tree=false`，pre-commit 的 staged 面、push 门的 push-scope 面都取不到。只要进程能写这个 gitdir，就可以用 `git commit-tree` / `GIT_DIR` 直写 ref——钩子链与门禁对这类提交**形同虚设**。多工作树/多会话共享同一 gitdir 的结构不收紧，这种绕过会反复发生。

- 作者/提交者：14 笔全部 `AI智汇社 <lizong@aizhs.top>`；时间 2026-11-08 17:33:56–18:25:54 +0800。
- 落点：该 gitdir 的 `refs/heads/main`（reflog `main@{11}..main@{2}` 均为 `commit:`）。
- 绕钩子的直接证据：AGENTS 硬约束③要求改 `scripts/lib/**` 或 runner 必须带 `immutable-exempt: <≥10 字>`。`1d885516e9`（改 `scripts/lib/guardian-executor.mjs`、`gate-failure-kind.mjs`）与 `4fbfcec92d`（改 `scripts/guardian-runner.mjs`、`scripts/lib/push-receipt.mjs`）**均无**该 trailer；14 笔里只有纯文档的 `1e9f34aa34` 带 trailer ⇒ 至少两笔未经 immutable-guard。
- 具体绕过手段（`--no-verify` / `HUSKY_SKIP_IMMUTABLE_GUARD` / 钩子未装）在仓内无留痕 ⇒ **来源不明**，不猜。
- 旁支现状：`D:/IHUI-AI` 是 `D:/IHUI-AI-git-repo` 的 separate-git-dir 工作树（`.git` 为文件），审计时仍在 `main` 上且工作树有 1417 条 porcelain 变更（与 `41f10908ff` 记的瘦身波同型）；`main` ref 在归位后又被多会话移动。该工作树需单列处置，别在它上面继续提交。
- 待排期（只登记，不在本段执行）：给共享 gitdir 的 `refs/heads/main` 加写保护或巡检（只读比对 origin、发现本地直写即告警）；禁止在无工作区上下文直接 `git commit-tree` / `GIT_DIR=... commit` 落 main。

### 8.4 收尾读数

- 本波 push：`4ac7febf4a..ea54b6b9f8 merge/wave-1108 -> main`；`origin/main = ea54b6b9f8`，`merge/wave-1108` 与 origin/main 同步、工作树干净。
- 本波未取 archive 的任何一笔真增量（符合"审计段只审计、真增量先别合"）。
- 归档分支保留：`archive/local-main-1e9f34aa34 @ 1e9f34aa34`，回看命令见 §5。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
