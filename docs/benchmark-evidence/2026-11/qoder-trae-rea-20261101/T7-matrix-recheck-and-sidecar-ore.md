<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T7 — 缺口矩阵复量（HEAD 面）+ Qoder 两枚 sidecar 新矿 + 内容寻址实测

> 席位：主席（goal 续轮，2026-11-01）。现读基线 `HEAD = e28e5f6e4b0340cb181a741a55fcfb6025c01d8a`，
> 取证时刻 `2026-10-31T16:52:36Z`。对照程序：`G:/Qoder CN`（`build-manifest.json` 现读
> `productVersion=0.5.1`、`electronVersion=43.1.1`、`buildNumber=84759508`、
> `buildTime=2026-10-30T05:45:18.550Z`）与 `C:/Users/Administrator/AppData/Local/Programs/Trae CN`。
> 结论三态沿用前册口径：**[观察]** = 给出文件 + 可复验命令；**[推断]** = 由观察合成；**[未知]** = 取不到。

## 1. 为什么必须复量：`T3-gap-matrix.md` 已在 14 小时内腐烂

上一轮把 27 条判成「已具备 12 / 实现了但没装车 8 / 结构性缺失 7」，并据此派单。本席开工先抽审，
**其中两条当场被现读推翻**，随后整册复量（复量件 `.ihui-agent/tmp/rea-goal-b44/B-matrix-recheck.md`，
取证面 = HEAD，0 命中命令均跑完未截断）：

| 编号 | 册称（02:03） | 现读（本席抽审，HEAD 面） | 判 |
| --- | --- | --- | --- |
| G-03 | `taskCreated`/`taskCompleted` 两档 hook 缺失 | `apps/cli/src/hooks/index.ts:157-160` 字段在册，且 `apps/cli/src/tools/background-registry.ts:486` 有 `fireTaskHook(...)`，`:650`/`:813`/`:814` 三处真派发（含配对不变式注记） | 已结清 |
| G-09 | Elicitation「零调用方实锤」 | `apps/ai-service/app/services/agent_loop_v2.py:5590-5598` 已 `from .mcp_server import _get_elicitation_service` 并把 `tool_call_elicitation_enabled=_elicitation_service is not None` 传真值 | 已结清 |
| G-14 | 记忆自动写回未装车 | `scripts/git-guardian.mjs:5354` 定义 `sweepLessonDraft`，`:10334` 与 `:10444` 两个执行体各挂一处（`if (!CHECK_ONLY)`） | 已结清 |
| G-07 | 跨会话通信未装车 | `apps/ai-service/app/services/mcp_server.py:9753` `_tool_send_team_message`、`:9779` `_tool_read_team_inbox` | 已结清 |
| G-18 | run manifest 结构性缺失 | `apps/cli/src/runs/manifest.ts` 在 HEAD，`argv/ppid/env_flags/cli_version` 等 8 个键命中 | 已结清 |
| G-22 | 插件默认态未登记 | `apps/cli/src/config/defaults.ts:50-51` 显式 `plugins:{enabled:false}` / `pluginMarketplace:{enabled:false}`，且 `:48` 注记写明判据 | 主腿已结清（`autoUpdate` 为次级残腿） |

**[观察]** 复量 11 条：**已结清 8 / 真缺口 1（G-21 半腿）/ 形态不适用 2（G-20、G-26）/ 未判定 0**。
⇒ 按 `T3` 原样再派一轮＝重复劳动。**[推断]** 腐烂原因是本仓多会话并行落地频率高于证据册的撰写节奏，
不是册子写错；所以口径应当是「册面读数有效期按小时计，引用前先复跑判据命令」，
而不是「把册子写得更详细」。前册头注已另起一行登记这条时效注记。

## 2. 新矿：Qoder 内置插件有三件，前两轮只破译了一件

`G:/Qoder CN/resources/bundled-resources/archives/` 现读三个归档目录：

| 目录 | 前两轮射程 | 内容 |
| --- | --- | --- |
| `qoder-cn-context-plugin/` | 已破译（`T6` §1，hooks 5 事件 8 钩子逐字规格） | MCP-as-engine 检索层 |
| `qoder-cn-computer-use/` | **零接触** | `QoderComputerUse.exe` × **两版并存**（2,519,024 B / 2,530,288 B，归档时间戳 2026-09-14 与 2026-10-12） |
| `qoder-office-xlsx/` | **零接触** | `xlsx-sidecar.exe` 9,147,400 B + `THIRD_PARTY_NOTICES.txt` + `resource.json` |

**[观察]** `resource.json` 自述 `target=x86_64-pc-windows-msvc`（Rust）、`platform=win32`、
`source.commit=84d5b8fb9349434cc293a8e5c10cc3b13035c07b`、`hashStage=before-signing`、
`path=xlsx-sidecar.exe`、`sha256=afe58285…79c`、`size=9136640`。
⇒ 两枚 sidecar 都是**原生 PE**，不是 JS，取证必须走反编译层。本机 Ghidra 12.1.4 在位且
`rea doctor` 的 ghidra 检查组全 healthy（顶层 `healthy:false` 只因 Hopper 不支持 win32，属预期）。
体量 2.5 MB / 9.1 MB，与前册判死的 282 MB `ai_agent.dll` 不是一个量级——**这次能真挖到函数级**。

