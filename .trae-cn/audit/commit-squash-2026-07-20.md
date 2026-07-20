# Commit Squash 审计 — 2026-07-20

> 协作事故 commit 整理方案
> 决策:仅文档记录,**不执行** `git rebase -i` / `git push --force`(§16 红线,多人 main 共享)
> 责任人:AI 智汇社(lizong@aizhs.top)所有重复 commit 同源

---

## 0. 结论摘要

| 项目          | 数值                                                                                |
| ------------- | ----------------------------------------------------------------------------------- |
| 重复 commit 对 | **5 对**(用户描述说 4 对,实际 5 对)                                                 |
| 真正同主题     | 2 对(`e70e0e87+762c8dd1` / `6a7170f6+ce7d076c`)                                    |
| 同功能模块连续  | 3 对(mobile-rn / miniapp-taro / desktop 各一对)                                    |
| 是否执行 squash | **否**(§16 保护,main 共享分支避免 force-push)                                       |
| 建议          | 在下一个 `feat:` 提交时把后一条改写成 `fixup!` / `squash!` 形式,rebase 一次性清掉  |

---

## 1. 5 对 commit 详单(按时间顺序)

| #   | Commit A   | Commit B   | 同作者 | 同主题 | 间隔       | 决策    |
| --- | ---------- | ---------- | ------ | ------ | ---------- | ------- |
| 1   | `e70e0e87` | `762c8dd1` | ✅     | ✅     | 数小时     | fixup!  |
| 2   | `6a7170f6` | `ce7d076c` | ✅     | ✅     | 数分钟     | squash! |
| 3   | `fe11dfcc` | `f22e507e` | ✅     | ❌     | 同功能模块 | squash! |
| 4   | `a9a99df8` | `4b628b33` | ✅     | ❌     | 同功能模块 | squash! |
| 5   | `e0313b3f` | `661ca904` | ✅     | ❌     | 同功能模块 | squash! |

---

## 2. 逐对诊断

### 2.1 `e70e0e87` + `762c8dd1` — admin useBatchMutation hook

| 字段         | 值                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------- |
| 主题(完全相同) | `feat(admin): extract useBatchMutation common hook, unify batch ops pattern`                    |
| 时间         | `e70e0e87` 2026-07-20 00:40:22 → `762c8dd1` 在其后(同日)                                        |
| 影响文件     | `apps/web/src/hooks/use-batch-mutation.test.ts` + `apps/web/src/hooks/use-batch-mutation.ts`(8+/5-) |
| 性质         | 同一 agent 重新提了相同 commit(rebase 残留 / cherry-pick 重放)                                  |
| squash 方案  | `git rebase -i e70e0e87^` → `pick e70e0e87` + `fixup 762c8dd1`                                  |
| 风险         | 中 — 只改 2 个文件,rebase 冲突面小                                                              |

### 2.2 `6a7170f6` + `ce7d076c` — 登录注册弹窗化

| 字段         | 值                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------- |
| 主题(完全相同) | `feat(auth): 登录注册弹窗化 + UI 全面优化统一`                                                  |
| 时间         | `6a7170f6` 2026-07-20 01:31:14 → `ce7d076c` 数分钟后                                             |
| 影响文件     | AuthShell / AgreementCheckbox / LoginDialog / SSO / Dialog UI 一系列                            |
| 性质         | 同主题连续提交,内容高度重叠(可能是补 commit + amend 未成,fallback 到 create new commit)         |
| squash 方案  | `git rebase -i 6a7170f6^` → `pick 6a7170f6` + `squash ce7d076c`(合并 commit message)            |
| 风险         | 中高 — 跨 LoginForm/RegisterForm/Dialog/SSO 多模块,需用 `git diff --check` 预演                  |

### 2.3 `fe11dfcc` + `f22e507e` — mobile-rn 业务实装 + 真视频播放器

