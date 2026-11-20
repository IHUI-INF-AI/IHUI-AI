<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R11–R133 编号账 —— 每个号落在哪、为什么有的号没有报告

> 这份索引回答一个具体问题:**本目录"缺号"是不是缺件?** 不是。每一号都落在五种状态之一,
> 逐号给了可复核定位(报告文件名,或交付提交的 11 位 sha 与标题)。
> 表由 `gen_rounds_index.py` 生成,生成器自带状态断言:先用第五节的同一批命令复算一遍,
> 任一行的状态与复算结果不一致就整体生成失败 —— 所以这张表不是手抄的。

## 一、五种状态

| 状态 | 判据 | 本轮实测 |
|---|---|---|
| **有报告** | 目录里有 `R<n>-*.md` | 87 个号 |
| **仅代码+账本** | 无独立报告,但有标题写明该轮交付、且那次提交真的改动了 `apps/ai-service/app/core/` 或本目录 | 18 个号 |
| **他线同名号** | 有标题命中该号,但讲的是别的任务线(迁移轮次/安全强化/i18n 等),改动不落本链 | 2 个号 |
| **仅正文提及** | 标题无命中,只有某条提交的正文顺带提到,不构成交付 | 1 个号 |
| **未占用** | 标题与正文都零命中(号带边界) ⇒ 这个号从未被任何任务线用过 | 15 个号 |

**"仅代码+账本"不是欠账。** 这条链的产物本来就分两半:报告记"发现了什么",模块与用例记
"复现并钉住了什么",账本(`apps/ai-service/app/core/codex_coverage_ledger.py`)记"这条轴算进哪一档"。
R115–R128 十四轮即此型 —— 把四类技能(documents / presentations / spreadsheets / template-creator)
的 36 个工具、33 篇自述、四道请求门与一份导出桥契约读成可执行判据,交付形态是模块 + 测试 + 账本条目。

## 二、逐号对照(R11–R133)

