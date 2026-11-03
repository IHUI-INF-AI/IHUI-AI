<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T5 — goal-b42:toolhost 反编译 + G7 本地 embedding 回落落地 + T2§8 缺口现状全盘点

> 席位:goal-b42(目标同字重发,承接 goal-b41;只读取证 + 落地)。
> 与 T4 分工:T4 = libckg/导出表/solo-mcp;T5 = toolhost.dll(95MB)反编译、Qoder browser-connector(b41 零接触面)、contextfs DefaultConfig 清账、G7 落地。
> 结论三态同 T4 口径。

## 1. T2 §8 缺口现状全盘点(2026-10-31 12:0x 现读)[观察]

goal 同字重发时的逐条对撞(本席开批审计,防重复劳动):

| 条 | 内容 | 现读判定 | 证据 |
| --- | --- | --- | --- |
| G1 | 编辑器事件驱动索引 | **已落地**(并行席,2026-10-31) | `context_engine.py` editor_state 完整入参(cursor_line/selection,门控默认关,头注明引 T2§1.3) |
| G2 | ContextFS | **已落地**(goal-b41 本席) | knowledge_fs.py + api chunks/file 端点 ∈ origin(main 6b25542a759) |
| G3 | 沙箱拦截计量 | **已落地**(并行席) | `proc_sandbox.py` 头注「计量与版本可追溯(2026-10-31 立,§5e-3)」+ `sandbox_metrics.py` + `sandbox_tags.py` |
| G4 | AI 归属 git notes | **已落地** | `scripts/lib/ai-authorship-notes.mjs` + `scripts/record-ai-authorship.mjs` |
| G5 | browser scope/防重放 | **形态不同,等价物已在** | `capability_gate.py`/`mcp_official.py` 的 verify_scope/scope_of 面(MCP 能力闸形态);browser_hub 动作端点租约格维持登记 |
| G6 | stall/retryable 词表 | **已落地** | `packages/types/src/agent-failure-vocabulary.ts`(AGENT_STALL_STAGES + AGENT_FAILURE_OUTCOMES 三值含 undetermined)+ Python 镜像出口 `agent_failure_vocabulary.py`(单一真相源跨语言) |
| G7 | 本地 embedding 回落 | **本席本轮落地**(唯一空白) | 见 §3 |
| G8 | announce_mutation_action | **登记不落地** | `ExecParams` 全仓零消费方,加字段=死代码(守门 121 精神);对侧 `trae.computer-use.windowsPresentation` default true 的语义登记在案,待执行层(消费 ExecParams 的执行器)落地时同批带字段 |

⇒ T2 §8 八条在 2026-10-31 当天内全部收口(七条落地 + 一条登记),无遗留「有人该做没人做」格。

## 2. 取证增量 [观察]

### 2.1 Qoder browser-connector(v1.7.6,b41 零接触面)

- 形态:**Chrome 扩展**(非 Trae 的 Rust 原生 browser-bridge);manifest 权限 = `debugger` + `<all_urls>` + `history` + `clipboardRead/Write` + `nativeMessaging` + `sidePanel` —— CDP 全站接管 + 剪贴板读取的重权限面。
- 宿主通道:native messaging(`connectNative` ×5)+ WebSocket(60 处,wss ×7);native host 名四候选逐字:`com.aicoding.browser_connector` / `com.qoder.app.connector` / `com.qoder.work.connector` / `com.qoder.browser.connector`(`com.qoder.browser_connector`;aicoding = icube 系内部名)。
- 授权模型(95 locales 键现读):**按标签页粒度显式连接**——「连接当前标签页」「已连接的标签页」「重试连接」「正在检测连接状态…」;与 Trae browser-bridge 的 HMAC/scope/nonce(T2 §3)与 T2 §8-G5 的四道拒绝串是三种不同形态:Qoder = 用户显式逐页授权,Trae = 密码学边界,本仓 = CDP 直连(能力闸在 MCP 面)。
- background.js(301,540 B)未混淆到不可读程度(字符串可提取),行为面逐函数审计留时间盒外。

### 2.2 contextfs DefaultConfig 逐字段清账(T4 §5-4 清账完成)[观察]

