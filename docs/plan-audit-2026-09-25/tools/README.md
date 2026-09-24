# tools/ 复跑说明

O60 / O60b 两轮的取证与验证脚本，**从仓库根目录跑**（相对路径按 cwd=根 写）。
留档理由：台账里多条"实测"结论必须能被后人复跑，而不是只能信我贴的那一行输出。

| 脚本 | 用途 | 记下的坑 |
| --- | --- | --- |
| `roster.mjs` / `split.mjs` / `tasks.mjs` | 从 PROJECT_PLAN 抽未认领票、切批、区分"真任务条目 vs 进度述评" | 行号随并发漂移，按编号定位；"无人认领 110" 不等于 110 项任务 |
| `twin-classify.mjs` / `mark-twins2.mjs` | 双态行分型 / 裸副本改指针行 | ① 复选框正则写成 `- \[ [x ] \]`（括号内两个空格）永不命中 → 差点把"双态 0 张"当事实；② 比"同文包含"必须先剥 `- [ ]` 前缀 → 15/15 全 skip，差点当成"台账又被改过" |
| `recheck.mjs` / `wiring.mjs` / `round2.mjs` / `probe.mjs` | 逐条复跑代理结论、列"零消费点"文件清单 | 编码类判定只认 `git grep -l <符号> HEAD` 的文件清单；`figma`/`automations` 这类词在营销页满天命中，不能当判据 |
| `attrib.mjs` / `attrib2.mjs` | 脏工作区归属识别（哪些文件是谁的产出） | 未跟踪新文件 `git diff` 看不见，必须读磁盘；`cat` 不在 Windows PATH 里 |
| `ab-gate90.mjs` | 守门 90 修正前后的镜像失败集合 A/B | 台账引用的就是它：证明"不新增红也不掩盖红" |
| `verify-tc.mjs` / `verify-tests.mjs` / `verify-gates.mjs` / `attest-B.mjs` | 六包 typecheck / vitest / 12 道门补跑 | `execFileSync('pnpm', …)` 本机静默失败(exit null)，pnpm 必须走 shell；node 脚本走 `process.execPath` |
| `d19-sim-parity.mjs` | D19 提交前复验：临时索引里造"代码+台账同票"看门 90 是否真判绿 | D19 目前**按住未提交**，这脚本就是它的复验入口 |
| `apply-d17-i18n.mjs` | D17 的 21 键 × 5 语载荷落进 web 语言包 | 内置"整篇重排即拒写"的格式护栏与五语对称校验；D17 同样**按住未提交**，这是它的解阻动作 |
