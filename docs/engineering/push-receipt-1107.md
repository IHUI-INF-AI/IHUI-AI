<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 推送门凭据（push receipt）设计（2026-11-08）

> 目标：把「推送时跑门」拆成「提交侧求值 + 推送侧内容寻址校验」，推送墙钟逼近一次
> 本地对象读取 + HMAC 验签；**不放宽任何判据、不允许任何提交跳过门**。

## 0. 一句话结论

- **门仍真跑**：由 `post-commit` 派生的后台 worker 对「完整 HEAD 树」跑 13 门 + 文档数字门 + i18n 审计，
  全部通过才签发 `ihui-push-receipt/v1`。
- **推送侧只校验**：`pre-push` 先验凭据（1 次 `rev-parse` + 1 次 `cat-file --batch-check` + 1 次 HMAC），
  通过即 `exit 0`；任一字段不符 ⇒ **原样落到下方既有的真跑门路径**。
- **窗口闭合**：worker 运行期间写 `<head>.running` 标记，推送侧先等（默认上限 240 秒，
  `IHUI_PUSH_RECEIPT_WAIT_MS` 可调）；等到凭据就用，等不到就回落真跑。不存在「稍后补跑」的放行口。

## 1. 前提校正（实测事实）

1. 任务里提到的 `scripts/lib/gate-cache.mjs` **在 `origin/main` 上不存在**（那是 cut7 分支的命名）。
   现网实际有两套缓存：
   - `scripts/lib/guardian-pushgate-cache.mjs`：整批指纹缓存，只缓存全绿，TTL 60 分钟；
   - `scripts/lib/guardian-gate-cache.mjs`：逐门内容指纹缓存。
   凭据**不复用**这两套的既有键格式，而是自带 `cacheKey`
   = `sha256(treeSha ∥ gateId ∥ RUNNER_VERSION ∥ runnerBlob ∥ executorBlob ∥ scriptBlob ∥ nodeVersion)`，
   使「树、门、门脚本、执行器、Node 版本」任一变化都无法沿用旧结果。
2. 13 门实测墙钟 111.9–114.5 秒；本机 `git ls-remote origin` 约 3.2 秒（所以推送侧**不做**网络探测），
   `git status --porcelain` 约 2.5 秒（所以推送侧**不查**工作树脏净，脏净只在签发侧强制）。

## 2. 机制总览

```
git commit
   └─ .husky/post-commit
        └─ scripts/lib/post-commit-hook.js
             └─ detached spawn scripts/lib/push-receipt-worker.mjs   （不占提交返回路径）
                  ├─ 锁 .worker.lock（并发 worker 只跑一个）
                  ├─ 写 <head>.running 标记（推送侧据此"等"）
                  ├─ guardian-runner.mjs --push-gate --no-cache --timing
                  ├─ check-doc-numbers.mjs --strict --push（阻塞）
                  ├─ scan-dead-i18n-keys.mjs --dry-run（advisory，只记 rc）
                  ├─ HEAD/tree/origin-main 漂移与脏净前后双检（漂了就重试，最多 3 轮）
                  └─ issueReceipt() → .ihui-agent/state/push-receipts/<commitSha>.json

git push
   └─ .husky/pre-push（tag 门之后、原真跑门之前）
        ├─ PUSH_REFS 为空 ⇒ 不进入凭据块（照旧真跑门）
        ├─ node scripts/push-receipt.mjs --verify
        │    exit 0 ⇒ 打印"凭据校验通过"并 exit 0
        │    非 0 ⇒ 打印回落原因，**继续执行下方逐字保留的真跑门路径**
        └─ 既有 typecheck / doc-numbers / i18n 门（判据一字未改）
```

worker 的落盘路径全部在 `.ihui-agent/state/`（已被 `.gitignore` 的
`/.ihui-agent/state/*` 覆盖），不会自己把工作树变脏。

## 3. 凭据字段（`ihui-push-receipt/v1`）

| 字段 | 含义 | 校验点 |
| --- | --- | --- |
| `version` | 固定 `ihui-push-receipt/v1` | 精确等于 |
| `runnerVersion` | 固定 `push-receipt-runner/v1` | 精确等于 |
| `nodeVersion` | 签发时 `process.version` | 等于验签进程版本（防跨 Node 版判据漂移） |
| `commitSha` | 被求值的 commit | 等于 `HEAD` |
| `treeSha` | 被求值的完整树 | 等于 `HEAD^{tree}` |
| `remoteBase` | 基线 `origin/main` | 等于当前 `origin/main`（远端已漂移即回落） |
| `issuedAt` / `expiresAt` | ISO 时间，TTL 60 分钟 | 未过期、未来自未来（容许 5 分时钟偏移） |
| `worktreeClean` | 签发时工作树必须干净 | 必须为 `true` |
| `pushedTreePolicy` | 固定 `full-head-face` | 精确等于（见 §7） |
| `runnerClosure` | `[{path, blob}]`：runner 与 executor 两条 | 条数、顺序、路径、blob 全等于 HEAD 值 |
| `gateSetHash` | `sha256(gateSet 规范化 JSON)` | 重算必须相等 |
| `gateSet` | 15 条（13 门 + 173p + i18n） | 见下 |
| `signature` | `{alg:'hmac-sha256', keyId, sig}` | 常量时间比对 |