**[观察]** 同一插件的两版并存（`f74c72c1…` 与 `fa206b86…` 两个归档同时在场）是 `T3` G-22
「多版本目录并存」那一格的**装机面实锤**，比册里的静态推断直接。

**[未知]** 两枚 exe 的命令行动作面：`node scripts/benchmark-asar-read.mjs "G:/Qoder CN/resources/app.asar" --grep QoderComputerUse`
与 `--grep xlsx-sidecar` 均**扫 4312 个文本型条目、命中 0 个文件** [观察]。
⇒ 调用方不按这两个文件名字面 spawn（可能由插件注册表间接寻址或在 asar 外的二进制里）。
这一格留反编译产物补，不猜。

## 3. 内容寻址实测：完整性锚点必须落在「安装时刻的盘上字节」

对 `T3` G-21（本仓缺逐文件 sha256 台账）唯一有价值的对照设计实测：

```
zip 文件名(new) = fa206b86ce78944e5da84d66c744310d33815f752b156a24e10877183345ffd0
zip 自身 sha256 = fa206b86ce78944e5da84d66c744310d33815f752b156a24e10877183345ffd0   ← 逐字节相等
zip 文件名(old) = f74c72c1e76f4d08f8ecceb63c942e32b66b3048b57d835473547d8b2ceda096
xlsx zip 名      = 58dc2c927de4cc0f495ec543b0104db52629784f1ff38caf1f8f941d0d05caf9
xlsx zip sha256  = 58dc2c927de4cc0f495ec543b0104db52629784f1ff38caf1f8f941d0d05caf9   ← 逐字节相等

盘上 xlsx-sidecar.exe sha256 = 18bee47b4ac95f94a7e6a6d96aa2ad8978f00a164e32458c2c18eaa2b9f5ae3a
resource.json 声明的 sha256   = afe58285b37c0209f7aa04501d61cb5d244a52fceca22f5e8b05dcbb2207179c   ← 不等
resource.json 声明 size=9136640，盘上 9147400（差 10760 B）
```

三条结论：

1. **[观察]** Qoder 的内容寻址粒度是**归档包**，不是解包后的单文件（文件名 == 该 zip 的 sha256）。
2. **[观察]** `resource.json` 里那个文件级哈希**在装机面校验不了**——它自己写明 `hashStage=before-signing`，
   签名改写了字节（体积 +10,760 B），所以盘上实际哈希与声明值必然不等。
3. **[推断 → 直接决定本仓 G-21 设计]** 完整性锚点只能取**安装时刻从盘上现算的字节**，
   不得抄上游 manifest 声明的哈希；否则「校验通过」与「校验失败」都不是真信号（永远失败）。
   本仓该门的超越轴因此不是「也做逐文件哈希」，而是三条边界：
   ①哈希来源=盘上现算，永不信上游声明；②「没记过」/「记了但漂了」/「多出未登记」三类分开点名
   （历史条目拿不到哈希只能落 `unjudged`，不得冒 `ok` 也不得冒 `drift`）；
   ③对账只读、不跟随 junction 出安装根（§26 junction 递归穿透事故史）。

## 4. 交付形态补齐：Trae 册此前只有 candidate、没有出图

`AGENTS.md` §0 第 12 条要求逆向结论用 `archify` 画成可交互 HTML 交付。现读
`docs/benchmark-evidence/2026-10/trae-rea-20261031/` 只有 `diagram-candidate.json`（25,139 B），
对照 `../qoder-rea-20261030/` 有完整 `*.finalize.json` / `*.browser-check.json` / `*.delivery.json` + HTML
⇒ **Trae 这一半的交付形态缺一格**（前席做完结论没走完出图闭环）。

本席补齐（命令与凭据均为现跑）：

```bash
node .ihui/skills/archify/bin/archify.mjs validate architecture diagram-candidate.json --repo-root G:/IHUI-AI --json
#   → issues: []（不带 --repo-root 时该图会拒渲染：repository-evidence/root-required）
node .ihui/skills/archify/bin/archify.mjs finalize architecture diagram-candidate.json \
     trae-3.4.12-capability-architecture.html --json --browser-check --repo-root G:/IHUI-AI \
     --receipt trae-3.4.12-capability-architecture.finalize.json --out-dir .
#   → ok: true | status: pass | 928,295 B
```

