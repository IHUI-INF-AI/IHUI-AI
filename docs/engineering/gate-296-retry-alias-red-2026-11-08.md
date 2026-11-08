<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 门 296 存量红修复（2026-11-08）

> 现场：`origin/main` = `6030e87763267a187bfa625c7ea7c15a5622b4a4`。
> 本笔只修门 296 在该基线上已经存在的红，不引入新门号、不改判据阈值。
> 复现与验证均在独立工作树 `D:/IHUI-AI-wt-296`（基于 origin/main）执行。

## 1. 门 296 判什么

[check-retry-aliases.mjs](../../scripts/check-retry-aliases.mjs) 的四个读数：

| 读数 | 判据 |
| --- | --- |
| `alias` | 共享屏 / RN 壳里 `onRetry=` 表达式逐字命中别名表（`onBack` / `onRefresh` / `onLoadMore` / `undefined` / `null` / `onRetry ?? onRefresh`） |
| `missingRetry` | RN 壳导入了「正文含 `<ErrorState>` 的共享屏」，壳里却没有任何真 `onRetry=` |
| `fakeReload` | 把同一提取器扩面到 web 与小程序，按语义分成 真重载 / 假重载（退出·翻页·清空·空值·空回调）/ 未判定；存量落 [retry-reload-baseline.jsonl](../../scripts/data/retry-reload-baseline.jsonl)，**新增**假重载判红（棘轮） |
| `resolutions` | 本地判不了的两种情形，凭 [retry-reload-resolutions.jsonl](../../scripts/data/retry-reload-resolutions.jsonl) 的 file:line 证据改判 |

分类器实现唯一一份在 [retry-reload.mjs](../../scripts/lib/retry-reload.mjs)。别名表是**逐字**判定：`onRefresh` 一律归「列表下拉刷新」，不看该标识符在宿主侧的函数体。

## 2. 复现（修复前）

```
# worktree 面
node scripts/check-retry-aliases.mjs --worktree
  假重载  miniapp  apps/miniapp-taro/src/pkg-ai/ai/history.tsx:788  clear  onRetry={onRefresh}
  ❌ 新增假重载  miniapp  apps/miniapp-taro/src/pkg-ai/ai/history.tsx:788  clear  onRetry={onRefresh}
  台账 scripts/data/retry-reload-baseline.jsonl: 272 行;新增假重载 1;已还账 0;...
EXIT=1     # 耗时 1161ms

# staged 面
node scripts/check-retry-aliases.mjs --staged
[check-retry-aliases] 未判定(§0.3): 取不到 staged 面输入:
  取不到 staged 面 apps/web 的 onRetry 候选清单:
  git grep 失败: fatal: unable to resolve revision: --cached(不记绿也不冒红)
EXIT=2     # 耗时 1753ms
```

耗时读数取自本机同一时段**另有其它并行工作树/门在跑**的现场，仅作量级参考，不当基准。

## 3. 根因（两处，彼此独立）

### 3.1 worktree 红：真重载被「别名」了

`apps/miniapp-taro/src/pkg-ai/ai/history.tsx` 把下拉刷新回调直接接到共享屏 `ConversationHistoryScreen` 的 `onRetry`：

```tsx
onRetry={onRefresh}
```

该回调本体确实是重载（`load()` 重取服务端第 1 页并重置分页），但它以 `onRefresh` 这个标识符出现，按别名表被判 `clear`（列表下拉刷新）。基线台账里没有这一枚（同键 0 枚），棘轮据此判「新增假重载」。

**不是 prop 名/签名对不上**：共享屏的 `onRetry` 契约就是「失败态重试按钮」，RN 消费端一律写 `onRetry={() => { void load(); }}`；小程序这一处是唯一复用下拉刷新回调的接线。问题在**接线形态与语义标签不一致**，不在类型。

### 3.2 staged 红：取数 bug，不是业务红

`collectRetryCandidateFiles` 原写法把 git 选项排在 pattern 之后：

```
git grep -l onRetry --cached -- <dir>
```

git 把 `--cached` 当 revision 解析，直接 `fatal: unable to resolve revision: --cached`。脚本按 §0.3 判「取不到输入」并 exit 2，属三分口径中的**未判定**，不是绿也不是红。本次按「取不到 → exit 2，不折成通过」的口径修正取数参数，让该面能真正读出索引面候选清单后再判定。

