<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# B4-impl — 技能/市场列表廉价判脏 + 自描述 scope

- HEAD: `4fe208a71c20d5b3fcca68d40daa7d7a2185bee4` (main,本席未提交、未推送)
- 时间盒: 单轮 vitest 最长 7.05s,未触发拆分
- 对侧证据: `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/W2-workbuddy-periphery.md` 缺口表"技能/市场列表缓存的廉价判脏 + 稳定空态件"一行(半格)

## 现场读数

对侧(本机实读 `C:/Users/Administrator/.workbuddy/.skill-list-cache.json`,82,208 B,2026-11-04 23:53):

- 顶层键 = `version, results, watch, signature, scopeKey, savedAt`;`version:6`、`results` 57 条、`watch{dirs:75, files:64}`、`savedAt:1793807623612`。
- `signature = {ok:139, missing:0, sum:4009379584, xor:188008686}` —— 四个廉价整数,不猜 mtime 也不做全量 hash(这一族值得抄)。
- `scopeKey` 实测是**字符串里再套一层 JSON 数组的定长位置编码**,11 槽:`[.workbuddy 根, skills 根, 内置技能根, skills-marketplace 根, "", "", "", "", false, "<内嵌 JSON 串:禁用技能名数组>", "<内嵌 JSON 串:[[skill@plugin,bool]]>"]`
  ⇒ 4 个**空串占位** + 2 段二次编码。槽位数一变或某占位换机后非空,读出来的 scope 就把 A 的值当 B 用,且不报错(对方缺陷,本票的反面教材)。

本仓(自己 grep 复算,非照抄盘点):

- `apps/cli/src/plugins/cache.ts`:sha1(url) 目录键(:76)+ TTL 5 分钟(:64)+ staging/归档原子交换 + 崩溃恢复 + `copyNeedsRefresh` 显式"需刷新"记录 —— 已成型,**未重写、只借形态纪律**(具名数据目录出口、原子写唯一出口、降级必带可诊断说明)。
- `apps/cli/src/skills/`:签名字符串只活在进程内(`allowed-tools-shadow.ts:268 signatureOf`,顺序无关 + undetermined/invalid 条数进签名),**无磁盘缓存、无 scope 键、无 watch 驱动失效**;`loadSkills`(:807)每次全量扫盘 + 全文解析。
- `apps/cli/src/config/defaults.ts:44` 现读 `fsWatcher: { enabled: false }` ⇒ 通用监听默认关。
- `apps/cli/src/plugins/marketplace.ts` 的 `MarketplaceIndex` 无 TTL/etag/watch 元数据(本票未动,见未竟④)。
- 落点出口现读:`apps/cli/src/plugins/paths.ts:35 getIhuiRoot()`(认 `IHUI_HOME`)。
- 纯度前提:守门 126 `check-shared-nonde-node-purity.mjs` 射程含 `packages/shared/src` ⇒ 新判据文件零 `node:` 内建、IO 留端内。

## 落了什么

1. `packages/shared/src/skills/catalog-cache-schema.ts`(纯判据,零 import,276 行含 4 行水印)
   - `CatalogCacheEnvelope<T> = { schemaVersion, scope, savedAt, signature, watch, results, emptyMarker? }`。
   - **scope 自描述**:`{ projectDir, repoRoot, userHomeDir, includeUserHome }` 四个具名字段恒有值(零空串占位);`differingScopeKeys` 给出**字段名**级差异,不是槽位号。
   - 廉价判脏:`fingerprintCatalogEntries(seeds)` ⇒ `{ok, missing, sum, xor}`(纯函数,输入 name/version/更新时刻,不读盘;FNV-1a 32 位,顺序无关)。`missing` 单列一票 —— 名字为空或时刻量不到都进 `missing`,且 `isCatalogDirty` 里**任一侧 missing>0 即判脏**(量不到 ≠ 没变;对方那档 missing 只表示"文件不在")。
   - 三态 `classifyCacheHit(env, now, freshnessMs, expectedScope?)` ⇒ `hit` / `stale` / **`unjudged`**:信封缺席、schema 版本不符、scope 字段对不上、results 非数组、缺 signature/watch/savedAt ⇒ 一律 unjudged 并逐格点名;失效方向恒为"多要一次扫盘",绝不冒 hit。
   - `catalog-empty-stable` 具名件:`results` 为空**且**带该件 ⇒ 稳定态 hit;为空而无件 ⇒ unjudged(空数组不得冒充"没有技能",§0.3)。
   - 时钟偏斜:`FUTURE_SAVED_AT_TOLERANCE_MS=5000`(`cache.ts:332` 实测教训 —— mtime/时间戳可超前 `Date.now()` 若干 ms);超容忍的"未来 savedAt"判 stale,不发合格证。新鲜度只由 `savedAt` 算,全程不看 mtime。
   - `decodeCatalogCacheEnvelope` 只做**结构**判定并逐条点名(坏 JSON / scope 是字符串这种对方形态当场拒),语义判定留给 classify;`encode…` 往返保五件套。
2. `apps/cli/src/skills/catalog-cache-store.ts`(真消费者,216 行)
   - 落点 `skillCatalogCachePath() = path.join(getIhuiRoot(), 'skill-catalog-cache.json')`(不手拼 home;测试经 `IHUI_HOME` 换根)。
   - `readSkillCatalog(opts)`:`decode → classify(带 expectedScope)→ hit 时再做**廉价探针**(逐条 `statSync` 源文件 mtime,不读正文)→ 不脏才回缓存`;stale/dirty/unjudged 一律重建,重建后回写信封。缓存的是清单(名称/描述/来源/优先级/version),**不含正文**,文件头明写"不声称加速正文加载"。
   - 探针与写侧共用同一条 `seedsOf` 构造路径(两侧各拼一次就是"每次必判脏"的缓存死锁)。
   - 命中/降级/未判定各有**一条**可读日志(ASCII,避开守门 70 的每文件中文字面量额度),并经 `onNotice` 出口(缺省 stderr)交给调用方断言。
   - 写盘走全仓唯一原子写出口 `captureWriteBaseline + commitAtomicWrite`;回写失败只降级本次、不改清单结论,且现场不留半份。
