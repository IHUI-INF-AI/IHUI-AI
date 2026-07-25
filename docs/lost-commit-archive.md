# Lost Commit 永久归档

> **AGENTS.md §22 配套文档** — 记录被 `git reset` / 误操作导致从 main / 共享分支历史中"消失"但通过 tag 备份永久保留的 commit。
>
> **作用**:当 commit 不可见(`git log` 看不到)但通过 tag 可恢复时,本文件是唯一可读的"档案"。
>
> **维护原则**:
> - 任何 commit 被 reset / 丢失后,**必须**先 `git tag lost-commit/<name> <hash> -m "lost via reset"` 再做其他操作
> - 同步在本文件新增一个 commit 卡片(commit hash / subject / 改动文件 / 重做 commit / tag 状态)
> - 重做 commit 信息可填也可空 — 如果内容已被 main 吸收,链接到重做 commit;如果尚未吸收,标注 "待重做"
> - 文件变更必须有 commit + push(AGENTS.md §20 硬定义),禁止只本地修改
>
> **数据来源**:`git tag -l "lost-commit/*" "backup/*"` + `git fsck --unreachable --no-reflogs` + `git reflog --all --date=iso`
>
> **创建日期**:2026-07-26(本任务驱动)

---

## 📋 Lost Commit 清单(按时间倒序)

### 1. `lost-commit/sidebar-fold-btn-2` → `b120c6e20ace186333bfac49d18126923cb5ce47`

| 字段 | 值 |
|------|------|
| **Tag 名称** | `lost-commit/sidebar-fold-btn-2` |
| **完整 commit hash** | `b120c6e20ace186333bfac49d18126923cb5ce47` |
| **作者 / 时间** | `AI智汇社 <lizong@aizhs.top>` / `2026-07-25 19:27:08 +0800` |
| **Subject** | `fix(web): sidebar 折叠按钮图标 16→20px(覆盖 shadcn Button 默认 size-4)` |
| **丢失原因** | 多 agent 并行期间,某 agent 自动化流程使用 `git reset HEAD~` 撤销 main 上一个 commit 时,未考虑对其他 agent 本地 commit 的影响,导致 reset 把整个 commit 链一并丢弃(reflog 记录 `HEAD@{2026-07-25 19:05:12}: reset: moving to HEAD~1`) |
| **改动文件** | `apps/web/src/components/layout/Sidebar.tsx`(推断 — 与 sidebar-fold-btn-1 同文件) |
| **核心改动** | 按钮 `h-9 w-9 (36×36)` 容器内的 `PanelLeftClose/Open` 图标 `16×16` 视觉过小(2026-07-25 用户反馈)。纯图标按钮无文字标签,与其他 h-5 导航项图标不一致。在 `Button` `className` 上加 `[&_svg]:size-5` 通过 tailwind-merge 覆盖 `size="icon"` 默认的 `[&_svg]:size-4`。SVG 的 `h-4 w-4` 保留作防御性兜底,即便父级 override 丢失也保持 16×16 默认。 |
| **重做 commit** | `ff7f744e0` `fix(web): sidebar 折叠按钮图标 16→20px(覆盖 shadcn Button 默认 size-4)`(已合并到 main,通过 `ce3116ebd` merge commit 整合) |
| **Tag 状态** | ✅ 本地 + 远端均存在(2026-07-26 fetch 验证) |
| **可访问性** | ✅ `git cat-file -e b120c6e20ace186333bfac49d18126923cb5ce47` exit 0 / `git show lost-commit/sidebar-fold-btn-2` 显示完整内容 |

### 2. `lost-commit/sidebar-fold-btn-1` → `5ef36e59d4bccc4196d03315137c0cd79e02e2b4`

| 字段 | 值 |
|------|------|
| **Tag 名称** | `lost-commit/sidebar-fold-btn-1` |
| **完整 commit hash** | `5ef36e59d4bccc4196d03315137c0cd79e02e2b4` |
| **作者 / 时间** | `AI智汇社 <lizong@aizhs.top>` / `2026-07-25 19:18:11 +0800` |
| **Subject** | `fix(web): sidebar 折叠按钮图标 16→20px(覆盖 shadcn Button 默认 size-4)` |
| **丢失原因** | 同上 — 多 agent 并行 `git reset HEAD~1` |
| **改动文件** | `apps/web/src/components/layout/Sidebar.tsx` |
| **核心改动** | 同 sidebar-fold-btn-2(同一 PR 的多次重复 commit) |
| **重做 commit** | 同 sidebar-fold-btn-2(被 `ff7f744e0` 单一 commit 整合) |
| **Tag 状态** | ✅ 本地 + 远端均存在 |
| **可访问性** | ✅ `git cat-file -e 5ef36e59d4bccc4196d03315137c0cd79e02e2b4` exit 0 |

### 3. `lost-commit/P0-security-debt` → `15b984f90e9b20ea8fba8b0846e1cc130935efe2`

