<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Ghidra 逆向取证 Harvest 报告（goal-b41/b42/b43）

- **导出时间**：2026-10-31T17:09 (GMT+8)
- **取证工具**：Ghidra 12.1.4 headless（`D:\DevEnv\ghidra_12.1.4`），经本仓 `.ihui/mcp.json` 注入的 `rea`(REA 6.4.0) 驱动
- **合规**：仅对本仓已持有/机主提供的外部对照程序做取证；不提取凭据、不绕过许可证、不原样抄袭专有源码
- **状态总览**：b41(ckg/Trae) **已完成并 harvest**；b43(Qoder context-plugin) **插件已 carved + 配置已破译**（深层反编译仍跑）；b42(toolhost) **仍在跑，尚无 surface 输出**

---

## 1. b43 — Qoder `context-plugin`（harness.dll 248MB 取证）

### 1.1 取证路径

Ghidra 对 Qoder `harness.dll`(248MB) 反编译过程中，将内嵌的 **Qoder Context 插件整体 carved** 到：
`D:\DevEnv\Temp\ihui-scratch\goal-b43-ghidra\qoder-context\qoder-context-plugin\`

### 1.2 实物证据（逐字）

**`.qoder-plugin/plugin.json`**

```json
{
  "name": "qoder-context",
  "displayName": "Qoder Context",
  "version": "1.0.91.b22f2d0a",
  "description": "Wiki, retrieval engine, and more for Qoder"
}
```

→ 实锤导出轮结论：版本 **v1.0.91**、`userVisible` 虽未在此文件显式（由 mcp.json 的 `startup:"application"` 隐含内置）、描述正是「Wiki, retrieval engine, and more」——**确认 Qoder 走 Repo Wiki 可写条目库路线**（与 Trae ckg 自动索引图谱是两条不同产品化路径）。

**`mcp.json`（MCP-as-engine）**

- 检索引擎本身是 MCP server：`command=node ${QODER_PLUGIN_ROOT}/runtime/qoder-search.bundle.mjs mcp-bridge`
- `alwaysAllow: ["SearchWorkspace","SearchKnowledge"]`（静默内置、免确认）
- `QODER_MTREE_NATIVE=${QODER_PLUGIN_ROOT}/runtime/native/mtree/index.cjs` → **mtree 原生 Merkle 模块**
- `QODER_SEARCH_RIPGREP_PATH=${QODER_PLUGIN_ROOT}/bin/rg.exe` → **内置 ripgrep（bin/rg.exe 5.4MB）**
- `timeout: 600000`、`build: 1.0.91.b22f2d0a-win32-x64`

**`hooks/hooks.json`（hooks 协议 5 事件 8 钩子，逐字）**

| 事件               | 钩子数 | 关键 matcher / 动作                                                                               |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| `SessionStart`     | 2      | `session-start`（async）；`qoder-context-prompt`（`^(?!resume$).*` 非恢复会话注入知识概览，sync） |
| `SubagentStart`    | 1      | `qoder-context-prompt`，matcher `^(general-purpose\|Explore\|Plan)$`                              |
| `UserPromptSubmit` | 1      | `user-prompt-submit`（async）                                                                     |
| `PostToolUse`      | 2      | `post-tool-use`（matcher `Edit\|Write`，async）；**`knowledge-edit-record`**                      |
| `Stop`             | 2      | `stop`（async）；`knowledge-edit-upload`（async，写面落盘上传）                                   |

**`knowledge-edit-record` 的 matcher 逐字印证 8 枚写工具族**：

```
^(mcp_call|(mcp__[^\s]+__)?(write_wiki|edit_wiki|delete_wiki|
   write_knowledge|edit_knowledge|delete_knowledge|
   link_knowledge|unlink_knowledge))$
