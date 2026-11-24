<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# B2 落地:drizzle journal 双向对账尺(只读)

- HEAD:4fe208a71c20d5b3fcca68d40daa7d7a2185bee4(开工时现读)
- 计划动作文件:
  - 新建 `scripts/check-drizzle-journal-sync.mjs`(三态 ok/drift/unjudged,--self-test,isDirectRun 守卫)
  - 新建 `scripts/tests/check-drizzle-journal-sync.test.mjs`(import 源脚本 `__test__`,§22c)
  - 修改 `scripts/git-guardian.mjs`(新增一个只读巡检轮,warn-only,不挂提交链)
- 禁止:commit/push/PROJECT_PLAN.md/AGENTS.md/迁移 sql 正文

## 现场读数(全部现算,非抄票面)
- 工作树面:`_journal.json` entries=364;目录 `*.sql`=366 ⇒ 两枚"文件有/journal 无"
  (`0364_app_versions_store_channel`、`20261104120000_agent_team_collab`),与票面一致。
- **但三面现读发现**:HEAD 面与索引面 journal 均为 **366 条且与 .sql 双向差集为 0**
  (`git show HEAD:…` / `git show :…`);工作树副本 = 某祖先版本(少了 3 条 entries,含上述两枚)
  ⇒ 这是 AGENTS §5b「幻影漂移(索引==HEAD ∧ 工作区==祖先版本)」形态,`heal-worktree-tracked`
  ② 的射程(由守护自行对齐,本席不代裁、未动该文件一字)。
- 结论口径:本尺读盘面 ⇒ 现算报 drift 并点名两枚;他席工作区副本被自愈对齐后本尺应翻 ok(state 单行变化)。
  "按链新建库缺表"的崩面在**带脏工作区跑 migrate 的场景**才成立;HEAD 面链条本身在册。
- journal 内 tag 重号:0;idx 连续无断档(三面同)。号段双形态混用(`0000_*` 与 `20261104120000_*`)按 tag 逐字对账,同等对待。

## 落了什么
1. **`scripts/check-drizzle-journal-sync.mjs`**(新建,已 inject 水印并 verify 通过):
   - 判据四维:两向差集逐条点名 + journal `tag` 重号 + `idx` 断档/非整数;
   - 三态硬闸:journal 读不到/坏 JSON/`entries` 非数组、目录枚举失败、**entries=0 或 .sql=0** ⇒
     `Unjudged`/`unjudged` 点名原因 exit 2,绝不记绿也绝不冒红(§0.3);
   - 退出码与 `check-service-inventory` 同形:0=ok / 1=drift / 2=unjudged(含自检失败);
   - 结论行单机读口:`DRIZZLE-JOURNAL state=… entries=… sqlFiles=… fileOnly=… journalOnly=… problems=… unjudgedReasons=…`;
   - `--self-test` 15 例(P1-P9 纯判据枝 + I1-I5 mkScratch 盘面夹具枝 + X1 结论行形状锁),夹具不落 os.tmpdir/仓库树;
   - §22d `isDirectRun` 顶层守卫(`pathToFileURL`,禁手拼 file:///);
   - 取材面声明:读**工作树盘面字节**——`migrate()` 消费的就是盘上文件;本尺刻意不挂提交链(§12e),
     故 HEAD/索引面纪律不适用,头注已写明,无 --staged 档。
2. **`scripts/git-guardian.mjs`**(修改,只加一轮,未动任何既有轮的判据与节流):
   - 新增 `auditDrizzleJournalSync()`:30min 节流(与 `auditServiceInventory` 同族 + env 覆盖
     `IHUI_DRIZZLE_JOURNAL_INTERVAL_MS`),双挂点(main 单轮链 + daemon tick 链),派生带
     `windowsHide/stdio/timeout`(§5b/§12g),吃尺子 `--json` 的 problems 打点名明细;
   - **warn-only**:drift/unjudged 只写日志与状态件 `.ihui-agent/state/drizzle-journal-sync-last.json`,
     不发人通道邮件——存量 2 枚孤儿未归零前发信即恒喊(§12e/§5e-1),头注写明归零那枚提交同批再接 notify;
   - 函数已加入文件末 export 台账(镜像按名 import,§22c)。
3. **`scripts/tests/check-drizzle-journal-sync.test.mjs`**(新建,已 inject 水印):
   - 11 例(node:test):T1 孤儿⇒drift 点名 / T2 悬空⇒drift 点名 / T3 tag 重号检出 /
     T4 idx 断档检出 / T5 journal 空⇒unjudged 不记绿 / T6 .sql=0⇒unjudged / T7 对齐⇒ok+结论行单行 /
     T8 journal 缺失/坏 JSON⇒Unjudged / T9 盘面夹具真差集⇒drift / T10 源 selfTest 全绿(只调用不复制) /
     T0 形状锁(__test__ 符号齐备);判据全部 import 源 `__test__`,测试内零复制(§22c)。

## 验证末行现读
- `node scripts/check-drizzle-journal-sync.mjs --self-test` → `[check-drizzle-journal-sync.mjs] self-test: pass 15 / fail 0`(RC=0)
- `node scripts/check-drizzle-journal-sync.mjs` → `DRIZZLE-JOURNAL state=drift entries=364 sqlFiles=366 fileOnly=2 journalOnly=0 problems=2 unjudgedReasons=0`(RC=1,点名两枚孤儿,与票面一致)
- `node --test scripts/tests/check-drizzle-journal-sync.test.mjs` → `ℹ pass 11 ℹ fail 0`
- `node scripts/git-guardian.mjs --status` → 正常出 JSON,RC=0(守护未崩);
  冒烟 `auditDrizzleJournalSync()` 首轮 `{"ran":true,"judged":true,"state":"drift"}` 带两枚点名日志行,
  次轮 `{"ran":false,"why":"未到节流窗口"}`(节流生效)。
- `node scripts/watermark.mjs verify <两枚新文件>` → 覆盖 2/2,残迹 0;`--check` 面 git-guardian 水印完好。

## 未竟(带解锁条件)
- **工作树幻影副本待自愈对齐**(归守护 `heal-worktree-tracked` ②,本席不代裁):对齐前本尺现读恒报
  drift(两枚点名);对齐后 state=ok。解锁核验 = 复跑 `node scripts/check-drizzle-journal-sync.mjs` 读末行。
  若主席复核后认定 HEAD 面才是唯一口径,把尺子默认面改 HEAD 是一枚一行改动(`readMigrationState` 已参数化
  `repoRoot/dirRel`,面切换留给主席那批落地,本席不越权)。
- 票面"存量孤儿清偿"一格按三面读数修正:**HEAD/索引面本无孤儿**,不存在"把两枚登记进 journal"的欠账;
  巡检轮 notify 腿的接入时机改由"工作树面连续 N 轮 drift(排除幻影态)"或主席裁决决定(头注已留位置)。
- 主席落地三件时须带 `immutable-exempt:` trailer(受保护面 `scripts/**`),并补 AGENTS/README R4 点名。
- 顺带观察(不在本票射程):`check-root-guard-manifest-sync.mjs` 现读报 git-guardian 清单绑旧 sha
  (head 面存量漂移,warn 不拦,RC=0)——出路由机主 `root-guard.mjs --seal`,本席未动。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
