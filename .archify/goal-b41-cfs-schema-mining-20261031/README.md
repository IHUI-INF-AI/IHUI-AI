<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Trae `ckg` ContextFS — 155 个 Cfs 函数参数 Schema 挖掘报告

> 逆向取证子代理产出 · 仅做行为/接口层面的参数 schema 归纳与对位分析
> 输入：`D:/DevEnv/Temp/ihui-scratch/goal-b41-ghidra/{ckg_cfs_funcs.txt, ckg_cfs_decompiled.c, ckg_func_summary.txt, ckg_exports.txt}`
> 红线：不粘贴对方专有源码原文；不提取任何凭据；仅归纳接口形参/返回/结构体字段。

## 0. 覆盖度与取材说明

| 项                  | 值                                                                          |
| ------------------- | --------------------------------------------------------------------------- |
| 二进制总函数        | TOTAL_FUNCS = 35908                                                         |
| CKG 包函数          | CKG_FUNCS = 3986                                                            |
| ContextFS(Cfs) 符号 | CFS_FUNCS = 155                                                             |
| 包主体              | `ide/ckg/codekg/components/contextfs`（3560 个 CKG 函数中绝大多数落在此包） |

**实际反编译 C 源码覆盖**：提供的 `ckg_cfs_decompiled.c`（132KB）共含 **约 62 个函数体**（`====` 分隔的函数），其余约 93 个符号在本 artifact 中仅以「Go 类型描述符 `type:.eq.*`（31 枚）」或「函数清单名称（无 C 体）」形式存在。因此本报告对 schema 的还原分两级：

- **L1 已还原（有 C 反编译体）**：ChildProvider 族、MemFs、各 *Node 实现、DefaultConfig、鉴权/工具函数、RemoteFs 的被调用签名（由 node 调用处反推）。
- **L2 接口级推断（仅名称 + Go RTTI 类型列表 + Go 惯用法 + 既有 harvest 报告枚举的方法集）**：`service.*` 全部 CRUD/Search、VNodeBuilder、VNodeFS、SimplePathRouter、RemoteFs 方法体、各 `*Request`/`*Response`/`MountInfo`/`SearchResult`/`StorageConfig` 字段布局。

> L2 推断以「`*推断*`」标注，字段名为基于命名与 ContextFS 通用模式的最佳还原，非逐字节确认。

---

## 1. 函数分组（8 组，合计 155）

| #   | 分组                                                                 | 函数数  | 代表函数                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **ChildProvider 族**（虚拟子节点供给器）                             | 12      | `(*CompositeChildProvider).GetChild/ListChildren`、`(*DiskChildProvider).*`、`(*MemChildProvider).*`、`(*MemoryChildProvider).*`、`(*RemoteChildProvider).*`、`(*StaticChildProvider).*`                                       |
| 2   | **MemFs**（纯内存文件系统）                                          | 17      | `(*MemFs).Mkdir/Read/Write/ReadDir/Stat/Remove/RemoveAll/Rename`、`getNode`、`getParentAndName`（+ 5 个 deferwrap 锁释放）                                                                                                     |
| 3   | **RemoteFs**（远程 FS，HTTP 客户端）                                 | 19      | `(*RemoteFs).Read/Write/Stat/ReadDir/Mkdir/Remove/RemoveAll/Rename`、`doRequest`、`checkResponse`、`getBaseURL`、`remove`（+ deferwrap）                                                                                       |
| 4   | **SimplePathRouter + VNodeBuilder**（虚拟路径路由 / 虚拟节点树构建） | 6       | `(*SimplePathRouter).Resolve/ListVirtualChildren`、`(*VNodeBuilder).BuildRoot/buildCompositeProviders/buildNode/parseChildrenList`                                                                                             |
| 5   | *_VNodeFS + 各 *Node 实现*_（统一虚拟 FS 与各节点类型）              | 49      | `(*VNodeFS).Mkdir/Read/Write/ReadDir/Stat/Remove/RemoveAll/Rename/ResolvePath/resolve`；`vnodeDirNode`/`diskDirNode`/`remoteDirNode`/`localFileNode`/`remoteFileNode`/`memFileNode`/`memoryDiskDirNode`/`memorySessionDirNode` |
| 6   | **service 层**（对外服务面 / JSON-RPC handler 门面）                 | 11      | `(*service).Health/ListDir/ListMounts/Mkdir/Read/Remove/Rename/Resolve/Search/Stat/Write`                                                                                                                                      |
| 7   | **鉴权与配置**                                                       | 10      | `CfsAuthFromContext`、`WithCfsAuth`、`DefaultConfig`、`NewContextFsService`、`expandHome`、`normalizeVirtualPath`、`parseMessageIds`、`init`                                                                                   |
| 8   | **请求/响应 DTO 与类型描述符**（`type:.eq.*`）                       | 31      | `BaseRequest`/`ListDirRequest`/`MkdirRequest`/`ReadRequest`/`RemoveRequest`/`RenameRequest`/`ResolveRequest`/`StatRequest`/`SearchRequest`/`StatResponse`/`SearchResult`/`MountInfo`/`FileInfo`/`StorageConfig`/`RouteRule` 等 |
|     | **合计**                                                             | **155** |                                                                                                                                                                                                                                |

