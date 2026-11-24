<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T6 — goal-b43:Qoder context-plugin 破译 + Repo Wiki agent 写面落地 + 反编译长跑状态

> 席位:goal-b43(机主令"继续",同目标续轮)。
> 与 T4/T5 分工:T6 = Qoder context-plugin(上轮零接触的新矿)、G5 判定收口、wiki 写面落地、harness/toolhost 状态。

## 1. Qoder context-plugin 破译(本轮最大取证收获)[观察]

`G:/Qoder CN/resources/bundled-resources/archives/qoder-cn-context-plugin/`(manifest:kind=qoder-plugin,version 1.0.91.b22f2d0a,install.folderName=qoder-context,defaultEnabled=true,**userVisible=false**——静默内置)。

### 1.1 产品定位与形态 [观察]

- plugin.json 自述:**「Wiki, retrieval engine, and more for Qoder」** —— Qoder 的代码理解层走 **Repo Wiki + 检索引擎** 路线(与 Trae ckg 的 Code Knowledge Graph 是两条不同的产品化路径:Qoder 把知识做成可写条目库,Trae 做成自动索引图谱)。
- 形态 = **MCP-as-engine**:检索引擎本身是一个 MCP server(`qoder-search.bundle.mjs mcp-bridge`,5.4MB bundle,electronRunAsNode 复用主程序跑),alwaysAllow 白名单 = `SearchWorkspace` + `SearchKnowledge`。
- 运行时四件:**mtree 原生模块**(`mtree.win32-x64-msvc.node`,napi 10——Merkle 增量,与 Trae merkletrie 同思路)、内置 `rg.exe`、`qoder-context-hook.exe`(hook 宿主)、asset a.bin/b.bin(未解,加密资产 [未知])。

### 1.2 hooks 协议完整规格(5 事件 8 钩子)[观察·逐字]

`hooks/hooks.json` 的事件全集:**SessionStart / SubagentStart / UserPromptSubmit / PostToolUse / Stop**(Claude Code 式 hooks 契约;matcher 正则、async 标志、timeout=2s、env 注入 QODER_PRODUCT_ID):

| 事件 | 钩子 | matcher | 语义 |
| --- | --- | --- | --- |
| SessionStart | qoder-context-session-start | -(async) | 会话启动 |
| SessionStart | knowledge-overview | `^(?!resume$).*`(同步) | **非 resume 即注入知识概览** |
| SubagentStart | subagent-knowledge-overview | `^(general-purpose\|Explore\|Plan)$` | **子代理按类型名匹配注入** |
| UserPromptSubmit | user-prompt-submit | -(async) | 提交时 |
| PostToolUse | post-tool-use | `Edit\|Write` | 编辑后 |
| PostToolUse | knowledge-edit-record | `^(mcp_call\|(mcp__[^\s]+__)?(write_wiki\|edit_wiki\|delete_wiki\|write_knowledge\|edit_knowledge\|delete_knowledge\|link_knowledge\|unlink_knowledge))$` | **知识写工具族逐字清单** |
| Stop | stop / knowledge-edit-upload | -(async) | 停止 + **知识编辑上传同步** |

### 1.3 三工具面对撞 [观察]

- `SearchWorkspace` ↔ 本仓 `_tool_search_codebase` ✓
- `SearchKnowledge` ↔ 本仓 `knowledge_lookup` + knowledge-rag ✓
- `repowiki`(bundle 内确证)↔ 本仓 `repo_wiki_engine` ✓
- **写面**:Qoder 8 枚写工具族(write/edit/delete × wiki/knowledge + link/unlink)——本仓 knowledge_cards 表 2026-09-10 已有全写 HTTP 面,但 **agent 出口零对位 → 本轮落地**(§2)。

## 2. Repo Wiki agent 写面落地(先对齐再超越)[观察]

- 落点:`apps/ai-service/app/services/knowledge_writer.py`(服务层)+ `app/api/v1/knowledge_write.py`(`/api/v1/ai/knowledge-write` 四端点)+ router 注册。
- **写入判据单一真相源住 apps/api routes/knowledge-card.ts**(2026-09-10 的归属/仅本人/来源标注),本模块是它的 ai-service 客户端,零复制写入判据(§0.6):
  - write → POST(内部通道 X-Internal-Secret + userId 显式归属;api 侧标 `source='agent'`——与 Qoder PostToolUse knowledge-edit-record 的编辑留痕同语义,审计由 api 侧承担)
  - update/delete → PATCH·DELETE(Bearer「仅本人」,ai-service 不自解 JWT,§5)
  - link/unlink → 读改写 `context.links` jsonb(零迁移;`{cardId, relation}` 双键幂等;relation 白名单 `[a-zA-Z0-9_-]`)
- **超越轴**:①双通道身份分离(创建=内部归属显式,改删=用户 JWT 仅本人——Qoder 取证未证到通道分离);②三态诚实(identity/card_missing/upstream/invalid_input);③链接幂等(already 分支不重复 PATCH);④invalid_input 全部在发请求前拦截(测试断言 zero HTTP)。
- 测试:`tests/test_knowledge_writer.py` **6/6 GREEN**(FakeClient 路由替身;内部通道形状/身份三态不发请求/Bearer 通道/404 语义/读改写+幂等+unlink 双键删/非法输入零 HTTP);mypy 2 文件 0 错。

## 3. G5 判定收口 [观察]

`browser_hub.py` 现读:tab_id 来自**路由路径参数(本服务自己 mint)**,请求体不参与作用域判定(§5 注释逐字),缺 tab_id ⇒ `missing_tab_scope` —— T2 §8-G5 的 scope/租约格**已在**(T2 报告后由并行席落地)。G5 关闭。

## 4. 反编译长跑状态(截至 14:20)[未知·进行中]

- toolhost.dll(95MB):Ghidra headless 存活 2.2h,逐函数反编译仍在磨(pcode warnings 正常过程);**产物未出**。
- harness.dll(248MB):分析进行中(-analysisTimeoutPerFile=7200 长跑档);**产物未出**。
- 两件按 §0.3 如实登记「进行中未完成」;产物目录 scratch(goal-b42-ghidra / goal-b43-ghidra),后续席位按 T4 §3 流程回填。本轮结论口径:「挖到最底层」在 libckg(T4,反编译级完成)、context-plugin(本轮,规格级完成)、toolhost/harness(**分析级完成、反编译级进行中**)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
