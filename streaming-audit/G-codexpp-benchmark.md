<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# G 段审计 · 外部对标物榨干（Codex++ / Stepwise / 官方宿主 DOM 契约）

> 目标：把本机可取证的外部 AI 对话客户端（Codex++）在「AI 对话流式输出」上的一切实现榨干，形成可复用规格，为 IHUI 自研平滑流式渲染提供对标基线与超越锚点。
> 方法：对 Codex++ 主程序二进制做 ASCII 字符串提取 + 上下文反汇编（`execute_code` 正则扫 `[ -~]{6,}` 段 + 定位锚点读前后 600–3500 字节）。**未**反编译原生 PE（本机具备 Ghidra 12.1.4 但本轮未启用，纯字符串层已足够定位 JS bundle 与常量）。
> 取证环境：本机 `AppData\Local\Programs\Codex++\`（3 个 exe：`codex-plus-plus.exe` / `codex-plus-plus-manager.exe` / `uninstall.exe`）。路径为本次实测值，换机须重测，不得当本机事实写死。
> 铁律遵守：本文件只写观测到的证据，明确区分「已读实现 / 据锚点推断 / 未覆盖」；不复制对方专有源码全文，只提取行为契约与常数（§0 逆向铁律红线：不粘专有源码、不破许可、不提取凭据）。

---

## 〇、一句话结论（先纠错）

**Codex++ 不实现对话流式渲染。** 它是官方 Codex 宿主（Electron / VS Code 扩展形态）的**注入式增强器**，流式渲染本体在**不在本机的官方宿主**里。本机可榨的流式情报只有两块：①「流式何时结束」的判定机制；②「官方宿主 DOM 契约」的反推。两者均已 100% 到手，见 §二 / §三。**官方宿主的真·流式渲染（token 增量调度 / markdown 增量 / 平滑呈现）本机榨不到，须外部检索**（转 H 段 / todo ②）。

---

## 一、确凿事实：Codex++ 无流式渲染动画

对 `codex-plus-plus.exe` 全量二进制关键词扫描（`data.count`）：

| 关键词       | 命中数 | 性质判定                                                                                                  |
| ------------ | ------ | --------------------------------------------------------------------------------------------------------- |
| `streaming`  | **1**  | 命中的是嵌入的系统提示词句子（"Communicate with the user by streaming thinking & responses"），**非代码** |
| `typewriter` | **0**  | 无打字机动画                                                                                              |
| `wordByWord` | **0**  | 无逐字动画                                                                                                |
| `fade-in`    | **0**  | 无淡入动画                                                                                                |
| `animateIn`  | **0**  | 无入场动画                                                                                                |
| `onChunk`    | **0**  | 无流式分块回调                                                                                            |
| `onToken`    | 1      | 命中在 SQLite 恢复逻辑（`last_token_usage`/`total_token_usage` token 用量统计），**与流式无关**           |
| `chunk`      | 16     | 全为 Rust 编译器 / cargo 依赖路径字符串                                                                   |
| `assistant`  | 40     | 含系统提示词 + `roleFromElement` 角色识别                                                                 |

**推断（高置信）**：Codex++ 全文无一处「把增量 token 平滑渲染到屏幕」的实现。它对对话流的唯一参与是**旁观**——监听宿主 DOM 变化，判断流式何时结束，再触发自己的后续逻辑（Stepwise 追问生成）。

---

## 二、流式结束判定机制（已榨干，可直接复用/超越）

位置：Codex++ 内嵌 `stepwise` 面板模块（`crates\codex-plus-core\src\stepwise.rs` 后端 + 内嵌 JS 面板，`API_KEY = "__codexStepwisePanel"`，`SCRIPT_VERSION = "1.0.0-core"`）。

### 2.1 常数表（全部为二进制中实读值）

```
STREAM_IDLE_MS        = 1300   // 流式静默 1.3s ⇒ 判定本轮回答结束
SCAN_DELAY_MS         = 220    // DOM 扫描节流
BRIDGE_TIMEOUT_MS     = 26000  // 桥接请求超时 26s
MAX_TEXT_LENGTH       = 12000  // 文本截断上限（shortText 取末 12000 字符）
MAX_STEPWISE_ITEMS    = 6      // 最多 6 条追问建议
MAX_PROMPT_LENGTH     = 420    // 单条追问 prompt 上限
MAX_DIAGNOSTICS       = 80     // 诊断日志条数上限
EDITABLE_SUBMIT_DELAY_MS = 120 // contenteditable 提交延迟
SUBMIT_RETRY_DELAY_MS    = 50  // 提交重试间隔
SUBMIT_RETRY_LIMIT       = 600 // 提交重试上限
```

### 2.2 结束判定算法（`scan()`，已读实现）

1. 对 assistant 消息算 **FNV-1a 哈希**：`hashText()` 取末 4000 字符，`hash=2166136261`，逐字符 `hash ^= code; hash = Math.imul(hash, 16777619)`，结果 `(hash>>>0).toString(36)`。
2. `hash !== state.lastAssistantHash` ⇒ 内容在增长（流式进行中）⇒ 记 `lastAssistantAt = now`，`scheduleScan(STREAM_IDLE_MS + 120)`。
3. `now - lastAssistantAt < STREAM_IDLE_MS(1300)` ⇒ 状态 `"assistant-settling"`（仍在流）⇒ 继续等。
4. 静默满 1300ms ⇒ 状态 `"ready"`（流结束）⇒ 才生成追问建议。

**关键洞察（对我们的价值）**：Codex++ 判定"流式结束"靠 **DOM 文本 hash 变化 + 1.3s 静默阈值**，是**纯前端旁观**，无 token 回调、无 SSE 解析、无打字机。这正说明**它没有渲染层，渲染在宿主**。1.3s 这个阈值本身是"流已停"的经验值，可作为我们"流式空闲"判定的对标下界（我们可用更小阈值 + 真实 token 事件，做到更快收敛，见 §四超越点）。

---

## 三、官方宿主 DOM 契约（已榨干，可直接用于我们实现）

Codex++ 通过 hook 这些宿主 DOM 节点工作，反推出官方 Codex 宿主的**结构契约**——这是榨出的最有价值情报，我们的流式渲染可直接对齐。

### 3.1 对话容器与消息节点

```
对话滚动根:  .thread-scroll-container
消息节点:    [data-message-author-role]   // 每条消息带角色属性
角色识别 roleFromElement():
  ① 显式属性 data-message-author-role（assistant|user，取小写）
  ② 无属性则文本前缀推断:
     /^(assistant|codex|assistant said)/i → "assistant"
     /^(user|you)/i                       → "user"