---

## 2. 参数 Schema 摘要

### 2.1 核心接口契约（VNode 抽象，L1 还原）

所有 `*Node` 与 `*ChildProvider` 实现同一组接口，signature 由反编译体确认：

| 接口方法                           | 形参                               | 返回                 | 说明                                                                          |
| ---------------------------------- | ---------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `ChildProvider.GetChild`           | `ctx context.Context, name string` | `(VNode, error)`     | 按名取子节点；未命中返 `os.ErrNotExist` 风格错误                              |
| `ChildProvider.ListChildren`       | `ctx context.Context`              | `([]VNode, error)`   | 列举直接子节点                                                                |
| `VNode.Name()`                     | —                                  | `string`             | 节点名                                                                        |
| `VNode.IsDir()`                    | —                                  | `bool`               | 是否目录                                                                      |
| `VNode.ListChildren(ctx)`          | `ctx context.Context`              | `([]VNode, error)`   | 目录节点递归列举（委托给内部 provider）                                       |
| `VNode.GetChild(ctx, name)`        | `ctx, name`                        | `(VNode, error)`     | 目录节点取子                                                                  |
| `FileNode.Render(ctx)`             | `ctx context.Context`              | `([]byte, error)`    | 读取文件内容（local→`os.ReadFile`；remote→`RemoteFs.Read`；mem→`MemFs.Read`） |
| `FileNode.Write(ctx, data []byte)` | `ctx, []byte`                      | `(int64, error)`     | 写入；local 走 `os.MkdirAll`+`os.WriteFile(0644)`                             |
| `FileNode.Stat(ctx)`               | `ctx`                              | `(*FileInfo, error)` | 文件元信息                                                                    |

### 2.2 MemFs（L1 还原，内存树）

| 方法                   | 形参                            | 返回                  | 关键行为                                                                    |
| ---------------------- | ------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `Mkdir`                | `ctx, path string`              | `error`               | 沿 `splitPath` 逐段建目录节点（带 `RWMutex.Lock`）                          |
| `Read`                 | `ctx, path string`              | `([]byte, error)`     | `getNode`+`RWMutex.RLock`（defer 释放）；空目录节点返错                     |
| `Write`                | `ctx, path string, data []byte` | `(int64, error)`      | 建中间目录 + 写 `memNode.data`（`time.Now()` 打 `modTime`），返 `len(data)` |
| `ReadDir`              | `ctx, path string`              | `([]FileInfo, error)` | 遍历 `children` map，对每个子节点填 `FileInfo{Name,Size,IsDir,ModTime}`     |
| `Stat`                 | `ctx, path string`              | `(*FileInfo, error)`  | 文件取 `Size`(offset+0x10)、目录 `IsDir=true`                               |
| `Remove` / `RemoveAll` | `ctx, path string`              | `error`               | `getParentAndName` 取父+名，`mapdelete` 子键                                |
| `Rename`               | `ctx, path`                     | `error`               | 同名空间内移动（deferwrap 锁释放）                                          |

`memNode` 内部结构（由 `Write`/`Stat` 偏移反推）：`isDir bool`、`modTime time.Time`、`data []byte`、`children map[string]*memNode`。

`splitPath(path)`：以 `/` 切分并丢弃空段，返 `[]string`（L1 还原）。

### 2.3 RemoteFs（L1 还原调用签名；方法体在本 artifact 未反编译）

由 `remoteFileNode`/`remoteDirNode` 调用处反推：

| 方法      | 形参                            | 返回                  |
| --------- | ------------------------------- | --------------------- |
| `Read`    | `ctx, path string`              | `([]byte, error)`     |
| `Write`   | `ctx, path string, data []byte` | `(int64, error)`      |
| `Stat`    | `ctx, path string`              | `(*FileInfo, error)`  |
| `ReadDir` | `ctx, prefix string`            | `([]FileInfo, error)` |

