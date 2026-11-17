<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R63 —— Hook 命令字段级 wire 契约：JSON Schema 逐字提取

## 1. 本轮定位

R62 首次换轴到"结构形状"（struct 有几个字段），但字段名契约因 camelCase 连体串无法可靠切分而留为开放轴。本轮找到**不依赖 disasm 的字段级证据**：codex.exe 内嵌的 JSON Schema，其 `properties` 键是逐字 snake_case/camelCase 字段名、`required` 是经自证的必填子集——字段名清晰、零切分歧义。这是 R56-R62 从未触及的**字段级 wire 契约轴**。

## 2. 取证方法与全量数据

工具：允许多行的 mmap ASCII 抽取 `[\x20-\x7e\n\r\t]{40,}` → 花括号配对切块 → `json.loads` → 取含 `type`/`properties`/`title` 的 dict。

- 多行串 40330 条 → 合法解析 **23 段 JSON Schema**（R56 字段探针曾报 `"type":"object"`×30 / `properties`×30，其中 7 段是片段或非标准块，本轮严格的 `json.loads` + 三键校验收口到 23 段完整 schema）。
- 全部是 **hook 命令契约**：12 个 hook 家族（pre/post-tool-use、pre/post-compact、permission-request、session-start/end、subagent-start/stop、user-prompt-submit、stop、interrupt），11 族双 input/output 形态 + `session-end` 仅 input。
- **26 个逐字字段名**：`agent_id`/`agent_type`/`cwd`/`hook_event_name`/`model`/`permission_mode`/`session_id`/`transcript_path`/`turn_id`/`tool_input`/`tool_name`/`tool_response`/`tool_use_id`/`prompt`/`reason`/`source`/`trigger`/`last_assistant_message`/`stop_hook_active`/`agent_transcript_path` 等 snake_case，以及 `continue`/`decision`/`hookSpecificOutput`/`stopReason`/`suppressOutput`/`systemMessage` 等 camelCase。

## 3. 严谨性：三重自证

1. **`required ⊆ properties`**：23 段全部通过，零违规（input schema 的 required 是非空子集或全集，output schema 全 `required=[]`）。
2. **title 唯一**：23 个 title 互不重复，按 `<family>.command.<shape>` 前缀可确定性归类到 12 家族。
3. **形态自证**：input schema 全 snake_case 字段；output schema 含 camelCase 字段——这个 input/output 命名形态差异是原生事实，逐字保留不归一化。

字段**类型**（type/format/enum）未纳入本轴，保留为后续扩展；这是诚实边界不是遗漏。

## 4. 交付（6 文件）

三个模块各有独立判据，全部从 `schemas.json` 机器派生、零手敲字段名：

| 模块 | 封闭集 | 判据 |
|---|---|---|
| `hook_contract_schema` | 23 段 schema `title → (字段名元组, required元组)` | `validate_hook_schema(title, fields, required)` 双序列逐字匹配 + 子集关系 |
| `hook_event_kind` | 12 hook 家族 `→ (has_input, has_output)` | `validate_hook_event` 形态守门 + `hook_events_with_output()` 反查（11 族） |
| `hook_field_name` | 26 字段名 `→ (命名风格, 跨 schema 出现数)` | `validate_hook_field` 风格+计数守门 + `hook_fields_by_style()` 反查（camel 4 / snake 22） |

+ 3 个测试。本仓已有 `hook_event_ordering`/`hook_exit_contract`/`hook_runtime` 管 hook 执行/排序/退出码，本轮字段逐字零命中，属命令 schema 契约层，正交不重复。

## 5. 验证

- **91 pytest**（R63 单跑）/ **4001**（含 R56-R62 全量回归）全绿
- ruff 全绿（3×I001 自动修）、py_compile 6/6、HEAD 面水印 6/6
- **三重反向变异**实证红→恢复绿（单变异 trap 法）：篡改 required 2 failed / 篡改 session-end 形态 output False→True 3 failed / 篡改 stopReason 风格 camel→snake 2 failed；恢复后全绿、锚点字节完整

## 6. 落库与推送状态

- 对象空间精确 pathspec 落库成功：commit `ff65d2fd0a8`，7 文件 / 794 行全在 HEAD 面、水印 7/7、工作树零残留、零他席 staged 触碰。
- **推送未完成**：唯一推送通道在「执行 git push origin main」阶段被 SIGTERM，`ls-remote` sha 未变（`a2e8969`，R63 未上 `origin/main`）。分诊 pre-push-gate：**失败 0 / 未判定 0（全绿）**；本地 0 behind / 51 ahead 无分叉、对象库完整——纯共享树饱和时 push 进程被守护 SIGTERM（非判据红、非分叉）。按纪律（饱和树不人机反复硬推）停止重试；R63 commit 已安全落在本地 HEAD，交守护 converge 后统一推送。判据只认 ls-remote sha，R63 当前尚未成为 origin/main 祖先。

## 7. 后续开放轴

- **字段类型契约**：23 段 schema 的 `properties[f].type`/`format`/`enum`/`description` 尚未纳入，可在 `hook_contract_schema` 上扩展第二层类型表。
- **其他内嵌 schema**：7 段未严格解析的 `type:object` 块可用更宽松的边界扫描回收（可能是 hook 之外的 tool schema 片段）。
- **字段级 disasm LEA xref**：R62 留下的 camelCase 连体串字段名轴仍需 disasm；本轮 JSON Schema 路径绕开了该问题但只覆盖 hook 命令面，非 hook 的 struct 字段仍需 disasm。
