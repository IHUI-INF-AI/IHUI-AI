<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# C 席 · 已装插件逐文件完整性台账 + 只读对账门 — 进度心跳

- 状态:**已完工(未提交,按票面纪律交主席落地)**@2026-11-01
- 当前 HEAD(现读):`e28e5f6e4b0340cb181a741a55fcfb6025c01d8a`
- 注:决策册 B 席成文时 HEAD 为 `eb1dad8a…`,本席开工时已推进,以本行现读值为准。

## 现状格复核结果(逐条)

| 票面断言 | 复核 | 差异 |
|---|---|---|
| `apps/cli/src/plugins/` 11 模块清单 | **一致** | cache/git-runner/index/installer/loader/marketplace/path-safety/paths/registry/types/url-shape |
| `installer.ts:497` 构造 `InstallRecord` | **一致**(现读已挪到 :577) | 本席改动带行的插入使行号后移,内容同一处 |
| `installer.ts:503` 调 `persistInstallAuthority(reg, record, swap)` | **一致**(现读 :585) | 同上 |
| `installer.ts:625` `upsertInstallRecord` | **一致**(现读 :706) | 同上 |
| `installRecordKey(record) => record.name`(:602) | **一致**(现读 :683) | 同上 |
| `installer.ts:595` 注释点名 G-808 病灶 | **一致**(现读 :676) | 「写侧旧实现 `reg.records.push` 无条件追加,读侧按 name 取首行」 |
| zip-bomb 不适用(取源 git clone) | **一致** | 无解包面;门体内把上限维交给既有 `judge()` 的正无穷,不另写一份 |
| **「types.ts —— InstallRecord 增字段」** | **不一致** | `InstallRecord` 不住 types.ts,实际在 **`installer.ts:100`**(types.ts 只有 PluginManifest/PluginDefinition/诊断族)。按「以实际代码为准」把 `fileDigests?: InstallFileDigest[]` 加在 installer.ts 的接口上;**types.ts 一字未改**;installer.ts 本就在允许清单内。 |

## 落地内容

- `apps/cli/src/plugins/installer.ts`:`InstallFileDigest` 接口 + `InstallRecord.fileDigests?`(可选,存量无需迁移)+ `collectInstallFileDigests()`(模块内唯一写侧采集实现,永不抛,采不到/超限/撞链接 ⇒ 整块不写)+ `installFromDirectory` 落位后、权威落盘前把摘要塞进 record。**未碰** `installRecordKey` / `upsertInstallRecord` / `persistInstallAuthority` 任何判据。
- `scripts/check-plugin-manifest-integrity.mjs`(新增,门 277 门体):三态 `ok/drift/unjudged`,drift 三子类(mismatch/missing/unlisted)分开点名不并桶;老记录落 `unjudged`+`pending`(既不 ok 也不 drift);不跟随 symlink/junction + realpath 归属双锁;只读、永不写盘(`--print-baseline` 只打 stdout);差值棘轮 `--baseline`(不给基线 ⇒ `new=null`,不拿 0 冒充"无新增");比对判据与 sha 取算复用 `check-installed-asset-catalog.mjs` 的 `judge`/`sha256Hex`(§0.6 零复算);`isDirectRun` + `pathToFileURL`(§22d)。自检 21 组。
- `scripts/tests/check-plugin-manifest-integrity.test.mjs`(新增,镜像测试):`import { __test__ }`,零判据复制;14 例。
- `scripts/guardian-runner.mjs`:注册 `id: '277'`,**mode: 'warn'**,stagedTriggers=`['apps/cli/src/plugins/']`,带 onFailHint。插前核验该文件工作树副本 == HEAD blob(`9e4724d9f790f573e09de348f889826f6e8b99a6`),未用 `gate-registry-insert.mjs`(它自带 CAS 落地=会提交,与本席"禁止 commit"冲突),改为手工尾部插入;`node --check` 过;门 89 自有解析器 `idsOfRegistry`/`findDuplicateIds`/`findMergedEntries` 对当台工作树实测:314 条、撞号 0、合并条目 0;`node scripts/guardian-runner.mjs --help` 现读 warn 列 30 项含 277(装车证明)。**⇒ 主席落地提交必须带 `immutable-exempt:` trailer。**
- `README.md`:「守门脚本点名索引」新增 `- 插件/装机面:` 一行(门 89 R4 文档面义务)。

## 验证(末行现读)

- `node scripts/check-plugin-manifest-integrity.mjs --self-test` ⇒ `[plugin-integrity] [self-test] 21/21 通过`
- `node --test scripts/tests/check-plugin-manifest-integrity.test.mjs` ⇒ `ℹ pass 14 / ℹ fail 0`
- `pnpm turbo typecheck --filter=ihui-cli` ⇒ `Tasks: 8 successful, 8 total`(票面写的 `@ihui/cli` 不存在,包名现读 `ihui-cli`)
- `node scripts/check-gate-wiring.mjs` ⇒ RC=1,**唯一红 = 存量他席门 `check-qoder-session-sync-task.mjs` 的 R4 未点名**(来源 ec88d0370f / 9da1df3ba6,与本批无关,本席未动);本席两道新件此刻不在 HEAD∪索引,门 89 候选集取 HEAD 面 ⇒ 要到主席 `git add` 同批落地那一次才被判到(三处接线已同批齐备)。
- 端到端(真写侧 + 真读侧):`npx tsx .ihui-agent/tmp/rea-goal-b44/C-debug/e2e-installer-ledger.mts` ⇒ 记录键 `…,transactionId,fileDigests`;原样一面 `ok=1`;篡改一枚 + 删一枚 + 塞一枚未登记 ⇒ `mismatch=1 missing=1 unlisted=1` 三类分开点名,RC=1。
- 水印:`node scripts/watermark.mjs verify <两个新文件>` ⇒ 覆盖 2/2,残迹 0,载荷损坏 0;`decode` 均解出完整载荷。prettier:三文件 `All matched files use Prettier code style!`(顺序 clean → write → inject)。

## 边界与未做

- 装机根里的 `<name>.staging-*` / `<name>.superseded-*` 不在本门射程(在途/已取代副本,归 cache 层处置)。
- 「目录里有未登记的插件目录而台账没有该记录」不判(本门判的是记录面,反向补记属另一条腿)。
- zip-bomb 维不适用(无解包面),没有为此造轮子。
- 老记录的台账补齐:靠重装(下一次覆盖安装自然写入摘要),本门不做自动重装。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
