<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 逆向覆盖账与后续任务清单（R64 基线）

> 用途：一张账说清「哪些面已经逆向出来了、哪些只到了形状、哪些完全没分析或没分析全」，并把剩余可榨干的轴编号成可派单的任务（A 系）。数字一律现读；引旧轮读数必标出处；判不了的写「未判定」，不写成「判过」。

## 0. 三档口径

| 档 | 判据 |
|---|---|
| **已收编** | 有 `app/core/*.py` 契约模块 + 对应测试 + `docs/engineering/round11-reverse/` 报告，且机器派生（非手抄） |
| **部分** | 只有形状（元素数/字段名/家族名之一），缺另外两维；或有候选集但缺值域/字段名 |
| **未分析** | 零取证，或取证法未成立（正则 0 命中即属此类，不属「已分析=空集」） |

## 1. 已收编面（现读）

- **模块面**：`apps/ai-service/app/core` 中与 codex 逆向战役对应的契约/结构模块 **37 个、合计 9,018 行**（实测：按 `_contract`/`_struct`/`hook_*`/`guardian_*`/`turn_*` 等文件名规则筛出，含少量邻接模块如 `error_classify_structured.py`）。
- **报告面**：R11 → R64 共 40+ 份，均在 `docs/engineering/round11-reverse/`。
- **值域/形状族面**（逐轮）：
  - R56-R57：纯值域轴 5 族 + struct-variant 5 族；
  - R58：**95 个 struct-variant 家族**全量反推（`families.out`），其中 60 族当时零命中；
  - R59：6 个大方法清单族（`ClientRequest` 187 / `ServerRequest` 11 / `RawTraceEventPayload` 28 / `ThreadItemPayload` 16 / `ResponseItem` 14 / `RolloutItemWire` 13）；
  - R60：8 个中等族；R61：12 个 N≤3 族 + 精确差集去重；
  - R62：**1136 个干净 N≥2 结构**的 arity 契约（无字段名）；
  - R63：23 段内嵌 JSON Schema → 26 个逐字字段名 + required；
  - R64：170 个字段的类型签名 + 12 个 definitions 名（4 enum / 1 NullableString / 7 对象）。
- **行为/策略面**（R11–R52）：agent loop/turn 编排、auto-compact、hook 事件/退出码/排序、权限与 sandbox 审批、exec policy（可执行/网络规则）、model reroute、turn error 分类、guardian 评估/评分/上下文、collab 生命周期、a2a 任务态、MCP elicit、steer 可撤销性等——均落为**契约/判定函数**，不复刻引擎控制流（R14 §一已定调）。

## 2. 部分覆盖（有形状、缺名或缺值域）

| # | 面 | 现状 | 缺口 | 证据 |
|---|---|---|---|---|
| P-1 | 1136 个 N≥2 结构 | 只有 arity（`struct X with N elements`） | 无字段名、无类型 | R62 §2 |
| P-2 | `other` 桶 149 结构 + model 单角色域 6 | 未归类 | 语义归并缺失 | R62 §7 |
| P-3 | 262 处 `internally tagged enum X` | 只知族名，连体串无 variant 元素数 | 值域全缺 | R60 §7 |
| P-4 | 209 个 tagged enum 声明 | 未逐族反推 | 值域全缺 | R59 §7 |
| P-5 | unit-variant enum | 两轮正则近 0 命中 | **取证法未成立**（非空集） | R60 §7 |
| P-6 | `Message` 族（N=17） | 宽正则曾抓 45（经证为连体串假阳性） | 真值待 Ghidra 确证 | R61 §7 |
| P-7 | 7 段 `type:object` 片段 | R63 严格 `json.loads` 未收口 | 边界未知（疑 tool input schema） | R63 §7 |
| P-8 | `description` 12 条 | 字段级语义解释文本 | R64 未纳入签名表 | R64 §6 |
| P-9 | R58 95 族剩余未落项 | R61 精确差集后约 47 族未落（R61 §7 读数，本轮未重跑） | 需按语义正交性择优，非凑数 | R61 §7 |
| P-10 | 238 个「候选/零命中」轴向 | R56 差距矩阵尚有 200+ 未逐条确证 | 未逐条坐实 | R56 §7 |

## 3. 未分析 / 未分析全

1. **函数体与控制流（全量）**：从未做全量反编译。只做过定向取证——R52/R53 用 LEA xref 确证 steer rollback 因果，方法沉淀为 `scripts/evidence/native-xref-probe.py`（R54）。**未分析全**：引擎内部函数边界、调用图、错误分支。
2. **引擎内部编排细节**：R14 §一明确「loop/turn phase/multi-agent 编排在大脑侧，复现=重写引擎」，属**主动不复刻**，不是遗漏；其控制流仍属「未分析」。
3. **前端壳 `app.asar`（783MB）语义**：R14 只证 `agentLoop`/`runLoop`/`mainLoop` 字面量全 0、worker.js 与 early-bootstrap 的角色。**未分析全**：30 个 `.vite/build` chunk 的逐函数语义。
4. **`resources/` 内容语义**：R11 已枚举一级面（native / cua_node / tectonic / plugins / plugin-signatures / skills / artifact-template-picker / default_app / owl-* / masque-* 等）。**未分析全**：各面内部模板/清单/签名规则的内容级解读。
5. **遥测出口**：只在 R11 sandbox-service 里作为观测点记录（`OTEL_EXPORTER_OTLP_ENDPOINT` 等）。**未分析**：codex 自身 telemetry 事件 schema、采样开关、上报链路。
6. **许可 / OTA / 更新源**：**未判定**（无取证记录，不等于不存在）。
7. **本地化与提示语文案**：**未判定**（未见系统性采集）。
8. **模型侧预算/超时数值面**：只落过阈值契约（`post_turn_compact_threshold` 等），退避与采样常量的完整取值表**未分析全**。