辅助方法（命名推断）：`doRequest`（组装 HTTP 请求）、`checkResponse`（校验状态码/错误体）、`getBaseURL`（取远端基地址）、`remove`。行为指示其为一个 **HTTP 客户端 FS**（远端 CFS 服务），与 `sqlite3_vec_*` 共同构成「远端索引 + 本地向量」的混合存储。

### 2.4 VNodeFS + 路由（L2 接口级）

`VNodeFS` 是统一虚拟根 FS，方法集与 MemFs 同构：`Mkdir/Read/Write/ReadDir/Stat/Remove/RemoveAll/Rename`；额外 `ResolvePath(path)`、`Resolve(req)`、`resolve(...)` 做路径→节点的解析（委托 `SimplePathRouter.Resolve` + 各 provider）。

`SimplePathRouter`：`Resolve(ctx, path) (VNode, error)`、`ListVirtualChildren(ctx) ([]VNode, error)`——将虚拟路径前缀路由到对应 provider（disk/mem/remote/composite）。

`VNodeBuilder`：`BuildRoot()` 依据 `Config.VNodes` 与 `Config.Routes` 构造虚拟树；`buildCompositeProviders` 把多个 provider 组合为 `CompositeChildProvider`；`buildNode`/`parseChildrenList` 递归装配子节点。

### 2.5 service 层（L2 接口级，11 个）

`(*service)` 是面向宿主（Trae 主进程经 `BP_*` 桥接）的统一入口，普遍采用 **Request DTO 入参 / Response DTO 出参** 模式：

| 方法（推断签名） | 入参                   | 返回（推断）                                    |
| ---------------- | ---------------------- | ----------------------------------------------- |
| `Health`         | `ctx`                  | `(*HealthResponse, error)` 或 `error`           |
| `ListDir`        | `ctx, *ListDirRequest` | `(*ListDirResponse{Entries []FileInfo}, error)` |
| `ListMounts`     | `ctx`                  | `([]MountInfo, error)`                          |
| `Mkdir`          | `ctx, *MkdirRequest`   | `error`                                         |
| `Read`           | `ctx, *ReadRequest`    | `([]byte, error)`                               |
| `Remove`         | `ctx, *RemoveRequest`  | `error`                                         |
| `Rename`         | `ctx, *RenameRequest`  | `error`                                         |
| `Resolve`        | `ctx, *ResolveRequest` | `(*ResolveResponse, error)`                     |
| `Search`         | `ctx, *SearchRequest`  | `([]SearchResult, error)` 或 `*SearchResponse`  |
| `Stat`           | `ctx, *StatRequest`    | `(*StatResponse{Info *FileInfo}, error)`        |
| `Write`          | `ctx, *WriteRequest`   | `error`                                         |

### 2.6 核心 DTO / 配置结构体（L1/L2）

**`FileInfo`**（L1 多源确认）：`Name string` · `Size int64` · `IsDir bool` · `ModTime string`（格式 `"2006-01-02T15:04:05Z"`）。

**`StorageConfig` / `Config`**（L1 由 `DefaultConfig` 反推）：

```
Config {
  Storage  StorageConfig
  MaxFileSize int64          // 0x6400000 = 100 MiB
  VNodes  map[string]VNodeConfig   // key: "history"(remote) / "memory"(memory)
  Routes  [2]RouteRule
}
StorageConfig { DataDir string }   // 默认 expandHome("~/.contextfs/data")
VNodeConfig  { provider string; config map[string]any }  // provider ∈ {remote, memory, disk}; config 含 "prefix"
RouteRule    { From string; To string }   // 例 From="trae://history"(13B)，To 为本地映射路径
```

`DefaultConfig` 实证默认挂载：`history → {provider:"remote", prefix:<remote>}`、`memory → {provider:"memory", prefix:"memory"}`，并预置 2 条 `RouteRule`（虚拟协议 `trae://*` → 本地路径）。

**`*Request` 系列**（L2，仅字段名推断，均含 `BaseRequest` 嵌入）：

- `BaseRequest`：推测含 `Path string` 与鉴权上下文派生字段（由 `CfsAuthFromContext` 两 key 注入）。
- `SearchRequest`：推测 `Query string` / `TopK int` / `ScoreThreshold float` / 作用域（workspace/knowledge 模式，呼应 `SearchWorkspace`/`SearchKnowledge`）。
- `ReadRequest`/`WriteRequest`/`StatRequest`/`ListDirRequest`/`MkdirRequest`/`RemoveRequest`/`RenameRequest`/`ResolveRequest`：含 `Path`（及 Write 含 `Data`）。