`gateSet` 每条字段（白名单，多余键直接判红）：

| 字段 | 含义 |
| --- | --- |
| `id` / `script` / `args` / `mode` | 与 `EXPECTED_GATES` 逐项相等（缺门/多门/换参数/改 mode 全红） |
| `scriptBlob` | 该门脚本在 `HEAD` 的 blob |
| `cacheKey` | §1 的复合内容键 |
| `rc` / `durationMs` | 真实运行退出码与耗时（blocking 必须 `rc===0`；`cached` 行拒收） |

## 4. 签名载荷

签名**不是**对整个 JSON 文件签名，而是对固定顺序的规范化对象：

```
{version, runnerVersion, nodeVersion, commitSha, treeSha, remoteBase,
 issuedAt, expiresAt, worktreeClean, pushedTreePolicy, runnerClosure,
 gateSetHash, gateSet(逐条白名单规范化)}
```

`HMAC-SHA256(key, JSON.stringify(payload))`，十六进制落 `signature.sig`。

因此：

- 改 `treeSha`、改任一 `rc`、删/加一门、改签名本身 ⇒ 载荷变 ⇒ 验签失败；
- **改任一门的脚本** ⇒ `scriptBlob`/`cacheKey`（载荷内）与新 HEAD 的 blob 对不上 ⇒
  `gate-script-blob-mismatch` / `gate-cache-key-mismatch`，**旧凭据无法复用**；
- 改 runner 或 executor ⇒ `runner-blob-mismatch`；
- 门集合与注册表发生漂移 ⇒ 镜像夹具（`scripts/tests/push-receipt.test.mjs`）先红。

## 5. 谁能签、钥怎么隔离

| 项 | 值 |
| --- | --- |
| 环境变量 | `IHUI_PUSH_RECEIPT_KEY`（≥32 字符） |
| 文件变量 | `IHUI_PUSH_RECEIPT_KEY_FILE` |
| git 配置 | `ihui.pushReceiptKeyPath`（本机已指向 `%LOCALAPPDATA%\IHUI\push-receipt.key`，64 hex） |
| 与 IG 提交钥 | `ihui.immutableGuardKeyPath`；**代码强制比对，相同即拒**（`key-collision-ig`） |
| 与 IG ack 钥 | `ihui.immutableGuardAckKeyPath`；相同即拒（`key-collision-ack`） |

隔离理由：凭据签发权 = 「任意 tree 的 13 门结果」，与「不可变守卫豁免权」绑死会让任一钥泄露同时污染两侧。

**安全边界（必须直说）**：本机签名钥对同机机主可读 ⇒ 只能防「仓库内篡改 / 旧凭据复用 / 误判」，
**不能防机主本人伪造**。要防机主，签名者必须离开该机（CI job 或外部密钥服务，把私钥放到
worker 够不到的地方）；本实现已把钥路径走 env/git config，便于后续替换成 CI 签发而不改判据。

## 6. 回落触发条件矩阵（fail-closed）

任一行成立 ⇒ `--verify` 返回非 0 ⇒ `pre-push` 继续真跑门（不放行、不降级）：

| 条件 | code |
| --- | --- |
| 钥缺失 / 与 IG 或 ack 钥撞 | `key-unavailable` / `key-collision-ig` / `key-collision-ack` |
| 凭据文件不存在 | `receipt-missing`（若 `<head>.running` 存在则先等） |
| 读不出 / JSON 坏 / 超 4MB | `receipt-parse` / `receipt-too-large` |
| 顶层或签名或门对象键集不符 | `receipt-schema` / `signature-schema` / `gate-schema` |
| 版本/runner/Node/树策略/脏净不符 | `receipt-version` / `runner-version` / `node-version-drift` / `tree-policy` / `worktree-not-clean-at-issue` |
| 闭包缺失或路径不符 | `runner-closure-missing` / `runner-closure-schema` / `runner-closure-mismatch` |
| 签名算法不符 / 验签失败 | `signature-alg` / `signature-invalid` |
| 时间非法 / 未来 / 过期 | `ttl-invalid` / `ttl-future` / `ttl-expired` |
| commit / tree / 远端基线不符 | `commit-mismatch` / `tree-mismatch` / `remote-base-mismatch` |
| push refs 非分支 / 删除 / 多 tip / 非 HEAD | `refs-not-branch` / `refs-deletion` / `refs-head-mismatch` / `refs-parse` |
| refs 非快进 | `refs-non-fast-forward` |
| 取不到 HEAD/tree/origin-main/blob | `context-gather-failed` |
| 缺门 / 多门 / 重复 | `gate-missing` / `gate-unknown` / `gate-duplicate` |
| 脚本/参数/mode 漂移 | `gate-script-drift` / `gate-args-drift` / `gate-mode-drift` |
| 门脚本 blob / cacheKey / runner 闭包 blob 不符 | `gate-script-blob-mismatch` / `gate-cache-key-mismatch` / `runner-blob-mismatch` |
| 任一门 blocking `rc≠0` | `gate-not-passed` |
| 耗时非法 / 门集哈希不符 | `gate-duration-invalid` / `gate-set-hash-mismatch` |

