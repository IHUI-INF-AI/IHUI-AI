<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S1 实施 — #9 内置资源装机策略 + 解压配额(goal-b49,复现 + 超越)

## 1. 现场读数

- 开工 HEAD(现读):`e557c22648652636498e67f726fe74de1f46291f`;收尾 HEAD(现读,他席已落两枚):`15f1acea0ce2b24aff3debc90a7ea30eb46318f7` —— 本席产出现在全在**工作树未提交**状态(边界令:禁 commit/push,交主席带 trailer 落)。
- 本席产出面 `git status --porcelain`:`M apps/cli/src/plugins/installer.ts` / `?? install-policy.ts` / `?? archive-quota.ts` / `?? tests/install-policy.test.ts`。
- 锚点更正已按主席现读执行:`apps/cli/src/lib/registry/` 不存在,真同层 `apps/cli/src/plugins/`(cache/installer/marketplace/update-plan/path-safety)⇒ 落点改该层。**表里那格路径失效,别再照抄。**
- 对方 manifest 复读(只读配置文件,未重跑 REA):`G:/Qoder CN/.qoder-versions/0.5.3/resources/bundled-resources/manifest.json` 5,707 B,`schemaVersion:1`、`definitionSha256`、`target{platform,architecture}`、`resources[3]`;首枚 = `qoder-cn-context-plugin` / `version 1.0.91.b22f2d0a` / `revision 2026102902` / `install{folderName,pluginId,presence:"ensure-minimum",defaultEnabled,userVisible}` / `archive{path,size,sha256,root,maxEntries:97,maxExpandedBytes:25864942}` / `files[14]`(逐文件 `{path,size,sha256}`)。
- 他席在飞(本席未碰,证据):`apps/cli/src/checkpoints/index.ts`(M,+2 未跟踪)、`apps/cli/src/skills/packaging/index.ts`(索引面已删)⇒ `skill-package.ts` 报 7 条 TS2307/TS7006/TS18046(**不代修**)。

## 2. 落了什么

- **新增 `apps/cli/src/plugins/install-policy.ts`(249 行,纯判据,零 fs/path/平台 API,输入含"当下时刻"全部注入)**:`ensure-minimum` 三态 `installed | already-satisfied | unjudged`。判序写死在代码里:① 结构维(清单取不到 / 缺 id / presence 未声明或形态不认)② 到期维(读不出 / 无 now / 已到期)③ 不降级维(revision 或 version 任一"已装更高"⇒ 终局)④ 最低版本维("更旧"⇒ 要装;两维皆不可比 ⇒ unjudged)⑤ 摘要维(清单声明逐文件 sha256:缺文件/不符⇒装;算不出⇒unjudged 并点名)。每格都回 `reasons[]` + `missingFiles/mismatchedFiles/unjudgedFiles`,**"没判"从不写成"判过"**(§0.3)。版本比较只认形状读得出的(`compareVersionStrings`,pre-release 不同形 ⇒ 判不出,不猜序)。
- **新增 `apps/cli/src/plugins/archive-quota.ts`(138 行,纯判据)**:`maxEntries` / `maxExpandedBytes` 双上限 ⇒ `within | exceeded | unjudged`;`report` 恒同场并列实测数与上限数(`解压配额 条目 98 / 上限 97 · 展开字节 … ⇒ 超限(entries)`),量不出显式写 `量不出` 不补 0;`quotaAllowsLanding()` 只认 `within`。默认档 `INSTALL_COPY_QUOTA`(20,000 / 512 MiB)数值锚 = 既有 `DIGEST_LIMITS`(2000 / 128 MiB),不变量:**可放行落位 ⊇ 可被摘要台账证到**。
- **接线(选 `installer.ts`,不选 `registry-install.ts`;后者只把 install 交给服务端 `RegistryClient.install()`,本地既无展开树也无装机现状 ⇒ 两把尺子在那条路径结构上无从判、也不可达;`installer.ts` 的 local 腿由 `commands/plugin-marketplace.ts:21` 的 `/plugin install` 走到,且同一处同时握着"清单最低版本"与"已装现状"两侧)**:
  1. `installLocal` 的"已装短路"改由 `decideInstallPolicy` 裁:仅 `already-satisfied` 才允许跳过;`installed` 走真实落位;`unjudged` **不跳过**(不凭没判出来的东西免做工)。顺带根治旧缺陷:源目录就地升级后再装一次曾被读成"已装过"(F2 用例钉住);`InstallOutcome` 增可选 `policy` 携结论。
  2. `installFromDirectory`(local + git:url 两条腿共用的唯一咽喉)首行加 `guardInstallCopyQuota(sourceDir)`,**排在取消检查与 `prepareStagingDirectory` 之前** ⇒ 拒时 destDir/staging/归档/registry 一个都不产生;新增 `PluginArchiveQuotaError`(带结构化 `decision`)与不跟随链接的 `measureExpandedTree`(源根例外用 `statSync`,树内一律不解析,AGENTS §26)。
  3. 配额覆盖档 `IHUI_INSTALL_COPY_QUOTA="<条目>:<字节>"`,与本层既有注入点同族(`IHUI_PLUGIN_INTEGRITY_GATE`/`IHUI_MOCK_GIT_CLONE_SRC`),形态读不出回落默认档且不谎报"已收紧"。