**`SearchResult` / `StatResponse` / `MountInfo`**（L2 名称级）：`SearchResult` 推测 `{ Path/Content/Score/... }`；`StatResponse{ Info *FileInfo }`；`MountInfo` 推测 `{ MountPoint/Provider/... }`。

### 2.7 鉴权与配置函数（L1 还原）

| 函数                                       | 形参                                           | 返回                                             | 行为                                                                                  |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `WithCfsAuth`                              | `ctx, tokenKey, tokenVal, wsKey, wsVal string` | `context.Context`                                | 向 ctx 注入两个 `cfsContextKey` 值（令牌 + workspace 标识），对应 `context.WithValue` |
| `CfsAuthFromContext`                       | `ctx`                                          | `(token string, workspace string)`（32B struct） | 从 ctx 取回两 key；缺省返空串                                                         |
| `DefaultConfig`                            | —                                              | `*Config`                                        | 构造默认 `Config`（见 2.6）                                                           |
| `NewContextFsService`                      | `*Config`（推断）                              | `*service`                                       | 用 Config 装配 service（含 VNodeFS/VNodeBuilder）                                     |
| `expandHome`                               | `path string`                                  | `string`                                         | `~` 展开为用户主目录（`os.UserHomeDir`）                                              |
| `normalizeVirtualPath` / `parseMessageIds` | 路径/消息 id（推断）                           | 规范化结果 / 解析出的 id 列表                    | 虚拟路径归一化、消息 id 解析（deferwrap 锁释放）                                      |

---

## 3. 与本仓（IHUI-AI）对位

本仓 `apps/ai-service`（Python 后端）+ `packages/api-client/src/endpoints/knowledge-rag.ts`（TS 客户端）已具备检索/向量/上下文层。以下为可对照/对位的接口（均为**行为层面对位，非代码移植**）。

| #   | Trae ContextFS 接口（L1/L2）                                                                | IHUI-AI 对位接口                                                                                                                                              | 对位度             | 建议                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `service.Search(*SearchRequest)` → `[]SearchResult`                                         | `searchKnowledge({query, collectionName?, topK?, scoreThreshold?})` → `KnowledgeSearchHit{id,docId,content,score,chunkIndex}`（`POST /api/knowledge/search`） | **强**             | CFS `Search` 是 ContextFS 的统一检索面，底层由 `sqlite3_vec_*` 提供向量相似度；直接对应本仓语义检索。建议复用本仓 `scoreThreshold`/`topK` 语义校验 CFS Search 的返回结构。                          |
| 2   | `service.Search` + `FileNode.Render`/`Read`                                                 | `getKnowledgeRagContext({query, collectionName?, topK?})` → `{context, hasResult}`（`POST /api/knowledge/rag-context`）                                       | **强**             | CFS「先 Search 得路径→再 Read 取内容→拼上下文」即本仓 RAG 上下文合成流程。对位一致。                                                                                                                |
| 3   | `service.Write`/`Mkdir`/`Resolve`（含 `memory` 与 `remote` provider）                       | `ingestKnowledgeText` / `uploadKnowledgeDoc`（≤20MB，含 `collectionName`）                                                                                    | **中**             | CFS 用 `VNodeConfig.provider` 区分「内存会话上下文」(`memory`) 与「远端 workspace」(`remote`)；本仓 `collectionName` 承担类似分区语义。建议将本仓 `collectionName` 映射为 CFS 的 VNode mount 分区。 |
| 4   | `SimplePathRouter.Resolve` + `DiskChildProvider`/`RemoteChildProvider`                      | `SearchWorkspace`（本仓检索/ContextFS 检索面，见既有 harvest 报告 `alwaysAllow` 列表）                                                                        | **强**             | CFS 用统一虚拟路径空间挂载 disk+mem+remote；对应本仓「workspace 级检索 + 虚拟上下文面」。建议对齐路径规范化策略（`normalizeVirtualPath`）。                                                         |
| 5   | `CfsAuthFromContext` / `WithCfsAuth`（ctx 注入 token + workspace 双 key）                   | 本仓 auth 中间件（cookie / `Authorization` header → userId，见 `knowledge-rag.ts` 注释）                                                                      | **强**             | 两者均在请求上下文注入「身份 + 工作区」二元信息。建议对齐为统一 `userId`+`workspaceId` 上下文键模型。                                                                                               |
| 6   | `StorageConfig.MaxFileSize = 100 MiB`                                                       | 本仓知识库上传 ≤ 20MB（`uploadKnowledgeDoc` 注释）                                                                                                            | **中**             | 配额口径不同（CFS 更宽松），可对位做上传前尺寸门禁一致性校验。                                                                                                                                      |
| 7   | `sqlite3_vec_init` / `sqlite3_vec_numpy_init` / `sqlite3_vec_static_blobs_init`（导出符号） | 本仓向量/embedding 层（b42 本地 embedding 路线）                                                                                                              | **强（架构级）**   | CFS 的向量相似度检索直接依赖 sqlite-vec 扩展；本仓可对照其「sqlite 向量后端 + 钩子（commit/update/rollback/preUpdate/step Trampoline）」的落地方式，作为本地向量化的参考架构。                      |
| 8   | `BP_GetInterface` / `BP_Initialize` / `BP_Shutdown`（C-ABI 桥接）                           | 本仓 MCP/JSON-RPC 服务暴露方式                                                                                                                                | **中（桥接模式）** | CFS 经 `BP_*` 由宿主进程加载并桥接调用；本仓可参照其「单一桥接入门 + 初始化/关闭生命周期」设计对外暴露检索面。                                                                                      |