签发侧（worker）另有独立拒绝条件：工作树不干净、13 行不齐、出现 `cached` 行、
HEAD/tree/origin-main 漂移、文档数字门 `rc≠0`。**签发失败不产生凭据** ⇒ 推送侧自然回落。

## 7. 语义选择与局限

- **`full-head-face`**：worker 不知道未来 push scope，因此对**完整 HEAD 树**求值。
  这比任何 push scope 都更严：凭据通过 ⇒ 任何子集 scope 通过。代价是每枚提交都跑全量门（后台，不占提交路径）。
- **基线 = `origin/main`**：与既有 IG 门（`origin/main..HEAD`）一致。推送侧不读真实远端 tip（见 §1 网络成本）；
  远端已推进时 `remote-base-mismatch` ⇒ 回落真跑门。这是「不知道远端尖端」的诚实代价。
- **仅接受分支推送**：标签 / 混合 / 删除 / 多 tip 一律回落（判据不变，只是不省这一步）。
- **当前分支首次推送**：`post-commit` 派生 worker 后立刻 `git push`，会先等 marker（上限 240 秒），
  然后要么用凭据、要么回落真跑。这是 §0 窗口约束的直接代价，无法既"不等"又"不回落"。

## 8. 受保护面

| 路径 | 状态 |
| --- | --- |
| `scripts/push-receipt.mjs` | **新增条目**（`kind: gate-registry`） |
| `scripts/lib/push-receipt.mjs` / `push-receipt-worker.mjs` | `scripts/lib/` 既有覆盖面 |
| `.husky/pre-push` | 既有覆盖面 |
| `scripts/lib/guardian-executor.mjs` / `post-commit-hook.js` | `scripts/lib/` 既有覆盖面 |

改这些路径需要 `immutable-exempt:` 理由（`signatureRequiredFrom=2026-11-11` 之前只需文字理由，
之后必须 `IHUI_IMMUTABLE_GUARD_KEY` 签名）。

## 9. 夹具与复现

```sh
node --test scripts/tests/push-receipt.test.mjs
```

15 个用例，其中用户要求的五类反证各自判红：

| 反证 | 期望 code |
| --- | --- |
| ① 凭据伪造（换钥重签） | `signature-invalid` |
| ② 树不符 | `tree-mismatch` |
| ③ 缺一门（签名仍有效） | `gate-missing`（detail=`T1`） |
| ④ 签名字节被改 | `signature-invalid` |
| ⑤ 门脚本被改（HEAD blob 变） | `gate-script-blob-mismatch`（detail=`T1`） |

另有：`rc≠0`、过期/未来、`remoteBase` 漂移、executor blob 变、参数漂移、多一门、refs 非法、
注册表镜像（13 条逐项 deepEqual）、以及**sh 级回落证明**：从 `.husky/pre-push` 逐字抽取凭据块，
用桩 `wscript` 跑两次——`rc=0` 不打印哨兵（不进回落），`rc≠0` 打印哨兵（**确实继续执行到真跑门位置**）。

## 10. 实测（本轮，待填）

> 口径：直接调用 `.husky/pre-push` 钩子并合成 stdin（`GIT_LFS_SKIP_PUSH=1`），
> 与完整 `git push` 分开记账——本机针对临时 bare remote 的传输/LFS 环境开销约 41–50 秒，
> 与门无关，加进来会淹没被测机制。

| 场景 | 3 次读数（秒） | 中位数 |
| --- | --- | --- |
| 改造前：无凭据块，强制缓存 miss | 待填 | 待填 |
| 改造后：有效凭据 | 待填 | 待填 |
| 反证：删除凭据 ⇒ 回落真跑门 | 待填 | 待填（应≈改造前，且日志含 13 门逐门行） |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
