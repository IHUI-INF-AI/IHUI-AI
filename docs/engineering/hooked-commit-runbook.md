# 带钩子提交 Runbook（其他线照抄）

适用：在正常树上提交代码时，要让 `pre-commit` / `commit-msg` 真跑，而不是用 `--no-verify`、`IHUI_LAND_SKIP_AFFECTED_GATES=1` 或"不跑钩直接 object-space-land"落地。

本文实测于 2026-11-05，主干 `beb31b537d`（以下示例提交 `9341f6689856330934f7118e421286140b11bfa9`）。

## 0. 前置检查

```bash
git -C <repo> rev-parse HEAD              # 记录基线
node -v && pnpm -v                        # 本机实测 node v26.5.1 / pnpm 11.18.0
node scripts/check-workspace-dep-links.mjs # 门 78：链接面健康，exit 0 才继续
```

门 78 判红（`node_modules` 链接面被剪）时先修依赖，不要带着坏链接面提交：`pnpm install --force --frozen-lockfile --prefer-offline`，修完重跑门 78。

## 1. 建一次性隔离树

```bash
git -C <repo> worktree add -b probe/<线名>-<日期> <盘>:\IHUI-AI-wt-<线名> <HEAD sha>
```

隔离树只用于验证链路或试跑，不与他人工作树共享索引；主树跟踪文件不动。

## 2. 装依赖（不设任何 skip）

```bash
pnpm install --frozen-lockfile --prefer-offline
```

期望：

```
Lockfile is up to date, resolution step is skipped
Done in ... using pnpm v11.18.0
```

若报 `ERR_PNPM_OUTDATED_LOCKFILE`（manifest 与 lock 不同步）：找改动方对齐 manifest/lock，**不要**加 `--no-frozen-lockfile` 蒙混；若报 `ERR_MODULE_NOT_FOUND` 且包其实在 `node_modules/.pnpm` 里，按门 78 的结论修链接面（不是改 lock）。

## 3. 无害改动 + 五步法

先造一笔只加注释、无行为变更的改动，然后：

```bash
node scripts/safe-commit.mjs -m "chore: probe" -- <只改一个文件>
```

期望末两行：

```
✅ Pre-commit 检查通过
✅ commit 干净,仅包含 1 个预期文件
```

说明：`-- <files>` 是必需的声明面；safe-commit 只暂存声明文件，并把他人暂存件用私有索引挡在载荷之外（日志会写"外来暂存按设计保留(不进本枚提交)"）。看见这行不是错。

## 4. 回读与收尾

```bash
git show --stat --oneline <新 sha>              # 必须只有声明文件
git ls-remote --heads origin | grep <分支名>    # 未推送时应为空
git worktree remove --force <worktree 路径>
# Windows 报 Filename too long 时：
Remove-Item -LiteralPath '\\?\<worktree 路径>' -Recurse -Force
git worktree prune
Test-Path <worktree 路径>                       # 期望 False
```

## 必须跳的情形 + 唯一合规出口

**唯一合法跳钩 = `safe-commit --allow-skip-hooks="<原因>"`**（默认关闭；正文自动写入 `人工授权跳钩:<原因>`，审计上分得出"真过钩"与"人工授权跳钩"）。实现见 `scripts/safe-commit.mjs` 头部用法与"默认永不跳钩"段。

只有下列情形才允许人工授权跳钩：

1. **他人暂存面 / 在飞提交污染**：scope 类门把"非本票文件"判红，且等并发窗口无果（safe-commit 日志点名"非本票路径在窗口期新进入共享索引"）。
2. **与本次内容无关的恒红门**：环境或存量导致，短期修不掉。正确处置仍是修门或差值棘轮；跳钩是最后一格，且必须写明是哪道门、为什么量不到本票。

**不该跳**：索引锁争用（`node scripts/git-lock.mjs check` 看持有者后重试）、提交身份缺失、网络失败。这些不是门的结论，`object-space-land` 只用于索引争用 / 对象空间修复，且落地后必须自带受影响门的复跑记录，**不得当跳钩旁路**。

### commit body 合规留痕模板

```
fix(<scope>): <一句话说明>

人工授权跳钩: 门 <N> 判红源自他人未提交文件,本票未触及
已复跑: node scripts/<该门脚本>(exit 0)
批准: <工单/席位> @<YYYY-MM-DD>
```

## 禁止项（硬）

- `git commit --no-verify`（safe-commit 已拒绝该路径；手工绕过同样不合规）。
- `IHUI_LAND_SKIP_AFFECTED_GATES=1`。
- 不跑钩直接 `object-space-land`（仅限索引争用 / 对象空间修复，不得用来绕钩子红的门）。
- 各处自拼 `HUSKY_SKIP_*` 来关质量门；这些变量一律视为跳门。唯一例外是 `HUSKY_SKIP_PUSH=1`——它只关 post-commit 的推送腿、不参与 `pre-commit`/`commit-msg` 任何门，用于"本地试跑但不推远端"。

## 实跑样例（2026-11-05）

安装：

```
Lockfile is up to date, resolution step is skipped
Packages: +4122
Done in 3m 0.7s using pnpm v11.18.0
```

带钩子提交（`9341f6689856330934f7118e421286140b11bfa9`）：

```
🔒 safe-commit 启动 → 分支: probe/hooked-commit-runbook-20261105
🔒 期望暂存 1 个文件
✅ 暂存区精确匹配预期 1 个文件
🔒 Step 4/5: git commit(普通提交,不带 pathspec)— 首次尝试(含 pre-commit hook)
白名单豁免(不阻断): 1
错误(阻断): 0
✅ Pre-commit 检查通过
⏭  commit scope 一致性检查(1 文件, 无 scope, 通过)
[probe/hooked-commit-runbook-20261105 9341f66898] chore: probe
 1 file changed, 1 insertion(+)
✅ commit 干净,仅包含 1 个预期文件
```

回读：`1 file changed, 1 insertion(+)`，仅 `packages/eslint-config/cross-end.js`；远端无该分支。