**结论：可对本仓对位的接口 = 是，约 8 处（其中强对位 5 处：检索/向量/RAG 上下文/鉴权双键/桥接生命周期）。**

### 3.1 对位增强建议（供后续轮次）

1. 本仓 `searchKnowledge` 已覆盖 CFS `service.Search` 语义；可进一步用 CFS `RouteRule` 的「虚拟协议→本地路径」机制，为不同 `collectionName` 建立可视化挂载点。
2. CFS `memory` provider 对应「会话级上下文」，可对齐本仓 agent 运行期的临时上下文注入，避免每次重算。
3. `sqlite3_vec_*` + `*HookTrampoline` 的「向量索引 + sqlite 提交钩子」组合，是 b42 本地 embedding 路线的成熟参照实现，建议作为架构对照蓝本。

---

## 4. 红线声明

1. **未粘贴对方专有源码**：全文仅呈现反编译产物的**接口签名、形参/返回类型、结构体字段名与行为归纳**，未整段或整句复制 `ckg_cfs_decompiled.c` 的 C 实现原文。
2. **未提取任何凭据**：`WithCfsAuth`/`CfsAuthFromContext` 仅归纳「ctx 注入 token+workspace 双键」的**机制**，未记录任何具体令牌、密钥、JWT 或用户标识值；`DefaultConfig` 中出现的字符串常量（如 `trae://history`、`~/.contextfs/data`）均为公开的默认配置路径，非敏感凭据。
3. **仅行为/接口层面对位**：第 3 节所有对位均为「能力对照 + 字段语义映射」，不构成对 Trae 专有代码的移植或引用。
4. **覆盖度透明**：L1（有 C 体）与 L2（仅名称/类型推断）已显式区分；`service.*`、VNodeBuilder、VNodeFS、RemoteFs 方法体、各 `*Request`/`SearchResult`/`StorageConfig`/`MountInfo` 字段布局在本 artifact 中**未反编译**，相关 schema 为接口级最佳还原，需后续 Ghidra 深挖确认。

---

## 附：导出符号桥接层（来自 `ckg_exports.txt`）

| 符号                                                                                             | 角色                      | 对位意义                                    |
| ------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------- |
| `BP_GetInterface` / `BP_Initialize` / `BP_Shutdown`                                              | C-ABI 桥接入门            | 宿主加载 Go 二进制并桥接调用 ContextFS 服务 |
| `sqlite3_vec_init` / `sqlite3_vec_numpy_init` / `sqlite3_vec_static_blobs_init`                  | sqlite 向量扩展初始化     | 向量相似度检索后端（对照本仓向量层）        |
| `authorizerTrampoline` / `*HookTrampoline`（commit/update/rollback/preUpdate/step）              | sqlite 提交/更新/回滚钩子 | 索引写入的一致性与钩子机制                  |
| `go_ahanet_on_*_bridge` / `go_bp_ipc_client_on_message` / `go_on_connected/disconnected/message` | IPC / 网络桥接            | 远端 FS / 跨进程通信通道                    |

> 注：`Ordinal_1..23` 为 Windows 导出序数占位，无独立语义。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
