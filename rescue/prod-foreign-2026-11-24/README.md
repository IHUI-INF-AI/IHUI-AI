<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 生产签出外来改动快照（2026-11-24）

## 为什么有这份东西

`D:\DevEnv\ihui-prod`（生产签出）有 **74 个已跟踪文件被改动却从未进 git**（另有 27 个未跟踪文件）。
部署环更新代码要 `git merge --ff-only`，这些未提交改动与要更新的路径重叠 ⇒ git 拒绝 ⇒
部署每 3 分钟撞一次、连续数小时停摆，并连锁出「部署停摆 / compose 部署失败 / 反馈闭环卡住」等一串告警。

按指令**一律落仓**：先把全部内容无损收进仓（本目录），再清理生产签出恢复部署。

## 内容

- ~~`prod-foreign-work.tar.gz`~~ —— **2026-11-25 已移仓外**（见下节），101 个文件的原样快照（12.78 MB, gzip），保留原相对路径
- `MANIFEST.json` —— 逐文件 `bytes / mtime / gitBlobSha1 / sha256 / class`（内容仍在，可作为快照完整性的唯一凭据）

分类口径（`class` 字段）：

| 标记               | 含义                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| A 本机工作树同内容 | `D:\IHUI-AI` 工作树已有完全相同的内容（37 个）                                                                                      |
| B / C              | 与 HEAD / origin/main 内容相同（本次 0 个）                                                                                         |
| D 本机有但内容不同 | 本机有同名文件但内容不同（34 个）                                                                                                   |
| E 本机无此文件     | 生产独有，git 任何面都没有（3 个：`points_multiplier_rules.py`、`points-multiplier-rules-data.ts`、`points-multiplier-rules.json`） |
| untracked          | 生产未跟踪小文件（含 `waf-signatures.mjs`、`auto-commit-quiet*.mjs` 及其测试、`xiaofang*.svg/gif` 等）                              |

## 无损证明

解包后逐文件 sha256 与 `MANIFEST.json` 比对，2026-11-24 实测 **101/101 一致，0 不一致**。

复验步骤（把 `$SNAP` 指向仓外那份 tar.gz）：

```powershell
$SNAP = 'D:\DevEnv\rescue-archive-20261125\v1-prod-foreign-work.tar.gz'
New-Item -ItemType Directory -Force _verify | Out-Null
tar -xzf $SNAP -C _verify
# 逐条读 MANIFEST.json 的 sha256 与 _verify 下同名文件比对
```

## 回取单个文件

```powershell
$SNAP = 'D:\DevEnv\rescue-archive-20261125\v1-prod-foreign-work.tar.gz'
tar -xzf $SNAP -C <目标目录> apps/ai-service/app/core/llm_gateway.py
```

## 打包快照移仓外（2026-11-25，仓库重量清偿）

`v1`(13,397,094 B) 与 `v2`(13,456,832 B) 两份 tar.gz 共 25.6 MB，使 HEAD 跟踪总量达 475.2 MB、
越过 `check-file-size.mjs --weight` 的 450 MB 预算并阻断推送。按"不丢数据"原则处置：

- 移存至 `D:\DevEnv\rescue-archive-20261125\`（v1/v2 各两份副本，逐字节同长）：
  `v1-prod-foreign-work.tar.gz`、`v2-prod-foreign-work-v2.tar.gz`、`v1-main-copy-…`、`v2-main-copy-…`
- **仓内保留 `MANIFEST.json` / `v2/MANIFEST-v2.json`**：逐文件 sha256 全在，快照完整性仍可离线自证
- v2 是 v1 的超集（105 项 ⊇ 101 项），回取一律优先用 v2
- 移出后 HEAD 跟踪总量 475.2 → 449.6 MB，回到 450 MB 预算内

## 未进仓的两份大产物（仓外另存，未删除）

- `D:\DevEnv\ihui-prod\.git-broken-20261122\` —— 2.0 GB，损坏 git 目录备份
- `D:\DevEnv\ihui-prod\apps\web\.rollback.retired-77d3f9b8a79847c98b25aeecd7ddd4ca\` —— 74.8 MB，旧回滚产物

两者与任何目标提交路径均不重叠，不阻断 ff，故未打包。

## 后续

D 类 34 个内容不同的文件**不要盲目回灌主线**：本机正在收敛的三端个人中心 / i18n 线（80 枚本地独有提交）已是更新实现，直接覆盖会回退。
需要回取时按单文件 diff 判方向后再合。

## v3 快照（2026-11-24 22:45 前后）

- `v3/prod-foreign-v3.zip`（103,103 B / 9 文件，逐条 sha256 与盘上一致）：
  `apps/api/src/db/oauth-queries.ts`(+28)、`apps/api/src/routes/auth-extended.ts`(+29/-?)、`apps/web/public/sw.js`(2)、
  `deploy/win/ihui-api-router.mjs`(+235)、`deploy/win/lib/edge-admission.mjs`(+28/-?)、
  以及未跟踪的 `deploy/win/lib/{block-notice,notice-ledger,tool-fingerprint,waf-signatures}.mjs`。
- 明细见 `v3/MANIFEST-v3.json`（逐文件 bytes+sha256）。
- 三项按"不丢但体积/敏感性不入仓"移存至 `D:\DevEnv\ihui-prod-orphans-20261124c\`：
  `.git-broken-20261122/`（1146 文件 / 2013 MB，.git 损坏备份）、
  `apps/web/.rollback.retired-77d3f9b8a79847c98b25aeecd7ddd4ca/`（5053 文件 / 76.6 MB，退役回滚目录）、
  `probe_prod_creds.py` 与 `probe_prod_config.py`（疑似生产凭据/配置探测脚本，敏感性）。
- 清完后 prod 已 ff 至 `2364914c28`，`check-migrations-landed`（prod 自身 ROOT）读到 landed/468/零 missing。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