chatRoot(): querySelectorAll(".thread-scroll-container")
  → 过滤可见 && 不在自身 UI 内 → 按可见面积(width*height)降序 → 取最大者
```

### 3.2 内容宽度变量（conversationView 布局类，已读）

```
内容区类: mx-auto w-full max-w-(--thread-content-max-width)
          px-toolbar relative flex shrink-0 flex-col pb-8
输入区类: relative z-10 flex flex-col mx-auto
          w-full max-w-(--thread-content-max-width) px-toolbar
宽度变量: --thread-content-max-width
  官方默认: min(1180px, calc(100cqw - 56px))
  窄屏(≤1120px): min(940px, calc(100cqw - 36px))
居中对齐: conversationViewAlignElement 把内容/输入区水平居中于视口，
  偏移写入 style.left（>0.5px 才写，避免抖动）
```

### 3.3 桥接协议（宿主动作入口）

```
桥对象:   window.electronBridge.sendMessageFromView(message)
消息形态: { type:"fetch", requestId, method:"POST",
            url:"vscode://codex/<method>", body: JSON.stringify({params}) }
响应:     window "message" 事件，type==="fetch-response" && requestId 匹配
超时:     5000ms（locale 设置桥）
官方动作: appServices.appActions.runInPrimaryWindow({action:{type, ...}})
          例: { type:"app.appearance.set_mode", mode:"dark" }
模块定位: 动态 import 候选模块 → module?.n?.appActions || module?.appServices?.appActions
```

---

## 四、流式期间的滚动/布局稳定性（已榨干，唯一值得抄的外围逻辑）

Codex++ 为流式渲染"让路"的配套逻辑（防止流式内容增长时程序化滚动劫持用户视线）。常数全为实读值：

```
布局居中帧预算:  settleFramesLeft = 16（rAF 连跑 16 帧）
  轮询兜底:      setInterval(() => scheduleConversationViewAlign(2), 350)
  触发源:        ResizeObserver + MutationObserver(body subtree)