| 字段 | 值 |
|------|------|
| **Tag 名称** | `lost-commit/P0-security-debt` |
| **完整 commit hash** | `15b984f90e9b20ea8fba8b0846e1cc130935efe2` |
| **作者 / 时间** | `AI智汇社 <lizong@aizhs.top>` / `2026-07-25 19:27:08 +0800` |
| **Subject** | `fix(api): P0 安全债并行修复 — ws-chat/ws-tasks IDOR + payment-gateway 金额反查` |
| **丢失原因** | 同上 — 多 agent 并行 `git reset HEAD~1` |
| **改动文件** | `apps/api/src/plugins/ws-tasks.ts` / `apps/api/src/plugins/ws-chat.ts` / `apps/api/src/routes/payment-gateway.ts` / `PROJECT_PLAN.md` |
| **核心改动** | (1) `ws-chat.ts:410` `/ws/room/:roomId` `wsAuth` 后追加 ownership 校验链(Redis `meta.createdBy === userId` 或 `sismember(user_rooms) === 1`,否则 `close 1008`);(2) `ws-tasks.ts:86` `/ws/tasks/:taskId` `wsAuth` 后串行查 4 张任务表(`agent_tasks.createdBy` / `content_generation_tasks.userId` / `export_tasks.userId` / `workspace_ai_tasks.userId` 任一匹配即放行,DB 异常时 `close 1008` 保守拒绝);(3) `payment-gateway.ts` `/payments/wechat/course/create` 课程金额服务端反查 `zhs_course_video.amount` 替换客户端 amount,不一致时 error 日志 + 替换。 |
| **重做 commit** | `251956eb6` `fix(api): P0 安全债收尾 — ws-chat/ws-tasks IDOR 集成测试 + payment-gateway 全量金额反查`(已合并到 main)+ `ce3116ebd` merge commit 整合 |
| **Tag 状态** | ✅ 本地 + 远端均存在 |
| **可访问性** | ✅ `git cat-file -e 15b984f90e9b20ea8fba8b0846e1cc130935efe2` exit 0 |

### 4. `backup/pre-drop-recovery` → `251956eb6f75d13bd1fc92adb3a359cb488ad29f`

| 字段 | 值 |
|------|------|
| **Tag 名称** | `backup/pre-drop-recovery` |
| **完整 commit hash** | `251956eb6f75d13bd1fc92adb3a359cb488ad29f` |
| **Tagger** | `AI智汇社 <lizong@aizhs.top>` / `2026-07-26 03:27:25 +0800` |
| **Subject** | `fix(api): P0 安全债收尾 — ws-chat/ws-tasks IDOR 集成测试 + payment-gateway 全量金额反查` |
| **Tag 含义** | 这不是 "lost commit" 本身,而是 "**恢复前的主分支快照**" — 在 reset 操作发生后,有人对 main HEAD 打了这个 tag,作为已知安全基线,防止后续 reset 进一步丢失这个 commit |
| **Tag message** | `backup: 恢复 3 个被 reset commit 前的主分支快照` |
| **改动文件** | `apps/api/src/plugins/ws-tasks.ts` / `apps/api/src/plugins/ws-chat.ts` / `apps/api/src/routes/payment-gateway.ts` / `apps/api/tests/ws-chat-idor.test.ts`(新建,10 cases)/ `apps/api/tests/ws-tasks-idor.test.ts`(新建,2 cases)/ `vitest.config.ts` / `PROJECT_PLAN.md` |
| **核心改动** | (1) 新建 `ws-chat-idor.test.ts` (10 cases) + `ws-tasks-idor.test.ts` (2 cases) 锁死 IDOR 防护回归;(2) `vitest.config.ts` `include` 数组追加 `src/plugins/__tests__/**/*.test.ts`;(3) `payment-gateway.ts` 审计 10 个下单端点,修复 5 个(`orderType=2 VIP` / `orderType=5 Developer` 套餐),新增 `resolveProductAmountCents` helper 服务端反查 `vipLevels/developerPricing`,豁免 5 个(无 productId 或用户自定义金额场景) |
| **重做 commit** | N/A(此 commit 本身没被 drop,只是作为"恢复前快照"备份点) |
| **Tag 状态** | ✅ 本地 + 远端均存在 |
| **可访问性** | ✅ `git cat-file -e 251956eb6f75d13bd1fc92adb3a359cb488ad29f` exit 0 |

---

## 🔍 数据来源验证命令