| 字段     | A: `fe11dfcc`                                              | B: `f22e507e`                                            |
| -------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| 主题     | C 端主体业务实装 4 Tab + Live/课程/Profile hub + i18n 5 语言 | 真视频播放器 + WebSocket 直播聊天 + SecureStore token 持久化 |
| 文件数   | 20+ (screens / i18n / nav)                                 | VideoPlayer + WS chat + token persistence                 |
| 性质     | mobile-rn C 端主干                                         | 紧接 A 的强化(WebSocket chat + 真视频)                   |
| 决策     | 逻辑上属同一 feature 簇(C 端 mobile-rn)                    | 同上                                                      |
| 建议     | squash(主题改为 `feat(mobile-rn): C 端主体业务 + 真视频播放器 + WS 直播聊天`) |

### 2.4 `a9a99df8` + `4b628b33` — miniapp-taro C 端实装 + tabBar PNG

| 字段     | A: `a9a99df8`                                                                | B: `4b628b33`                            |
| -------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| 主题     | C 端主体业务实装 — 4 Tab 自定义 TabBar + 首页直播/学习进度 + 微信分享 + i18n | tabBar PNG 资源 + 运营 banner API + 真实微信登录 |
| 性质     | 小程序 C 端主干                                                              | 紧接 A 的强化(资源 + API + 真实登录)      |
| 决策     | 逻辑上属同一 feature 簇(小程序 C 端)                                        | 同上                                     |
| 建议     | squash(主题改为 `feat(miniapp-taro): C 端主体业务 + tabBar PNG + 真实微信登录`) |

### 2.5 `e0313b3f` + `661ca904` — desktop admin shell + admin CRUD

| 字段     | A: `e0313b3f`                                                | B: `661ca904`                                                |
| -------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 主题     | admin shell 集成 + Tauri admin 窗口/菜单 + 5 大块路由         | admin CRUD 完整化(Users/Orders/Settings 弹窗 + i18n + hook + 测试) |
| 性质     | desktop admin 外壳/路由                                      | 紧接 A 的 CRUD 实装(每 Tab 的弹窗 + i18n)                  |
| 决策     | 逻辑上属同一 feature 簇(desktop admin)                       | 同上                                                         |
| 建议     | squash(主题改为 `feat(desktop): admin 完整化 — shell + 5 大块路由 + Users/Orders/Content/Settings CRUD`) |

---

## 3. **不执行 squash 的原因**(§16 红线)

| 红线               | 内容                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| §16 强推保护       | main 分支多人共享,`git push --force` 会抹除其他 agent 改动 → **协作事故**                          |
| §16 协作事故分级   | 抹除 / 污染 / 越权 三种事故,均不可接受                                                              |
| 现状               | 当前 main HEAD `695f44e2`,远端 origin/main 已同步;任何 force-push 都会重写 5+ 协作 commit          |
| 历史规律           | 2026-07-20 之前已多次出现"agent 强推 → 其他 agent 工作丢失"事件                                     |
| 安全替代           | 下一轮 `feat:` 提交时,在 commit message 写 `fixup!` / `squash!` 前缀(后续 safe-merge 时一并清理)  |
| 二次提交           | 也可以单独提一个 `chore(commit-squash): 整理 5 对重复 commit` 的 PR,在 PR 端 rebase(不动 main)     |

---

## 4. 后续清理建议(用户决策后执行)

### 4.1 方案 A — `fixup!` 自动清理(推荐)

在下次涉及上述任一文件改动时,新 commit 写成 `fixup! e70e0e87` 形式,后续一次性 `git rebase --autosquash` 即可。

```bash
# 示例:下次改 use-batch-mutation.ts 时
git commit --fixup=e70e0e87 -m "fix(admin): useBatchMutation 空数组 guard"
# 之后
git rebase -i --autosquash e70e0e87^
```

### 4.2 方案 B — 单独清理 PR(零风险)