3. `apps/cli/tests/catalog-cache-schema.test.ts`(33 例)+ `apps/cli/tests/catalog-cache-store.test.ts`(11 例)
   - 三态成对(hit/stale/unjudged 各正反)、空清单 ≠ 未判定(具名件两向)、scope 换机必判不命中并点名 `projectDir`/`userHomeDir`/`includeUserHome`、对方那种"字符串套数组"的 scope 被 decode 当场拒。
   - 形状锁(读 shared 源文本):不出现 `node:fs`/`node:path`/`node:crypto`/`process.cwd`/`os.homedir`/`__dirname`/`require(`,且除类型外零 import。
   - 端内消费:命中时 `scan` 调用数恒 0(硬证据)、`utimesSync` 改文件 ⇒ dirty、超窗 ⇒ stale、坏 JSON ⇒ unjudged 且回写自愈、探针 missing ⇒ 判脏后落成干净空信封。

## 验证末行现读

- `cd apps/cli && npx vitest run tests/catalog-cache-schema.test.ts tests/catalog-cache-store.test.ts`
  ⇒ `Test Files 2 passed (2)` / `Tests 44 passed (44)` / `Duration 5.09s`
- `npx tsc --noEmit -p apps/cli/tsconfig.json | grep catalog-cache` ⇒ 空(本席触及面 0 错误)。全量现读 9 条 `error TS`,**逐条核实均非本席**:
  `commands/skill-package.ts` ×7(成因 = 他席把 `apps/cli/src/skills/packaging/index.ts` 暂存删除)、`tools/file-batch-edit.ts` ×1(他席在飞改动)、`utils/markdown-to-html.ts` ×1。
- `npx tsc --noEmit -p packages/shared/tsconfig.json` ⇒ 1 条:`chat/workspace-tool-executor.ts(25,8) Cannot find module '../attribution'`(成因 = 他席 `D packages/shared/src/attribution/index.ts`),与本席无关。
- `node scripts/check-shared-nonde-node-purity.mjs --worktree` ⇒ `✅ … 红 0`(shared 候选 325 / 闭包 239)。
- `node scripts/check-declared-policy-has-consumer.mjs --worktree` ⇒ `❌ 无法判定(exit 2) … 判红文件 0 / 未接线 10(存量,只报数)`;名单内无 catalog 符号(我的新常量名刻意不取 TTL/MAX_AGE/RETENTION 大写族,新清理函数动词档亦未触发)。
- `node scripts/scan-hardcoded-zh.mjs <两枚源文件>` ⇒ 本席两枚文件**不在**新增名单(其余条目均属他席在飞)。
- `npx prettier --check` 四枚 ⇒ `All matched files use Prettier code style!`
- `node scripts/watermark.mjs verify` 四枚 ⇒ `覆盖 4/4 … 残迹 0 / 载荷损坏 0 / 仅隐写 0`,末行 `纳入口径的文件均已携带完整溯源水印。`(顺序:写 → prettier → clean/inject → verify;inject 后的最后一次改动是行内注释,verify 复跑仍 4/4)
- `grep ": any\|as any\|<any>"` 两枚源文件 ⇒ 无 any。
- 边界自证:`git status --porcelain` 本席只新增上述 4 枚(未 commit、未 push、未动 PROJECT_PLAN.md / AGENTS.md / scripts/ / plugins/cache.ts / marketplace.ts / tools/** / sandbox/** / commands/share.ts)。

## 未竟(带解锁条件)

1. **消费者还没被挂上命令面**:`/skills` 仍直调 `loadSkills`,`readSkillCatalog` 是"已装车的 shared 契约消费者、但自身无生产调用方"。解锁 = 下一席(持 `apps/cli/src/commands/**` 归属)在 skills 命令里把清单那一支改成 `readSkillCatalog({ cwd, repoRoot })` 并透出 `state`;本席边界禁改 commands/**,故不代动。注意 `Skill` 无 `body` 缓存 —— 正文那一支必须继续走 `loadSkills`,否则会把清单缓存说成正文缓存。
2. **watch 驱动的失效未接**:信封已带 `watch{dirs,files}` 输入面,但消费它的那一端仍默认关(`config/defaults.ts:44 fsWatcher.enabled=false`)。解锁 = fs-watcher 转正或由 guardian 巡检轮按 30 分钟档派发重扫(判机器状态 ⇒ 按 §12e 不得挂提交链)。
3. **`MarketplaceIndex` 仍无 TTL/etag/watch 元数据**(现场读数已登记):把市场索引也纳入同一信封是同一族的下一格。解锁 = 该文件归属席同意在 `marketplace.ts` 引 `CatalogCacheEnvelope<…>`(本票明令不得改其既有判据)。
4. **行数**:schema 276 行(含 4 行水印),超 §3 的"<250"。该档取"页面"义,纯判据模块按本仓先例(`plugins/cache.ts` 1471 行)保留立因注释;若主席要硬收 250,唯一无损出路是把 17 行对侧取证头注迁进证据文档并留指针 —— 本席未擅自执行。
5. **判据面未动**(按边界):若要把"shared 判据文件零 node: 内建"从测试形状锁升成仓门,需主席带 `immutable-exempt:` trailer 落 `scripts/**`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