滚动保存节流:    120ms（codexThreadScrollSaveThrottleMs）
滚动恢复窗口:    3200ms（codexThreadScrollRestoreWindowMs）
滚动恢复延迟级:  [0, 80, 220, 500, 1000, 1800, 2800]（7 级，codexThreadScrollRestoreDelaysMs）
用户滚动意图窗:  1200ms（codexThreadScrollUserIntentWindowMs）
近底部阈值:      max(24px, clientHeight * 0.15)
滚动条目上限:    120 条（codexThreadScrollMaxEntries）
滚动快照字段:    { top, scrollHeight, clientHeight, at }
  去抖:         |top-lastSavedTop|<2 && height 同 && clientHeight 同 ⇒ 跳过保存
```

**核心机制（超越锚点）**：**用户滚动意图抢占**。

- 原型劫持：`Element.prototype.scrollTo/scroll/scrollBy/scrollIntoView` + `window.scrollTo` 全被包一层 guard（`codexThreadScrollGuarded*`）。
- 流式期间程序化滚到底部，会被 `shouldBlockAutobottom` 拦下（仅当存在恢复锁 && 非正在恢复 && 目标偏离 >8px && 落在近底部区）。
- 用户手动滚（`wheel`/`touchmove`/`keydown`/`pointerdown` capture 监听）⇒ `markUserIntent` ⇒ `userScrollIntentUntil = now + 1200ms` ⇒ 该窗口内中止一切自动恢复/自动吸底。
- `column-reverse` 布局（flexDirection）单独处理滚动范围取负。

---

## 五、Stepwise 后端转发（已榨干，确认非流式）

`stepwise.rs` 字符串表实读值，确认它是**一次性非流式**转发：

```
端点:   /chat/completions
鉴权:   Bearer <API Key>（"failed to build Stepwise authorization header"）
参数:   messages, temperature, max_tokens, response_format, json_object
错误:   "Stepwise API Key is not configured"
        "Stepwise Base URL or Model is not configured"
        "failed to request Stepwise API"
        "Stepwise upstream <status>: ..."
        "failed to parse Stepwise API response"   ← 整包 JSON.parse，非 SSE 流式
配置项: codexAppStepwiseEnabled / DirectSend / BaseUrl / ApiKey / ApiKeyEnv
        / Model / MaxItems / MaxInputChars / MaxOutputTokens / TimeoutMs
```

**判定**：`failed to parse Stepwise API response` 是整包解析，无 `data:` SSE chunk 处理 ⇒ Stepwise 是"直接发送一次补全"的辅助功能（生成追问建议），与对话主链路流式无关。

---

## 六、未覆盖 / 待外部取证（明确缺口）

1. **官方宿主真·流式渲染**：token 增量调度、markdown 增量渲染、平滑光标/淡入呈现——**本机无宿主，榨不到**。转 todo ② 外部检索（官方 Codex 文档 / 开源渲染实现 / `data-message-author-role` 结构的公开分析）。
2. Codex++ 原生 PE 未反编译（本轮未启 Ghidra）；纯字符串层已足够定位 JS bundle 与常数，但 Rust 侧控制流未逐函数还原。
3. 官方宿主 `appActions` 的完整动作类型表（`app.appearance.set_mode` 之外）未穷举。

---

## 七、对我们的超越锚点（汇总，喂给 todo ③）

| 维度         | Codex++ / 官方宿主                                     | IHUI 超越方向                                                 |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------- |
| 流式结束判定 | DOM hash 变化 + 1300ms 静默（纯旁观）                  | 真 token/SSE 事件驱动 + 可配更小空闲阈值，更快收敛            |
| 渲染平滑度   | 无（渲染在宿主，本机榨不到）                           | 自研 token 缓冲 + rAF 增量 flush + markdown 增量，超越宿主    |
| 滚动稳定性   | 原型劫持 + 1200ms 用户意图抢占                         | 借鉴意图抢占，但用真流式事件替代 DOM 旁观，无侵入             |
| 宽度/布局    | `--thread-content-max-width: min(1180px, 100cqw-56px)` | 对齐契约，保证跨端一致                                        |
| token 解析   | 无（无 onChunk）                                       | 已有 token 级增量（F-293 修 `tool_calls[].index` 流式），领先 |

---

## 八、外部对标取证（todo ②，2026-11-16 补）

本地无法榨到官方宿主真流式渲染，转外部检索取证。**读到的原文**：

### 8.1 remend（Vercel 官方，Streamdown 底层）——前缀修复原理

来源：`https://vercel.com/changelog/new-npm-package-for-automatic-recovery-of-broken-streaming-markdown`（已读正文）