- **超越轴已做到(第一条)**:对方只有装机策略、**无到期形态**;我方 `expires` 已进判序②并成正反三例(已到期 ⇒ `unjudged` 点名"回到待裁队列,不静默放行";未到期 ⇒ 照常判;声明了却不给 `now` ⇒ 判不了)。生产侧暂无清单生产者,故到期目前是判据+测试在场、装机现场不触发(见未竟 2)。
- **未碰**:`PROJECT_PLAN.md`/`AGENTS.md`/`scripts/**`/`docs/benchmark-evidence/**`/`packages/types/**`/`loader.ts`/`checkpoints/**`/`server|startup|sandbox`/`command-policy`/`danger-gate*`/`i18n`/`api`/`ai-service`/`shared`;未新增 npm 依赖;无 `any`;未动 git 索引;未 commit/push。

## 3. 验证末行现读(本席自跑)

- `npx vitest run tests/install-policy.test.ts` → `Test Files  1 passed (1)` / `Tests  35 passed (35)`(判据侧 A 清单缺失 4 + B revision/不降级 5 + C 逐文件 sha256 6 + D 到期 4 = 19;配额侧 E 7;生产入口 F 4;次序与拒绝 G 5)
- `npx vitest run tests/plugin-install-atomicity.test.ts tests/plugin-registry-upsert.test.ts tests/plugin-marketplace.test.ts tests/plugin-installer-symlink-errno.test.ts tests/plugin-cache-copy-symlink.test.ts tests/plugins.test.ts` → `Test Files  6 passed (6)` / `Tests  146 passed (146)`;另两轮扩面(12 枚 plugin-cache-*/update-plan/git-*/clone-retry/integration → `202 passed`;7 枚含 update-plan+integration → `73 passed`)全绿,过程中揪出并修掉本席一处真缺陷(源根本身是基准目录内链接时,配额尺误判"量不出"⇒ 把 `measureExpandedTree` 的取根改为 `statSync`,反向对照用例 `plugin-installer-symlink-errno` 由红转绿)。
- `npx tsc --noEmit -p apps/cli/tsconfig.json` → 残错仅 7 条,全在 `apps/cli/src/commands/skill-package.ts`(他席索引面删除 `../skills/packaging/index.js` 造成);本席四枚文件 **0 错**。
- `npx eslint`(四枚)→ 无输出(0 error;先前 6 条 `eqeqeq` 已改显式比较);`npx prettier --check` → `All matched files use Prettier code style!`
- `node scripts/watermark.mjs verify` 四枚 → `覆盖 4/4 … 残迹 0 … 载荷损坏 0 … 纳入口径的文件均已携带完整溯源水印。`(新建三枚 inject 于 prettier 之后,复核 skip-done = 载荷完整)
- `node scripts/scan-hardcoded-zh.mjs`(守门 70,全量档现读)→ `installer.ts 17 处`,与 HEAD 面 17 处逐字相等 ⇒ **本次该文件增量 0**;两枚新文件走**可见声明式豁免**(文件头 40 行内 `i18n-content-exempt-file: <理由> until 2027-05-04`),已列进"内容文案豁免(声明式,不计红)"段供人工复核 ⇒ 交主席时这一格不会新增红。
- 关键断言(非读代码):`G1` 用例走生产入口 `installPlugin`,拒装后当场断言 `getInstalledPluginsDir()` 与 `getRegistryPath()` **均不存在**、源目录三条内容原位;`G5` 形状锁另钉 `guardInstallCopyQuota` 的调用位置先于 `prepareStagingDirectory`/`copyDirRecursive`/`persistInstallAuthority`。`G2` 是同夹具放宽上限的阳性对照(证明 G1 的红来自配额判据而非夹具坏)。

## 4. 未竟(逐条带解锁条件)

1. **git:url 腿未接 `ensure-minimum`**(local 腿已接)。解锁:先量 `plugins-clone-retry` / `plugin-git-*` / `atomicity` 里 mock-clone 那几枚短路期望是否会因判据从"记录在否"变成"版本比过"而翻面;量完再同型接一处,判据不重写。
2. **到期维无生产侧生产者**:装机现场无人写 `expires`/逐文件期望摘要,故摘要维与到期维当前只在判据+测试在场。解锁:主席定内置资源清单落点(仓内单源 json/jsonl)——`scripts/**` 与判据面归主席带 trailer,本席不得开这一格。
3. **`apps/cli/src/skills/packaging/tar.ts` 尚无配额腿**(现读该文件无 `maxEntries`/`maxExpandedBytes` 等价物,解压面仍无上限)。解锁:确认该文件归属席位不在飞后,由它 import `archive-quota.ts`(单源,不得在 tar 侧另写第二份上限,§0.6)。
4. **未提交/未推送**(边界令)。解锁:主席以 `feat(cli):` 落这四枚文件;提交时守门 70/108 读到的豁免声明与增量 0 已在 §3 现读,不需要额外跳门变量。
5. **未跑全量** `pnpm turbo build typecheck lint test` / `pnpm check:all`。解锁:多席共用一棵工作树,S3 三枚(`checkpoints/index.ts` + `snapshot-gc.ts` + `snapshot-series.ts`)与 S2 词表仍在飞(收尾现读:`checkpoints/index.ts` 已由红转无错,但仍未提交),全量档结论不属本席、须在收敛后由主席跑一遍。
6. `InstallOutcome.policy` 目前只到调用方(命令层 `data` 字段),`plugin-marketplace.ts` 未打印。解锁:若要让操作者看见 `unjudged` 点名,需改命令层文案与 i18n 五语言同批(§19),不在本票最小改动射程。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