| 号 | 定位(报告文件 / 交付提交) | 状态 |
|---|---|---|
| R11 | `R11-sandbox-setup.md` | 有报告 |
| R12 | `67055079750` docs(plan): 安全强化 goal R12 结账注记 —— 四枚提交已入库且 origin 同步(4b32f | 他线同名号 |
| R13 | `R13-codex-26.1111-agent-loop-turn-orchestration.md` | 有报告 |
| R14 | `R14-codex-reverse-integration-matrix.md` | 有报告 |
| R15 | `R15-codex-26.1111-turn-phase-advance.md` | 有报告 |
| R16 | `R16-codex-26.1111-hook-event-exit-contract.md` | 有报告 |
| R17 | `R17-codex-26.1111-multi-agent-config-spawn-gate.md` | 有报告 |
| R18 | `R18-codex-26.1111-turn-error-kind.md` | 有报告 |
| R19 | `R19-codex-26.1111-turn-suspension-state-machine.md` | 有报告 |
| R20 | `R20-codex-26.1111-resume-kind-closed-set.md` | 有报告 |
| R21 | `R21-codex-26.1111-resume-metadata-materialization.md` | 有报告 |
| R22 | `R22-codex-26.1111-hook-event-ordering-topology.md` | 有报告 |
| R23 | `R23-codex-26.1111-fork-dispatch-semantics.md` | 有报告 |
| R24 | — | 未占用 |
| R25 | `R25-codex-26.1111-tool-result-provenance.md` | 有报告 |
| R26 | `R26-codex-26.1111-model-reroute-reason.md` | 有报告 |
| R27 | `R27-codex-26.1111-reasoning-channel-phase.md` | 有报告 |
| R28 | `R28-codex-26.1111-turn-error-code-taxonomy.md` | 有报告 |
| R29 | `R29-codex-26.1111-sandbox-permission-request.md` | 有报告 |
| R30 | `R30-codex-26.1111-guardian-assessment-aborted.md` | 有报告 |
| R31 | `R31-codex-26.1111-auto-compact-scope-and-post-turn-threshold.md` | 有报告 |
| R32 | `R32-codex-26.1111-a2a-task-state.md` | 有报告 |
| R33 | `R33-codex-26.1111-mcp-elicit-result-action.md` | 有报告 |
| R34 | `e45a3a47b45` chore: M-9 noise-rules补建 + React19类型修复 + 临时文件清理 + R34报告更新 | 他线同名号 |
| R35 | `R35-codex-26.1111-agent-operation-status.md` | 有报告 |
| R36 | — | 未占用 |
| R37 | — | 未占用 |
| R38 | — | 未占用 |
| R39 | — | 未占用 |
| R40 | — | 未占用 |
| R41 | — | 未占用 |
| R42 | — | 未占用 |
| R43 | — | 未占用 |
| R44 | — | 未占用 |
| R45 | — | 未占用 |
| R46 | — | 未占用 |
| R47 | — | 未占用 |
| R48 | `8aa172a6c7a`(正文顺带引用,无交付) | 仅正文提及 |
| R49 | — | 未占用 |
| R50 | `R50-codex-26.1111-collab-lifecycle-events.md` | 有报告 |
| R51 | `R51-codex-26.1111-turn-steerability.md` | 有报告 |
| R52 | `R52-codex-26.1111-steer-rollback-causality-correction.md` | 有报告 |
| R53 | `R53-codex-26.1111-steer-rollback-disasm-confirmation.md` | 有报告 |
| R54 | `R54-native-xref-probe-tool.md` | 有报告 |
| R55 | — | 未占用 |
| R56 | `R56-R92-final-index.md` | 有报告 |
| R57 | `R57-codex-26.1111-ipc-config-struct-variants.md` | 有报告 |
| R58 | `R58-whole-struct-variant-family-sweep.md` | 有报告 |
| R59 | `R59-protocol-surface-large-method-manifests.md` | 有报告 |
| R60 | `R60-medium-manifest-families-sweep.md` | 有报告 |
| R61 | `R61-n3-manifest-families-sweep.md` | 有报告 |
| R62 | `R62-struct-arity-contract.md` | 有报告 |
| R63 | `R63-hook-command-json-schema-contract.md` | 有报告 |
| R64 | `R64-hook-field-type-and-definition-contract.md` | 有报告 |
| R65 | `R65-non-hook-struct-field-name-contract.md` | 有报告 |
| R66 | `R66-struct-contract-drift-and-attribution-negative.md` | 有报告 |
| R67 | `R67-attribution-frontier-and-string-method-exhaustion.md` | 有报告 |
| R68 | `R68-fat-pointer-field-arrays.md` | 有报告 |
| R69 | `R69-visitor-key-evidence-and-frontier-gap.md` | 有报告 |
| R70 | `R70-fragment-tables-and-last-name-candidate.md` | 有报告 |
| R71 | `R71-disassembly-order-failure-and-cwd-falsified.md` | 有报告 |
| R72 | `R72-declaration-order-from-debug-impl.md` | 有报告 |
| R73 | `R73-pool-residue-new-field-name.md` | 有报告 |
| R74 | `R74-pool-a-segmentation-candidates.md` | 有报告 |
| R75 | `R75-strict-structure-reconstruction.md` | 有报告 |
| R76 | `R76-pool-order-independent-of-declaration.md` | 有报告 |
| R77 | `R77-serde-struct-catalog.md` | 有报告 |
| R78 | `R78-post-template-pool-nearly-empty.md` | 有报告 |
| R79 | `R79-fields-array-not-adjacent-to-template.md` | 有报告 |
| R80 | `R80-fields-record-arrays.md` | 有报告 |
| R81 | `R81-partial-name-claims.md` | 有报告 |
| R82 | `R82-address-level-attribution-and-misfit-rate.md` | 有报告 |
| R83 | `R83-window-claims-and-cross-source-attestation.md` | 有报告 |
| R84 | `R84-hook-definitions-crosschecked-in-binary.md` | 有报告 |
| R85 | `R85-inline-segments-lack-field-tables.md` | 有报告 |
| R86 | `R86-coverage-gap-ledger-and-pool-ceiling.md` | 有报告 |
| R87 | `R87-R88-enum-arrays-and-code-route-closed.md` | 有报告 |
| R88 | `88dd6577aca` docs(engineering): R56-R88 codex 逆向链终局报告(三路线闭合/天花板914/A1-A | 仅代码+账本 |
| R89 | `R89-R90-backlog-closure-and-runtime-check.md` | 有报告 |
| R90 | `527e6ac348d` feat(ai-service): R89 待办账收口(A2零残片/A7 987结构/A8 60空白族/A11a遥测 | 仅代码+账本 |
| R91 | `R91-backlog-final-and-ghidra-trial.md` | 有报告 |
| R92 | `f628359625f` feat(ai-service): R92 A4结构性否证(长度1的run=0,单变体枚举不可独立认证)+R56-R | 仅代码+账本 |
| R93 | `R93-runtime-observability-objects.md` | 有报告 |
| R94 | `R94-plugin-and-hook-config.md` | 有报告 |
| R95 | `R95-skill-engines-and-gates.md` | 有报告 |
| R96 | `R96-license-audit.md` | 有报告 |
| R97 | `R97-gate-behavior.md` | 有报告 |
| R98 | `R98-content-findings.md` | 有报告 |
| R99 | `R99-table-and-chart.md` | 有报告 |
| R100 | `R100-chart-workbook-verification.md` | 有报告 |
| R101 | `R101-source-figure-and-receipt.md` | 有报告 |
| R102 | `R102-source-figure-exception-granted.md` | 有报告 |
| R103 | `R103-chart-target-application.md` | 有报告 |
| R104 | `R104-programme-inventory.md` | 有报告 |
| R105 | `R105-hook-config-runtime-shape.md` | 有报告 |
| R106 | `R106-provider-wire-protocol.md` | 有报告 |
| R107 | `R107-literal-chart-materialize.md` | 有报告 |
| R108 | `R108-render-toolchain.md` | 有报告 |
| R109 | `R109-overflow-checker-fails.md` | 有报告 |
| R110 | `R110-overflow-detector-rebuilt.md` | 有报告 |
| R111 | `R111-rotation-aware-overflow.md` | 有报告 |
| R112 | `R112-documents-toolkit.md` | 有报告 |
| R113 | `45fccada5ad` feat(ai-service): R113 覆盖率尺子 —— 把"百分百"变成可判定的数 | 仅代码+账本 |
| R114 | `R114-ledger-correction.md` | 有报告 |
| R115 | `1e306ad9dfc` feat(ai-service): R115 documents 的 33 篇自述 —— 三种"看起来有信息其实没有 | 仅代码+账本 |
| R116 | `da54e8d0c43` feat(ai-service): R116 风格表与引擎文档 —— 两份风格指南是同一个文件 | 仅代码+账本 |
| R117 | `18e4b2aaac2` feat(ai-service): R117 把文风准则做成能跑的东西 —— 24 条单测全绿，真跑一次就现原形 | 仅代码+账本 |
| R118 | `e8ae25b758b` feat(ai-service): R118 真的把 documents 的 36 个工具跑起来 —— 四种调用约定 | 仅代码+账本 |
| R119 | `da59687a11b` feat(ai-service): R119 documents 最后 8 个工具全跑通 —— 全域 36/36，并 | 仅代码+账本 |
| R120 | `f7f95b215fe` chore(reverse): R120 execute the .mjs helper layer, 83.0%  | 仅代码+账本 |
| R121 | `1fba5e218a7` feat(reverse): R121 read the presentation finaliser, 86.8% | 仅代码+账本 |
| R122 | `fb920bdfc24` feat(reverse): R122 the report-shape gate, 88.0% -> 88.7% | 仅代码+账本 |
| R123 | `e98b15fed53` feat(reverse): R123 the template creator request gate, 88. | 仅代码+账本 |
| R124 | `f010be92ccf` feat(reverse): R124 and R125 re-landed a second time after | 仅代码+账本 |
| R125 | `f010be92ccf` feat(reverse): R124 and R125 re-landed a second time after | 仅代码+账本 |
| R126 | `4dbfad506f2` feat(reverse): R126 source-level cheat detection in check_ | 仅代码+账本 |
| R127 | `b749a4a7689` fix(reverse): R127 type the entry list so mypy strict pass | 仅代码+账本 |
| R128 | `1584415faab` feat(reverse): R128 Google Workspace export bridge contrac | 仅代码+账本 |
| R129 | `R129-three-skill-texts-two-faces.md` | 有报告 |
| R130 | `R130-app-server-schema-generator.md` | 有报告 |
| R131 | `R131-local-store-six-sqlite.md` | 有报告 |
| R132 | `R132-field-level-contracts.md` | 有报告 |
| R133 | `R133-prose-behaviour-rules.md` | 有报告 |

## 三、需要点名的几个号

- **R113**:有交付提交(`45fccada5ad`,"覆盖率尺子"),但**故意不留独立报告** —— 它的结论被下一轮
  R114 直接推翻并更正("尺子量错了方向"),正本只有 `R114-ledger-correction.md`,R113 的数不再作结论引用。
- **R92**:报告载体是 `R56-R92-final-index.md`(终章索引),不另立单轮文件。
- **他线同名号**:R12、R34 —— 标题里出现过这个号,但属别的任务线,
  本目录没有对应报告不是缺件。
- **仅正文提及**:R48。
- **未占用**:R24、R36、R37、R38、R39、R40、R41、R42、R43、R44、R45、R46、R47、R49、R55。

## 四、`semantic_tier_bounded = False` 不是待办

覆盖账本 `report()` 里的 `semantic_tier_bounded: False` 是**结论,不是缺口**。模块开头三档写得很直白:
二进制语义属于 "discovered but unbounded" —— 已发现的每个面都覆盖了,但**还剩多少未发现不可知**;
拿未知当分母算百分比就是编数。所以这一档只报计数(`semantic_faces` / `semantic_faces_covered`)并明说上限。
把它改成 `True` 才是造假。

## 五、核验命令(三条,每条都能原地复算)

```bash
# 1) 哪些号有报告(数字去重后排序)
ls docs/engineering/round11-reverse/R[0-9]*.md | sed -E 's#.*/R([0-9]+)-.*#\1#' | sort -n -u | tr '\n' ' '

# 2) 某个号的全文命中(把 115 换成要查的号;-E + 号边界,避免 R48 命中 R481)
git log --all -E --grep='R115([^0-9]|$)' --format='%h %ad %s' --date=short

# 3) 表里所有"未占用"必须全零(15 个号一次跑完)
for n in 24 36 37 38 39 40 41 42 43 44 45 46 47 49 55; do
  printf 'R%s hits=%s\n' "$n" "$(git log --all -E --grep="R${n}([^0-9]|$)" --oneline | wc -l)"
done
```

本机只有 PowerShell 7(无 bash),同三条的 PowerShell 形态(实测可跑):

```powershell
# 1) 哪些号有报告
Get-ChildItem docs\engineering\round11-reverse -Filter 'R[0-9]*.md' |
  ForEach-Object { if ($_.Name -match '^R(\d+)-') { [int]$Matches[1] } } |
  Sort-Object -Unique

# 2) 某个号的全文命中
git log --all -E --grep='R115([^0-9]|$)' --format='%h %ad %s' --date=short

# 3) 所有"未占用"号必须全零
24,36,37,38,39,40,41,42,43,44,45,46,47,49,55 | ForEach-Object {
  "R$_ hits=" + (git log --all -E --grep="R$_([^0-9]|$)" --oneline | Measure-Object).Count
}
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