## 4. 后续任务清单（A 系，可派单）

优先级：P1 = 取证路径已成立、产出确定；P2 = 需新取证法或需语义取舍；P3 = 成本高或价值待判。

### P1（可直接开工）

| ID | 轴 | 取证入口 | 产出 | 验收判据 |
|---|---|---|---|---|
| **A1** | 非 hook struct 的**字段名 + 类型**（先取 `HostHello` / `DynamicToolFunctionSpec` / `ModelTokenBudgetConfig` 三个已确证 arity 的锚） | `scripts/evidence/native-xref-probe.py`（R54）+ R62 `evidence.json` | 3 个模块（`字段→类型`表）+ 测试 + 报告 | 字段名逐字（非切分猜测）；三重反向变异红→恢复绿；与 R62 arity 逐族对账（字段数 == N） |
| **A2** | 7 段未解析 `type:object` 片段回收 | 复用 R63 `schema_probe.py`，放宽边界（允许前后截断、缺 title） | 片段清单 + 判定（是否 hook/tool schema）+ 若成立则补模块 | 每段给「是/否完整 schema」的机械判据，不靠人眼；新段落与 23 段零重复 |
| **A3** | 262 处 internally tagged enum 值域 | Ghidra 12.1.4（`D:\DevEnv\ghidra_12.1.4`）+ R53 LEA xref 法 | 逐族 variant 表（先取 10 族高频） | 单族 variant 数由两路独立证据（tag 串 + 匹配分支数）互证 |
| **A12** | **超越轴①：运行期契约校验** | R64 `hook_field_type_contract` + `hook_runtime` 接线点 | hook 执行前后按契约校验第三方 hook 输入/输出 | 非法字段/类型被拒且原因结构化；合法载荷零误杀；接进执行链非孤立模块 |
| **A13** | **超越轴②：契约漂移哨兵** | 新一轮 PE → R63 提取法 → 与 R64/R63 模块表对账 | `check-codex-hook-contract-drift.mjs`（只读哨兵，warn 档） | 换版本后表差异逐条点名；取不到 PE ⇒ 未判定 exit 2，不冒绿 |

### P2（需新取证法或语义取舍）

| ID | 轴 | 入口 | 产出 | 验收 |
|---|---|---|---|---|
| **A4** | unit-variant enum 取证法 | 换策略：serde rename 串 + 类型名邻近扫描；或 Ghidra | 方法结论（成立/不成立）+ 若成立则值域表 | 成立须给出「正集 + 负集」双样本，不能只报命中 |
| **A5** | `Message`(N=17) 真值确证 | Ghidra xref | 修正/确认 17，或给差异清单 | 与 `families.out` 逐项对账 |
| **A6** | 12 条 `description` 语义表 | R63 `schemas.json` | 字段语义表（只做解释，不进签名） | 与 170 字段键集一一对应，零遗漏 |
| **A7** | `other` 桶 149 + model 单角色 6 归类 | R62 `domain_tables.json` | 语义归并后的族表 | 归类须有名字证据，禁按 arity 猜 |
| **A8** | R58 剩余约 47 族精确差集扫尾 | `families.out` / `family_gap.out` + 本仓 AST 差集 | 本仓再落 N 族（语义正交优先） | 复用 R61 精确差集脚本，差集前后可复算 |

### P3（成本高/价值待判）

| ID | 轴 | 说明 |
|---|---|---|
| **A9** | `default` 57 处的生效语义 | 已落签名值，缺「何时被填充」的行为证据，需定向 xref 或运行观测 |
| **A10** | `app.asar` 30 chunk 逐函数语义 | 需先判定价值（R14 已证 loop 不在前端，边际收益偏低） |
| **A11** | 遥测/许可/OTA 面 | 先做「存在性判定」（A11a），成立再谈复现 |

## 5. 可复现入口（scratch 工件现盘盘点）

宿主会回收 scratch，故方法全部写进报告；已落盘的取证工件（2026-11-17 实测仍在）：

- `D:/DevEnv/Temp/r56/`：`exhaust.out`（候选串清单）/ `gap.out` / `gap.py` / `exhaust.py`
- `D:/DevEnv/Temp/r57/`：5 族 body + `gen_tests.py`
- `D:/DevEnv/Temp/r58/`：`families.out`（95 族全表）/ `family_gap.out`（60 零命中）/ `family_gap.py`
- `D:/DevEnv/Temp/r59/`：6 大清单 body + `gen.py` / `mutate_check.py`
- `D:/DevEnv/Temp/r60/`：`probe.out` / `probe.py` / `probe2.*`
- `D:/DevEnv/Temp/r61/`：12 族 body + `gen.py`
- `D:/DevEnv/Temp/r62/`：`domain_tables.json` / `evidence.json` / `field_contract.json` / `field_probe.py`
- `D:/DevEnv/Temp/r63/`：`schemas.json`（23 段逐字 schema）/ `schema_probe.py`
- `D:/DevEnv/Temp/r64/`：`gen_r64.py` / `build_r64.py`（+ 二次构建幂等）

仓内可复用工具：`scripts/evidence/native-xref-probe.py`（R54）。

## 6. 纪律

- 本账所有读数来自本轮实测或标明出处的旧轮读数；**未重跑的旧数不冒充现读**。
- 「正则 0 命中」记「取证法未成立」，不记「该类为空集」（P-5）。
- 派单时 A 系优先 P1；A12/A13 是「超越」轴（把已有的字段级契约变成运行期能力与防漂移能力），与 A1–A3 的「补齐」轴并行不冲突。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