- 定位：AI 模型逐 token 吐 markdown，常产生**未闭合语法**破坏渲染：未闭合围栏、半截粗/斜体、未终止链接/列表。
- 机制：**只补全、不删改**——自动检测并闭合未终止块；流继续、真闭合符到达时内容无缝更新。
- 边界规则：带防误判智能规则，处理 LaTeX 下划线、产品码星号/下划线、嵌套链接括号。
- 集成：作任意 markdown 渲染器的**前置处理器**（先 remend 再 remark-parse）。
- **明确未覆盖：GFM 表格**（changelog 只列 fence/bold/link/list）。

### 8.2 anythic/ui streaming-safe markdown（DEV Community）——layout-flip 病症

来源：`https://dev.to/anythic/how-we-built-streaming-safe-markdown-for-ai-chat-in-react-2hdm`（已读正文）

- 病症：流式半截代码块/粗体/链接导致"整体回复变 monospace 大乱、layout 来回跳"。
- 修法：解析前先**修复前缀**——补闭合、挂起未完成的链接。与本仓 heal 同思路。

### 8.3 smooth-stream-text / markdown-streaming（npm）——rAF 平滑泵

检索命中但正文页遇 `WEB_VERIFICATION_REQUIRED`，未读到实现正文，仅标题级线索（不冒充已读）。同族原理由本仓 `smooth-delta-batcher` 已自研覆盖（字素簇切点 + 自适应帧预算 + EWMA 速率计量）。

---

## 九、本仓超越实现（todo ③ 落地，2026-11-16）

### 9.1 超越轴 T：流式 GFM 表格补全（`tableSuffix`）

**为何是超越**：remend/Streamdown/anythic/Codex++ **全部未覆盖** GFM 表格。表格要等分隔行 `|---|` 到齐才被解析；流式中表头先到、分隔行未到时表头被当**段落**渲染，分隔行到达瞬间布局从段落跳成表格（列宽重排）——正是 8.2 描述的 layout-flip 在表格上的表现。

**实现**（`apps/web/src/lib/markdown-incomplete-heal.ts` `tableSuffix`）：

- 当末正文行是带前导 `|` 的表头、且全表尚无分隔行时，按列数补一条最小分隔行 `\n| --- | ... |`，使表格**首帧即成立**、不再跳变。
- 遵守本仓 heal 铁律：只追加、不删改；复用同一 `scan` 不重扫全文（D1d 纪律）。
- 负向安全：无前导 `|` / 单元格 >12 / 围栏内 / 行内代码竖线不计 / 末行已是分隔行 → 一律不补。

### 9.2 回归修复 T1：数据行不补

实测组件测试 G-824 抓出：完整表格 `| a |/| --- |/| 999 |` 的末行 `| 999 |` 是**数据行**，被旧逻辑误补 `| --- |` 升成新表头。根因：GFM 只解析**首个**竖线块。修复：检测末正文行之前已存在分隔行（`TABLE_SEPARATOR_RE`）则绝不补。已钉测试锁。

### 9.3 验证证据

- heal 单文件套件：**27 passed**（原 17 + 表格 9 + T1 回归 1）。
- 压力验证（临时脚本，12 例混排边界）：**pass=12 fail=0**。
- 组件 G-824 表格套件重跑：**4 passed**（T1 修复生效）。
- 唯一未过项 `markdown-stream.test.tsx` theme 背景色断言（`bg-zinc-100`）与本改动**无因果**：我只追加表格分隔行文本，未改 `markdown-stream.tsx`（`git diff` 该文件为空），系既有/环境失败，已记录不掩盖。