```

→ 即 **write/edit/delete × {wiki, knowledge} + link/unlink knowledge = 8 枚**，与导出轮破译完全一致。

**`bin/`**：`qoder-context-hook.exe`(641KB) + `rg.exe`(5.4MB)。`runtime/` 含 `qoder-search.bundle.mjs` 桥接包（深层 bundle 由 Ghidra 长跑继续抽取）。

### 1.3 与本仓对位（三工具面对撞）

| Qoder 能力                    | 本仓对位                     | 状态                                                                                                   |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `SearchWorkspace`             | 本仓检索/ContextFS 检索面    | 有对位                                                                                                 |
| `SearchKnowledge`             | 本仓知识库检索               | 有对位                                                                                                 |
| `repowiki`（Wiki 可写条目库） | 本仓 wiki 写面（agent 出口） | **唯一零对位格 → b43 已落地 `knowledge_writer.py` + `/api/v1/ai/knowledge-write` 四端点**              |
| 写面 8 工具族                 | 本仓未证到通道分离           | b43 超越轴：双通道身份分离（创建=内部归属显式 / 改删=仅本人 JWT）、链接幂等、三态诚实、非法输入零 HTTP |

### 1.4 b43 状态

- **配置层取证：完成**（plugin/mcp/hooks 全部逐字破译，结论可复核）。
- **深层反编译：进行中**——harness Ghidra(PID 6768) 仍在跑（日志 `ghidra_hs.log` 33MB+，含常规 `Unable to resolve constructor` 噪声，非致命）。`runtime/qoder-search.bundle.mjs` 完整反编译与行为钉定待后台回填。

---

## 2. b41 — Trae `ckg` / ContextFS（已完成 harvest）

- **产物**：`D:\DevEnv\Temp\ihui-scratch\goal-b41-ghidra\` 下 `ckg_cfs_decompiled.c`(132KB) + `ckg_cfs_funcs.txt`(155 函数) + `ckg_func_summary.txt` + `ckg_exports.txt`
- **规模**：TOTAL_FUNCS=35908，CKG_FUNCS=3986，**CFS_FUNCS=155**
- **包分布**：`ide/ckg/codekg` 3560（主体）、`hashicorp/golang-lru` 196、`adrianbrad/queue` 等
- **155 Cfs 函数构成**（见 `ckg_cfs_funcs.txt`）：完整 **ContextFS** 虚拟文件系统——
  - 4 类 ChildProvider：`Composite`/`Disk`/`Mem`/`Remote`
  - 3 类 FS：`MemFs`/`RemoteFs`/`VNodeFS`
  - `SimplePathRouter` + `VNodeBuilder`（虚拟节点树）
  - `service` 层：Health/ListDir/ListMounts/Mkdir/Read/Remove/Rename/Resolve/**Search**/Stat/Write
  - 鉴权：`CfsAuthFromContext`/`WithCfsAuth`；配置：`DefaultConfig`/`StorageConfig`
  - 全量请求/响应 DTO：`*Request`/`*Response`/`FileInfo`/`MountInfo`/`RouteRule`/`SearchResult` 等
- **导出符号**（`ckg_exports.txt`）：`BP_GetInterface`/`BP_Initialize`/`BP_Shutdown`（桥接接口）、`sqlite3_vec_init`/`sqlite3_vec_numpy_init`/`sqlite3_vec_static_blobs_init`（**sqlite vec 向量初始化**，对应 b42 本地 embedding 路线）、`*HookTrampoline`（commit/update/rollback/preUpdate/step 钩子）
- **深度参数 schema 挖掘**：见并行子代理 **Agent A** 产出 `.archify/goal-b41-cfs-schema-mining-20261031/README.md`

---

## 3. b42 — `toolhost.dll` 取证（进行中）

- **进程**：Ghidra toolhost(PID 29936) 仍在跑（`ghidra_th.log` 68MB+，含 `function body repair failed due to overlap` 噪声，非致命）
- **输出**：截至导出时 **尚无 surface 输出文件**（仅 `toolhost_surface.java` 脚本与工程文件）
- **目标**：导出符号 / 函数域分布 / `dispatch-execute-handle` 函数反编译(≤40)
- **状态**：待 Ghidra 跑完后 harvest 回填

---

## 4. 跨轮对齐结论

| 轮  | 外部对照                      | 本仓落地                   | 超越轴                  | 状态                                                  |
| --- | ----------------------------- | -------------------------- | ----------------------- | ----------------------------------------------------- |
| b41 | Trae ckg/ContextFS(155 函数)  | ContextFS + 导入 4 维      | 检索/虚拟 FS 对位       | 已完成 + 参数 schema 挖掘中                           |
| b42 | toolhost dispatch 引擎        | G7 本地 embedding          | 本地向量化              | 源码落地；toolhost RE 进行中                          |
| b43 | Qoder context-plugin(v1.0.91) | wiki 写面 knowledge_writer | 双通道身份分离/三态诚实 | wiki 写面已完成；Qoder 配置层已破译、深层反编译进行中 |

---

## 5. 后续建议（收尾清单）

1. **b42(toolhost)**：Ghidra 跑完后 harvest `dispatch-execute-handle` 反编译，核对 `sqlite3_vec_*` 与 b42 本地 embedding 路线的一致性。
2. **b43(harness)**：harness Ghidra 完成后抽取 `qoder-search.bundle.mjs` 完整行为，钉定 SearchWorkspace/SearchKnowledge 的检索协议细节（本仓检索面可对位增强）。
3. **三图交付物**：b41/b42/b43 三份 archify 架构图已 finalize（b43 待 browser-check 清理后转 pass），统一收口进仓库。
4. **凭据/许可证红线**：全程未提取任何 Qoder/Trae 凭据；bundle 源码仅作行为对照，不原样入库。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