同批产物：`trae-3.4.12-capability-architecture.html`（928,295 B）、`.finalize.json`（37,776 B）、
`.browser-check.json`（22,347 B）、`.delivery.json`（630 B）、`.finalize-summary.json`（3,846 B）。
**入库口径**：四枚 JSON 入库，HTML 本体被根 `.gitignore` 的 `*.html` 排除、只留工作区
（`git check-ignore -v` 现读命中 `.gitignore:298:*.html`；对照 `../qoder-rea-20261030/` 亦同——
`git ls-files` 现读该目录只有 5 枚 JSON + md，885 KB 的 HTML 从未入库）。
要看交互图就地重渲染：`node .ihui/skills/archify/bin/archify.mjs deliver architecture <candidate.json> <输出路径> --repo-root G:/IHUI-AI`。
该册 `README.md` 册面表已补登 T4/T5/T6 三行与该架构图行（前册 README 只登记到 T3，
T4–T6 是 README 写就之后产的，属交付一致性缺口）。

## 5. 本轮据此刻定的派单口径

- **G-21 半腿** → 已派（插件安装面逐文件完整性台账 + 只读对账门；落点
  `apps/cli/src/plugins/{types,installer}.ts` + 新门 `scripts/check-plugin-manifest-integrity.mjs`，
  warn 档 + 差值棘轮，§12e 不得升 blocking）。设计边界按本册 §3 第 3 条。
- **G-01 Workflow 工具** → 已派（`resume_from_run_id` 语义；本席现读
  `git grep -nI -E "resumeFromRunId|resume_from_run_id" -- apps packages scripts` = 0 命中，确认仍是真缺口）。
- **G-20 / G-26** → 不立票（形态不适用：本仓取源是 `git clone` + npm 平台包 + tauri updater，
  没有「远程可执行分平台下载表」与「多版本目录原子切换」这一格；命中项全属采集/清理对方产品一侧）。
- **两枚 sidecar** → **取证已完成**（册 `T8-sidecar-native-surface.md`，枚 `e2a418dd84`；走 `analyzeHeadless.bat`，
  因 `rea analyze` 对原生 PE 有 5.5 分钟硬预算，`provider_timeout op=list_documents` 两次实测复现）。
  读数：件 1 `QoderComputerUse.exe` = 14 枚工具 + 11 项边界实装，**人工审批门与速率闸各 0 命中**（如实登记未找到）；
  件 2 `xlsx-sidecar.exe` = 自研 sidecar 协议 14 命令，含 `save_archive`/`recalc_cells`/`convert_workbook` ⇒ **真有写回与公式重算**；
  函数面 6,995 / 15,168，两件 PE 导出表皆 0（静态链接 Rust）。
- 由 T8 直接开出的两张票（本轮在飞）：① **桌面自动化动作面 + 审批门**（对照位
  `apps/desktop/src-tauri/src/operator.rs` 的 `OperatorAction`/`capture_decide_act`；超越轴 = 对方没有的人工审批门与
  「输入类动作永不自动重试」的可测不变式）；② **agent 表格工作簿读写面**（对照位本仓只有
  `excel-export-service.ts` 的导出与 `document_tools.py` 的只读，缺「让 agent 改动一个已存在的工作簿」；
  零新依赖用既有 `exceljs`，红线 = 公式单元格**不得把缓存值当当前值返回**，对方靠 9MB 原生引擎堵的风险，
  本仓用「失效方向必须明说」堵）。
- **G-21 逐文件完整性** → **已落地**（代码枚 `6f57e57fe6`，门 id 277 / warn 档；README 点名枚 `7d386b2826`）。
  设计边界即本册 §3 第 3 条：锚点取安装时刻盘上现算，绝不抄上游声明哈希。
- **G-22 `autoUpdate` 残腿** → 本轮开出（判据与命令层）。要点是把刚落地的门 277 接成供应链防线：
  拉取后**验不过就不落**、本地已脏就停不覆盖用户改动、取不到远端一律 `unjudged`（不用"没更新"冒充"查过了"）。
  ⇒ 这一格是本仓对「插件自动更新」类实现天然多出来的一道牙，**超越轴**（对方只做到版本共存与自动更新，
  是否校验未取证到，标 [未知]，不得写成对方没有）。
- **检索引擎本体** → 本轮新开的取证靶：`…/.qoder-cn/plugins/cache/qoderapp-bundler/qoder-context/runtime/qoder-search.bundle.mjs`
  （约 5.4MB，前两轮只破到 `T6` §1 的 plugin/hooks 规格级，**引擎实现一个字没读**）。
  对撞基准先钉住以免误报缺失：本仓 `apps/ai-service/app/services/codebase_indexer.py` 的 Merkle 增量**已在产**
  （`incremental` 开关、`_load_snapshot` 前像、`content_hash` 相同即跳过、`deleted_paths` 差集、有变更才重建）。
- 本轮已落地并推送到 `origin` 的枚（末行现读 `origin/main..HEAD` 未推数 0，本地=远端一致）：
  `09fa348a4f`(G-01 代码+T7 册+出图凭据) → `1eeab01a1d`(README 第 30 条) → `60fffea9dc1f`(与对侧分叉的零丢失归并)
  → `90933dd5ae`(T3 时效告示) → `6f57e57fe6`(G-21) → `7d386b2826`(门 277 点名) → `e2a418dd84`(T8 册)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
