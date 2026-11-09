<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 30a 结论缓存分片（worktree 私有 vs 共享 gitdir）与备份命名空间事实

- 日期：2026-11-08
- 归属：30a（commit 丢失防护）专项
- 取证基线：`fix/ai-service-stock-red-1108` worktree；30a 单跑 rc=0 / 176s

## 事实（两句话）

1. 30a 的结论缓存按 `realGitDir()` 落在各 worktree 私有 gitdir：`D:\IHUI-AI-git-repo\worktrees\IHUI-AI-wt-aisvc-stock-red-1108\ihui-commit-loss-cache.json`（flat schema，`coverageVersion` 5，1156 字节，mtime 15:59:21）；而共享 `D:\IHUI-AI-git-repo\ihui-commit-loss-cache.json`（1191 字节，mtime 15:55:48）是另一版本写的 slot schema `{"version":2,"slots":{"30|0|1|6":{…}}}`，`coverageVersion` 6。
2. 两套命中判据互不兼容：flat 版 `readLossCache` 要求顶层 `ts`（数字）、`blocking`（布尔）与 `face` 全字段（`windowDays`/`strict`/`filterStash`/`tagFingerprint`/`tagTargets`/`delivery`/`reflog`/`unreachable`/`coverageVersion`）指纹相等；slot 版按 `30|0|1|6` 槽位取用，slot 文件没有顶层 `ts`/`blocking`/`face` ⇒ flat 版恒 miss，反向亦然 ⇒ 每个 worktree 各自冷跑。

## 证据

- 同参冷跑：`node scripts/check-commit-loss-guard.mjs --blocking --filter-stash --staged`，rc=0 / 176s；`IHUI_LOSS_TIMING=1` 显示 `lossCacheInputs(ok)`。
- 提交内未命中：悬空面指纹由 222 变为 213（并发会话 tag/备份活动），按同判据重算，整条 hook 链 301s；300s 看门狗未触发。
- 缓存 TTL `LOSS_CACHE_TTL_MS` = 30 分钟；`IHUI_COMMIT_LOSS_NO_CACHE=1` 强制重算。
- 实测两份缓存并存：`…/worktrees/IHUI-AI-wt-aisvc-stock-red-1108/ihui-commit-loss-cache.json`（flat）与 `D:\IHUI-AI-git-repo\ihui-commit-loss-cache.json`（slot）。

## 备份命名空间（30a 判据事实）

- 30a 的「已备份」集合只认 `refs/tags/lost-commit/*` 与 `refs/tags/backup/*`（`scripts/check-commit-loss-guard.mjs` 的 `for-each-ref` 列表）。
- `scripts/backup-unreachable-commits.mjs` 产出的是 `unreachable-commits-backup/<yyyymmdd-HHMMSS>-<hash12>`，不在上述集合 ⇒ 打满也不改变 30a 判定；该脚本无 dry-run，会 tag 全部 fsck unreachable（本仓只读试跑 219 枚），不得再作为 30a 处置手段。
- 30a 自己给出的处置命令是 `git tag lost-commit/<name> <hash>`；本次窗内未备份 0 枚，实际新增 tag 0 枚。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