新建分支 `chore/commit-squash-2026-07-20`,在该分支 rebase 上述 5 对,验证 typecheck + test 全绿后,开 PR → 走 PR review merge 流程(main 仍由 fast-forward 推进,无 force-push)。

### 4.3 方案 C — 不清理(接受)

5 对重复 commit 总量 < 30 commits,接受历史噪音,后续不处理。本审计文档作为协作事故记录留存。

---

## 5. 文档交付与状态

- 本文档路径:`g:\IHUI-AI\.trae-cn\audit\commit-squash-2026-07-20.md`
- 不修改 git history(符合 §16)
- 不发起新分支(避免污染)
- 仅做记录 + 建议,执行权归属用户

---

## 6. 验证证据

```bash
# 同主题对 1 — 两条 commit subject 完全一致
$ git log --format='%H %s' --no-walk e70e0e87 762c8dd1
e70e0e87e6d86f2dd07513fbe8ae0f36b80af3f2 feat(admin): extract useBatchMutation common hook, unify batch ops pattern
762c8dd10e942946179e0a21e17ba6de2eb5025b feat(admin): extract useBatchMutation common hook, unify batch ops pattern

# 同主题对 2
$ git log --format='%H %s' --no-walk 6a7170f6 ce7d076c
6a7170f6988ac31a7228b171852c3e78aa2bd699 feat(auth): 登录注册弹窗化 + UI 全面优化统一
ce7d076c3c653791eaed9ea5820ee5c3d499d3ce feat(auth): 登录注册弹窗化 + UI 全面优化统一

# 同功能对 3 (mobile-rn)
$ git log --format='%H %s' --no-walk fe11dfcc f22e507e
fe11dfcc2eb1d6807c9cc4a7bdf5c35d1ccf45bc feat(mobile-rn): C 端主体业务实装 4 Tab + Live/课程/Profile hub + i18n 5 语言
f22e507e4b9690c589623c0b10c44dfd272e08cd feat(mobile-rn): 真视频播放器 + WebSocket 直播聊天 + SecureStore token 持久化

# 同功能对 4 (miniapp-taro)
$ git log --format='%H %s' --no-walk a9a99df8 4b628b33
a9a99df8acdb174cb21b8c39121801b401acd25b feat(miniapp-taro): C 端主体业务实装 — 4 Tab 自定义 TabBar + ...
4b628b33f67076f50b580ed4a325f5f05ff183ea feat(miniapp-taro): tabBar PNG 资源 + 运营 banner API + 真实微信登录

# 同功能对 5 (desktop)
$ git log --format='%H %s' --no-walk e0313b3f 661ca904
e0313b3f7f779554f34c1fc3f2d52e90ac825d5f feat(desktop): admin shell 集成 + Tauri admin 窗口/菜单 + 5 大块路由
661ca904750f4593ffe3fc379c97d55916704b6f feat(desktop): admin CRUD 完整化(Users/Orders/Settings 弹窗 + i18n 5 语言 + hook + 测试)

# 作者一致性
$ git log --format='%H %s %an %ae' --no-walk e70e0e87 762c8dd1 6a7170f6 ce7d076c \
    fe11dfcc f22e507e a9a99df8 4b628b33 e0313b3f 661ca904
# 全部:AI智汇社 <lizong@aizhs.top>(同一人)
```

---

## 7. 与子任务 1 的关系

子任务 1(8 端 i18n 物理合并)与本审计无代码耦合:

- 子任务 1 改的是 `apps/*/src/i18n/messages/` → `packages/i18n/src/locales/_sources/apps/<app>/<lang>.ts`(纯文件移动 + re-export 路径更新)
- 上述 5 对 commit 都不涉及 `messages/` 文件
- 故 i18n 物理合并后,本审计的 5 对重复 commit 仍然存在(独立的 commit history 噪音)

---

**Status**: 📝 Audit Complete | ⚠️ Squash Not Executed(用户决策) | 📅 2026-07-20