### 3.3 修复后暴露的第三处：worktree 面把依赖目录符号链接当文件读

worktree 面用 `walkDir('apps/web')` 穷举磁盘文件。装上依赖后 `apps/web/node_modules` 出现，`hls.js` 等条目是指向目录的符号链接，`readFileSync` 直接 `EISDIR`。旧代码的 `catch { return false }` 把它当「没有 onRetry」掩盖了；严格化后按 §0.3 抛 `Undetermined`（exit 2）——但这不是「取不到输入」，是**扫了不该扫的目录**。

处置：`walkDir` 跳过 `node_modules` / `.next` / `dist` / `build` / `.turbo` / `.output`；候选过滤器先 `statSync`，非普通文件（符号链接目录/设备）直接排除，只有**普通文件读失败**才判 `Undetermined`。这样「取不到」只保留给真实读失败，依赖/产物不参与候选。

## 4. 改动

| 文件 | 改动 |
| --- | --- |
| `apps/miniapp-taro/src/pkg-ai/ai/history.tsx:788` | `onRetry={onRefresh}` → `onRetry={() => { void load() }}`，与 RN 壳同形；下拉刷新仍走 `onRefresh` |
| `scripts/check-retry-aliases.mjs` | 新增 `retryGrepArgs(face, dirPrefix)`：staged 面改为 `grep -l --cached -e onRetry -- <dir>`，head 面同步收口；`walkDir` 跳过依赖/构建目录，非普通文件不参与候选；普通文件读失败由 `return false` 改为抛 `Undetermined`（取不到不得折成「没有」） |
| `scripts/tests/check-retry-aliases.test.mjs` | 新增镜像测试：断言 staged 参数顺序；阴性对照证明改前写法必报 `unable to resolve revision`；阳性证明修正后只可能因「无命中」exit 1 |
| `apps/miniapp-taro/src/constants/ui-routes.generated.ts` | 派生自动同步：origin/main 的生成钉是旧 `sourceCommit`（d2bf9bd），钩子按现源重生成（含本页新 sha），**仅注释钉/哈希与 generatedAt 变化，路由表零变化** |
| `README.md` / `README.en.md` | `sync-readme-numbers.mjs` 刷新生成块：新增本文档 ⇒ `trackedFiles` 20059 → 20060（DN5 清单不变式） |
| `scripts/data/retry-reload-*.jsonl` | 未改动（本笔不靠豁免消红，棘轮基线未扩） |

## 5. 验证读数（修复后）

```
node scripts/check-retry-aliases.mjs --worktree
  web      文件 18 / 站点 22: 真重载 20 · 假重载 0 · 合法差异 0 · 未判定 2
  miniapp  文件 28 / 站点 28: 真重载 27 · 假重载 0 · 合法差异 1 · 未判定 0
  台账 scripts/data/retry-reload-baseline.jsonl: 272 行;新增假重载 0;已还账 0;...
EXIT=0     # 2385ms

node scripts/check-retry-aliases.mjs --staged
EXIT=0     # 11543ms(同期另一工作树在 pnpm install,读数偏大)

node --test scripts/tests/check-retry-aliases.test.mjs
# tests 11 / pass 11 / fail 0

node scripts/check-retry-aliases.mjs --self-test
# 自检 32 例,失败 0
```

## 6. 结论

- 门 296 的两处红性质不同：worktree 面是**真实接线缺陷**（重试按钮挂着下拉刷新别名），staged 面是**取不到输入的取材 bug**（exit 2）。
- 处理原则：真实缺陷改代码；取不到输入修取材参数、保留 exit 2 语义，不把「没读到」折成通过。
- 未使用任何豁免/台账放宽；`retry-reload-baseline.jsonl` 与 `retry-reload-resolutions.jsonl` 均未改。
- 除本页外，`apps/miniapp-taro/src/pkg-ai/**` 的其他文件未触碰；另一条线在 `pkg-ai/ai/cards/types.ts` 的未提交改动与本次改的 `ai/history.tsx` 不是同一文件。
- 附带两处机械派生：`ui-routes.generated.ts` 由钩子按现源重钉（路由表零变化），README 生成块按 DN5 同步 `trackedFiles`。