反编译(`ckg_cfs_decompiled.c`,源码锚 `config.go:41`):
- **默认数据根 = `~/.contextfs/data`**(经 `expandHome` 展开,函数独立存在)。
- **Config = RouteRule 路由表**:`map[string]VNodeConfig`(虚拟路径名 → 节点配置),每节点 `{prefix, kind}`;**默认路由只挂一条:`"history"` → kind `"remote"`** —— 会话历史默认投影自远端 provider(与 T2 §1.4 的 RemoteFs 对上),其余挂载点由 IDE 侧经 RPC 动态下发行。
- 结论:ContextFS 的挂载形态 = **静态默认路由 + 动态 RPC 挂载**的组合;本仓 knowledge_fs 单后端投影的差距面(T4 §3.3)进一步收窄为「动态挂载协议」一格,登记不落地(无真实多后端需求)。

### 2.3 toolhost.dll(95MB)Ghidra headless 反编译 [未知·进行中未完成]

- headless 任务已启动(脚本 `toolhost_surface.java`:导出/命令域分布/dispatch 反编译 ≤40)并完成导入与自动分析,但**逐函数反编译段截至本报告收口(启动后 65+ 分钟)仍未出产物** —— Go 大函数的 DecompInterface 逐个 30s 预算 × 40 目标,时间盒内不可达。按 §0.3 如实登记「未完成」,不冒充已挖穿;产物目录 `D:/DevEnv/Temp/ihui-scratch/goal-b42-ghidra/`(scratch,6h 老化),后续席位按 T4 §3 同款流程回填。
- 结论口径:toolhost 的最底层事实**本轮未取得**,维持 T1 字符串层结论(120 命令全集);「挖到最底层」在 toolhost 这一件上为**部分达成**(分析层完成、反编译层未完成)。

## 3. G7 落地:本地 embedding 回落档(先对齐再超越)[观察]

- 对齐:`-local_embedding -embedding_storage_type=sqlite_vec` 是 Trae ckg 的**命令行常量**(T2 §1.3)—— 本地向量化是常开能力;本仓原形态索引在本地、向量在远端,离线/欠费即退化(向量面整批落空,只剩 keyword 腿)。
- 落地(全链五处):
  1. `packages/database/drizzle/20261031120000_codebase_embedding_provider.sql`(idx 359):`codebase_chunks.embedding_provider varchar(32)`——'remote' | 'local-hash' | NULL(存量行不回填不猜测)。
  2. drizzle schema `codebaseChunks.embeddingProvider`(journal 同批登记)。
  3. api 侧:`ChunkInput.embeddingProvider`(zod 白名单双值,杜绝自由文本冒充通道身份)+ rows 落列 + `indexChunks` 返回 `localEmbedded` 计数 + search/hybrid 的 SearchResult 带出 provider。
  4. `llm_gateway.embed_local_fallback(text)`:**1536 维 char-trigram 哈希投影**(hashing trick,SHA-1 非安全用途),L2 归一、确定性可测、零网络零派生零第三方依赖;空文本如实全零(L2=0 不编造方向)。头注写明维度约束:pgvector 列固定 1536,非 1536 维本地神经模型(bge 等)结构上不可入列 ⇒ 哈希档是唯一的零依赖兼容形。
  5. `codebase_indexer._generate_embeddings_batch`:远端失败分支不再整批落空 → 本地回落 + `embedding_provider='local-hash'`;成功分支标注 'remote';payload 带 `embeddingProvider`。
- **超越轴**:①来源可识别(DB 列 + 返回计数 + 检索结果带出,对侧取证未证到来源标注);②不冒充(头注/列注释双层「无神经语义精度」声明,§0.3);③确定性可测(同文本恒同向量)。
- 测试:`tests/test_codebase_embedding_fallback.py` **6/6 GREEN**(确定性/维度/归一/空文本诚实/出口形态锁「禁网络与派生符号」/远端失败回落+标注/远端成功标 remote;全程 monkeypatch 不连网不连库)。

## 4. 未取到的面(如实)[未知]

1. harness.dll(248MB)/ ai_agent.dll(282MB):headless 路径可行但单件 >1.5h,时间盒外;toolhost(95MB)本轮覆盖。
2. Qoder background.js 逐函数行为审计(301KB,字符串层已取,函数级时间盒外)。
3. Cfs* per-method 参数 schema(维持 T4 §5-2 口径)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