```bash
# 列出所有 lost-commit / backup tag
git tag -l "lost-commit/*" "backup/*"

# 远端 tag 列表(确认备份到 origin)
git ls-remote origin 'refs/tags/lost-commit/*' 'refs/tags/backup/*'

# 验证 4 个 commit 都可访问
git cat-file -e 15b984f90e9b20ea8fba8b0846e1cc130935efe2
git cat-file -e 5ef36e59d4bccc4196d03315137c0cd79e02e2b4
git cat-file -e b120c6e20ace186333bfac49d18126923cb5ce47
git cat-file -e 251956eb6f75d13bd1fc92adb3a359cb488ad29f

# 完整查看任一 commit 内容
git show lost-commit/P0-security-debt
git show lost-commit/sidebar-fold-btn-1
git show lost-commit/sidebar-fold-btn-2
git show backup/pre-drop-recovery

# 自动校验脚本(本任务配套新增)
node scripts/sync-lost-commit-tags.mjs --check
```

---

## 🛡️ 防护机制(2026-07-26 强化)

### 自动化工具

1. **`.husky/pre-commit` → `scripts/guardian-runner.mjs` 第 30a 项**:
   - `check-commit-loss-guard.mjs --blocking --filter-stash`
   - 检测到 `reflog` 近期 reset 操作 → exit 1,阻塞 commit
   - 检测到 `fsck` 悬空 commit 且无 `lost-commit/*` tag 备份 → exit 1

2. **`.husky/post-commit` → `scripts/sync-lost-commit-tags.mjs --auto-push`**(本任务新增):
   - 每次 commit 后自动 `git push origin 'refs/tags/lost-commit/*:refs/tags/lost-commit/*' 'refs/tags/backup/*:refs/tags/backup/*'`
   - 防止本地 git gc 清理后,远端也没 tag 备份的惨剧

3. **手动兜底**:
   - `node scripts/sync-lost-commit-tags.mjs --check` — 校验所有 lost-commit/backup tag 本地 + 远端齐全
   - `node scripts/sync-lost-commit-tags.mjs --fetch` — 从 origin 拉回所有 lost-commit/backup tag
   - `node scripts/sync-lost-commit-tags.mjs --auto-push` — 推送本地 tag 到 origin

### 硬性规则(AGENTS.md §22 已写入)

1. **禁止**在共享分支使用 `git reset --hard` / `git reset HEAD~N`
2. **撤销已 push commit 必须用 `git revert`**,禁止 `git push --force`
3. **撤销本地 commit 推荐 `git revert`**,仅在确认无其他 agent 引用时才考虑 `git reset`
4. **任何 reset 操作前必须**先 `git tag lost-commit/<name> <hash>` 备份
5. **多 agent 并行 reset 前必须**:`git log --all --oneline | grep <other-agent-commit-sha>` 确认无引用
6. **禁止** `git stash drop` / `git stash clear`,除非先 `git stash show <id> --stat` 确认内容已合并

---

## 📜 历史案例

| 日期 | 事故 | 教训 |
|------|------|------|
| 2026-07-25 19:05-19:33 | 6 次 `git reset HEAD~` 丢失 3 个 commit(P0 安全债 + sidebar 折叠按钮 x2) | 多 agent 并行环境下,reset 操作必须先 tag 备份 + 检查其他 agent 引用 |
| 2026-07-25 22:19 | 已通过 `ce3116ebd` merge + `ff7f744e0` 重做 commit 恢复工作内容 | reset 丢失的 commit 工作内容可通过"重做"恢复,但原始 commit hash 永久不可追溯(只能通过 tag 访问) |
| 2026-07-26 03:27 | 创建 `backup/pre-drop-recovery` tag 锁住恢复基线 | 重做 commit 完成后,立即给主分支打 `backup/*` 标签,作为已知安全基线 |
| 2026-07-26 04:23 | 发现本地 tag 已被 git gc 清理(虽然远端有),但 `git cat-file -e <hash>` 显示 commit object 不可访问(因为 fetch 失败) | **关键教训**:tag 必须主动 push 到远端,本地 git gc 后 tag 会消失;commit object 不可访问意味着即使有 tag 引用也会因对象不可达而无法 cat-file |
| 2026-07-26 04:30 | 通过 `git fetch origin 'refs/tags/lost-commit/*:refs/tags/lost-commit/*'` 全部恢复 | **新机制**:post-commit 钩子自动 push 远端 + 每周一定时检查远端 tag 完整性 |

---

## 🔗 关联文档

- **AGENTS.md §22** — 防止 commit / push / merge 提交丢失硬性规则(强制)
- **PROJECT_PLAN.md** — 本任务条目(commit 丢失防护机制强化)
- **`.trae-cn/archive/AGENTS_history.md`** — 历史归档(audit/交接/迁移报告,只读)
- **`scripts/check-commit-loss-guard.mjs`** — pre-commit 守门脚本(blocking,30a 项)
- **`scripts/sync-lost-commit-tags.mjs`** — post-commit 自动推送 + 手动校验(本任务新增)
- **`.husky/pre-commit` / `.husky/post-commit`** — Husky 钩子集成

---

**最后更新**:2026-07-26 04:30(+0800)
**维护者**:AGENTS(自动)+ AI智汇社(手动)
**下次校验**:每次 commit(post-commit 钩子)+ 每周一定时任务
