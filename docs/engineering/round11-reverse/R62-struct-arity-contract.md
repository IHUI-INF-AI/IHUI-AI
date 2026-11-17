<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R62 —— 结构元数契约（serde with-N-elements）：从「值域清单」到「结构形状」的质变

## 1. 本轮定位

R56-R61 六轮全部是**值域封闭集**：enum 有哪些 variant、每个 variant 叫什么、元素数几。本轮首次换轴——不复现「有哪些值」，而复现「**struct 类型有几个字段**」。这是协议面复现从「值域」到「结构形状」的质变，取证源也从 `struct variant X::Y with N element` 扩展到更硬的 `struct X with N elements` serde 自描述断言。

## 2. 取证方法与全量数据

工具：`scripts/evidence/native-xref-probe.py` 同型的 mmap 流式 ASCII 抽取，对 `codex.exe 26.1111.2228.0`（365MB Rust PE）跑三层正则：

- **层一（字段级线索探针，本轴起点）**：`"type":"object"`×30 / `"properties":`×30 / `"required":[`×19 / `"additionalProperties":false`×30 —— 证实二进制内嵌 30 段 JSON Schema；`serde(rename/default/skip)` 0 命中（编译后擦除）。
- **层二（结构名+字段名连体串）**：捞到 `SessionFunctionToolnamedescriptionparameters`、`HostHellorequiredCapabilitiesoptionalCapabilities...`、`DynamicToolFunctionSpecnamedescriptioninputSchemadeferLoading` 等 serde 字段名表。
- **层三（硬断言，本轮真相源）**：`struct/enum/variant X with N elements` → **1944 结构名 / 1967 条断言 / 22 个多值冲突 / 1922 单值一致**。这是 serde derive 编译器生成的元素数，非人工推断，比 R58 的 95 家族大 20 倍。

## 3. 严谨性：三重去重 + 字段名负结果

1. **多值冲突排除**：22 个结构同名多 N（如 `FsWriteFileParams:[2,4]`、`CreateArguments:[2,3]`）全部剔除，不猜哪个对。
2. **归属过滤**：解析本仓 `app/core/*.py` 全部字符串常量，本仓已收编的结构名一律跳过；过滤后 **1136 个干净 N≥2 未覆盖结构**。
3. **同族异形态**：`X::Y` variant 形式（如 `Account::Chatgpt:N=3`）与 R56 已落 wire 值形态重复，本轮只取无 `::` 的顶层 struct 名。

**字段名契约的诚实负结果**：尝试用 camelCase/snake_case 正则从连体串切字段名，并以「切出数量 == N + 跨串一致」自证，得 160 个候选——但人工抽检发现切分不可靠（`HostHello` 被切成 `['selected','Versioncapabilities']` 而非 `selectedVersion/capabilities`；`AppBranding` 被切成 `categorydeveloperwebsiteprivacy/Policyterms/...`）。**结论：字符串启发式无法可靠切分连体 camelCase 字段名**，必须上 disasm LEA xref 逐点定位字段访问（保留为开放轴）。本轮因此只落 arity（元素数），不落字段名，避免钉死错误数据。

## 4. 交付（14 文件）

7 个 arity 域模块（结构名逐字表 + 元素数 + 角色域归类 + 反查 + validate 守门）+ 7 测试。角色域由结构名后缀确定性归类（Params/Response/Notification/Toml/Spec/…），与元素数正交。

| 模块 | 结构数 | 角色域 | N 范围 |
|---|---|---|---|
| `account_struct_contract` | 131 | 9 | 2~14 |
| `config_struct_contract` | 229 | 11 | 2~106 |
| `thread_struct_contract` | 230 | 7 | 2~33 |
| `tool_struct_contract` | 207 | 10 | 2~19 |
| `agent_struct_contract` | 29 | 6 | 2~13 |
| `wire_struct_contract` | 145 | 8 | 2~24 |
| `realtime_struct_contract` | 10 | 3 | 2~5 |

合计 981 struct（987 收集中剔除 model 单角色域 6 个）。所有元素数取自 serde 硬断言，零手敲；角色域全覆盖由生成器断言。

## 5. 验证

- **2128 pytest**（R62 单跑，34s）/ **3910**（含 R56-R61 全量回归，86s）全绿
- ruff 0.16.6 全绿（7×I001 排序自动修）、py_compile 14/14、HEAD 面水印 14/14
- **三重反向变异**实证红→恢复绿（单变异 trap 法，SIGTERM 安全）：
  - 篡改元素数 `AudioContent 4→99` → 2 failed，恢复绿
  - 篡改角色域 `AudioContent content→descriptor` → 1 failed，恢复绿
  - 删除枚举成员行 `AUDIO_STATE` → rc=1 / 2 failed，恢复后 diff 空（字节级一致）
  - 负对照：仅重命名成员（`AUDIO_STATE→AUDIO_STATE_X`，value 不变）不转红——证明测试钉的是逐字 value 集合而非标识符，符合设计

## 6. 落库与推送状态

（落库 commit sha、推送判定在落库步骤完成后补记；纪律：对象空间精确 pathspec、判推送只认 ls-remote sha、真实红不洗门、饱和树不反复硬推。）

## 7. 后续开放轴

- **字段级 wire 契约（disasm 轴）**：本轮证实字符串正则不可靠切分 camelCase 连体字段名。下一步用 R53 LEA xref 法，对 `HostHello`/`DynamicToolFunctionSpec`/`ModelTokenBudgetConfig` 等已确证 arity 的结构做字段访问点定位，逐点还原字段名与形态——这是「值长什么样」的真正落点。
- **JSON Schema 提取**：30 段内嵌 schema（type/properties/required/additionalProperties）可用 PE 段映射 + 边界扫描提取完整 schema 文本，落 tool input schema 契约。
- **arity 域补齐**：`other` 桶 149 个未归类结构 + model 单角色域 6 个，可按更细语义归并后再落一批。
