<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AI 流式输出体验 · AI 全量操控桥接 · 全局顶栏与 Plus 弹窗 · 典型使用场景 · AI 对话决策面与运行时事实

> 本文件是从根 `README.md` 拆出的**原文收纳件**(2026-09-30,台账票 G-814434「README 重写收编重做」)。
> 来源:重写前工作树 `README.md`(6,476 行)以下所注行号区间,逐字搬入,未改写任何一句;整理仅限本文头尾的标题与来源注记。
> 索引层与九份主题文档的总入口见根 [`README.md`](../../README.md)。

---

## 🎬 AI 流式输出体验(Phase 19)

> 实现位置:`apps/web/src/components/ai/agent-task-progress-pane.tsx` v12 + `apps/web/src/components/chat/message-list.tsx`

### 四大招牌交互

1. **Plan Step ↔ Message 双向跳转**:`useProgressJumpStore` 联动,点击 PlanStep 滚动到 AI 消息 + 1.5s flashHighlight 淡出,反向 hover AI 消息自动高亮 PlanStep
2. **Timeline 时间线统一事件流**:`flattenToTimelineEvents` 把 plan/subagent/tool/question 展平为单一时间线,inline/timeline 双 tab 切换
3. **HoverPreviewCard 步骤预览**:`useHoverPreview` 250ms 延迟触发,100ms 关闭,边界检测防溢出,显示步骤说明/关联消息/token 消耗
4. **MessageContextMenu 右键菜单**:6 类操作(复制/Markdown/重新生成/反馈/分享/折叠/删除)+ Esc 关闭 + 边界翻转

### 关键组件

- `BatchHeader`(批次头,4 态 running/completed/failed/partial + 进度条)
- `Checklist`(`in_progress` 步骤关联工具调用列表)
- `ResourceBudget`(step 预算 60,自研)
- `CompressionDivider`(跨日/长间隔消息折叠分割线)
- `SubAgentTaskTree`(子代理任务树,4 态)
- `ConnectionStatus`(SSE 5 次重连策略)

### 守门

- typecheck:`pnpm --filter @ihui/web typecheck` → 0 错误
- unit test:`pnpm vitest run tests/agent-task-progress-pane.test.tsx` → 107/107
- i18n parity:`node scripts/check-i18n-keys.mjs --staged` → 5 语言 OK

### inline 深度接入(2026-07-31 立,对标 Codex)

> 触发:用户反馈"AI 对话过程中各种工具调用 / 思考过程 / 进度 / 时间线 / 命令使用 / 插件使用 / 交互 / subagent 工作内容实时更新刷新做得都太差了,有的甚至都没有"。
> 实现位置:`apps/web/src/components/chat/message-list.tsx` + `apps/web/src/components/ai/tool-call-card.tsx` + `apps/web/src/components/ai/progress-sections/tool-call-summary-card.tsx`(新建)+ `apps/api` / `apps/ai-service` SSE 事件增强 + `packages/types` / `packages/api-client` 类型契约扩展

把原藏在右上角 popover 内的富 UI 组件直接 inline 到消息气泡主流,无需主动点击即可见实时进度:

| 接入项                                      | 渲染位置                | 数据来源                                  | 关键交互                                                           |
| ------------------------------------------- | ----------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| **思考过程折叠面板**(`ThinkingSection`)     | 消息气泡内 reasoning 区 | `m.reasoning` + SSE `reasoning` 流        | 折叠/展开,流式 token 实时追加                                      |
| **工具调用统计卡片**(`ToolCallSummaryCard`) | 消息气泡末尾            | SSE `tool-summary` 事件                   | 5 项指标 chip:搜索文件 / 搜索网页 / 修改文件 / 新增行数 / 删除行数 |
| **时间线**(`TimelineTab`)                   | 对话底部 inline         | `useTimelineStore.events`                 | `showTabs={false}` 单一事件流,实时追加                             |
| **工具来源徽章**(plugin/mcp)                | `ToolCallCard` 标题右侧 | SSE `tool-call` 事件 `server_source` 字段 | builtin 默认无徽章;plugin 紫底"插件";mcp 蓝底"MCP · {serverName}"  |

#### 类型契约扩展(packages/types + packages/api-client)

- `ToolCallSource = 'builtin' | 'plugin' | 'mcp'`:工具来源三态枚举
- `ToolCallSummary`:6 项指标接口(`filesSearched` / `webSearched` / `filesModified` / `linesAdded` / `linesDeleted` / `totalCalls` + 可选 `toolsByCategory` / `totalDurationMs`)
- `streamChat` 新增 `onToolSummary` 回调 + `tool-summary` SSE 事件解析(兼容 snake_case / camelCase 字段)
- `ChatMessage` 扩展 `toolCallSummary?: ToolCallSummary` + `totalDurationMs?: number` 字段

#### 后端 SSE 增强(ai-service)

- `tool-summary` 事件:LLM tool loop 结束时聚合工具调用历史,统计 6 项指标
- `tool-call` 事件新增 `server_source` / `server_id` / `server_name` 字段:由 `resolve_tool_source()` 辅助函数判定(builtin / plugin / mcp 三态)

#### 守门

- typecheck:`pnpm --filter @ihui/web typecheck` → 0 错误(清理未使用 import 后通过)
- 浏览器自验:web 8801 在线,4 状态截图(默认/hover/active/dark)+ dark mode 切换通过 + 控制台 0 错误
- §17 豁免:api / ai-service 启动受阻(docker / pnpm 不在 session PATH),按 §17 豁免项③降级验证(源码 Grep + Read 确认组件 inline + typecheck 全绿 + 控制台 0 错误)

---

## 🤖 AI 全量操控桥接(2026-09-20 立,AI 自主操控本程序全部内容)

> 目标:用户在 AI 对话框里说"帮我打开设置页 / 把充值金额填成 100 并提交 / 查一下所有订单",
> AI 能**自主分析并真的操作**我们自己的程序,而不只是回答问题。
> 实现位置:`apps/ai-service/app/services/{api_tools_bridge,ui_action_bridge}.py` +
> `apps/api/src/routes/agent-control.ts` + 端侧注册表与桥接 hook
> (`apps/web/src/{lib/ui-action-registry.ts,hooks/use-ui-control-bridge.ts}`、
> `apps/miniapp-taro/src/{lib/ui-action-registry.ts,lib/ui-control-tools.ts,hooks/use-ui-control-bridge.ts}`)

三条互补路线，全部复用既有链路，不新增鉴权体系：

| 路线                           | 机制                                                                                                                                       | 覆盖面                                                                                                                                                                                                                                                                 | 关键实现                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. API 全量工具化**          | 启动时拉取 `apps/api` 的 OpenAPI spec(`/docs/json`)，逐端点生成 MCP 工具注入自研工具表                                                     | 后端全部 HTTP 能力(默认 `all` 模式 **4623 个端点即时可调用**:只读 2042 + 写 2581；其中 302 个常驻工具表 = 300 端点 + 2 入口，长尾经 `api_endpoint_call` 即时派发；调用 URL 按 `spec.servers` 解析挂载前缀)                                                             | `api_tools_bridge.spec_to_tools()` + `resolve_mounted_path()`                                                                                        |
| **B. 端侧 UI 动作桥接**        | `web_ui_*` 七工具经 `agent-control` 通道(category=`ui`)下发到用户浏览器，前端执行后回传结果；RN/小程序各**七工具**走 `app_ui`/`miniapp_ui` | 站内导航 / 按钮点击 / 表单填写 / 表单提交 / 页面读取 / 命令面板与模式调用（RN、小程序无 DOM ⇒ click/fill/submit 打在端内**控件注册表**上：组件挂载时交出 `setValue`/`onPress`/`onSubmit` 才可操作，没交出就如实 `UNSUPPORTED_ACTION`，**不存在"回了 ok 而界面没动"**） | `ui_action_bridge.py` + `apps/web/src/lib/ui-action-registry.ts` + `apps/{mobile-rn,miniapp-taro}/src/lib/{ui-action-registry,ui-field-registry}.ts` |
| **C. Computer / Browser 兜底** | 既有 `computer_*`(桌面) / `browser_*`(扩展) 工具看屏幕像人一样操作                                                                         | 任意 UI(含第三方站点)，无需改造                                                                                                                                                                                                                                        | 既有 agent-control 通道，本次仅扩 category 枚举                                                                                                      |

端点数量实测 4600+ 个 operation(2026-09-21 现测，会随路由增减漂移)，完整 schema 全塞进一次对话不现实；
A 路线因此提供两个**名字恒定**的入口工具，让模型"先搜后调"，token 成本与端点数解耦：

- `api_endpoints_search(query, method?, limit?)` → 返回候选 `name` / method / path / 摘要
- `api_endpoint_call(name, arguments)` → 转发到对应端点工具(**仅接受 `api_` 前缀**，
  否则等于把 `run_command` 这类高危工具暴露给一个字符串参数，是越权捷径)

> ⚠️ 聊天主链有一道**双重闸门**：`llm.py` 的 tool loop 只在请求带非空 `agentTools` 时才进，
> 而各端为保打字机流式刻意"普通问答不带工具"。两道闸门做的是同一件事——"这一句要不要给 AI 一只手"：
>
> - **客户端预筛**(提前量)：`packages/shared/src/utils/app-control-intent.ts` 是单一事实源 ——
>   `detectAppControlIntent()` 判信号，`createAppControlToolSelector({ui, api})` 由**各端注入本端族名**
>   (web / 小程序 / RN 各 3~5 行实例化)。命中才带本端整族，普通问答连字段都不出现；
>   把 `web_ui_*` 发给小程序只会换来 `TARGET_NOT_CONNECTED` 并白烧一轮上下文。
> - **服务端自主补全**(2026-09-21 加，`apps/ai-service/app/services/control_autonomy.py`)：
>   客户端没说中不等于用户没这个意思。服务端再判一次 —— 意图取"强信号正则 ∪ 关键词表"两源并集
>   (实测 13 条真实措辞：正则命中 2、关键词命中 8、并集 9，两张网几乎不重叠)，并且
>   **只注入该用户此刻真在线的那一族**(查 `/api/agent-control/status`，15s 缓存，查不到就不加)。
>   客户端已带工具时(本轮本来就要进 tool loop)直接放宽到整族 —— 这部分零额外延迟。
>
> 为什么默认不做"每轮都让模型自己决定要不要用工具"：那会给每条普通问答多一次非流式
> `complete()`，首字延迟用户能直接感知(web 2026-08-29 就是为此改成按需携带)。
> 要最大自主性用 `CONTROL_AUTONOMY=always`，`off` 可整个关掉 —— 代价与收益摆在这，由部署方选。

对话侧自动路由:`apps/ai-service/app/services/conversation.py` 的 `_app_control_intent_tools()`
按强信号正则识别"操控本站"意图(打开页面 / 点击按钮 / 填表单 / 提交 / 切模式 / 调接口)，
命中即无条件并入 tool loop 工具集，并自动补齐依赖(`web_ui_click` 必带 `web_ui_describe`，
`api_*` 入口成对注入)，不依赖 LLM 意图分类的质量 —— 这是 REST 链的兜底，与上面的客户端正门同源。

### 各端覆盖形态(2026-09-21)

| 端                   | 通道 category / endpoint             | 动作集                                                      | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| web                  | `ui` / `web`                         | describe / navigate / click / fill / submit / read / invoke | 有同源 DOM，七个动词齐；元素快照按优先级择优，应答带 `instanceId` 供后续钉定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| desktop(Tauri)       | 同 web(复用 `use-ui-control-bridge`) | 同 web                                                      | 桌面壳加载的就是 `apps/web`(`devUrl=8801`)，因此**桥接层已对 Tauri 放开**，无需另写一份                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 小程序(Taro)         | `miniapp_ui` / `miniapp`             | describe / read / navigate / invoke / click / fill / submit | 七动词与 web 同名同义,但真机是 WXML、无可枚举同源 DOM ⇒ click/fill/submit **打在控件注册表上**(`src/lib/ui-field-registry.ts`):组件挂载时交出 `setValue`/`onPress`/`onSubmit`,没交出的控件 `writable/pressable=false`,一律如实 `UNSUPPORTED_ACTION`;id 序号全局单调且永不复用 ⇒ 用旧快照猜 id 只会失败,不会误改别的控件;密码/验证码/密钥连快照都不出现,删除/支付/提现/分享/发布类文案一律拒绝入表。导航仅放行 `app.config.ts` 生成的页面白名单,`invoke` 仅放行显式登记的命令,**退出登录永不暴露**;可调用命令面 = 主题三档 + 五个 tab 切换 + 回到页面顶部 + 五种界面语言。**接入量现测**:15 个业务文件交出写通道(含 20 页共用的 `SearchBar`)                                                                       |
| RN(Expo)             | `app_ui` / `rn`                      | describe / read / navigate / invoke / click / fill / submit | 机理与小程序相同:`@ihui/ui-native` 的 `Input`/`Button` 与端内 `useUiTextField` 登记钩子在挂载时把写/触发通道交给 `src/lib/ui-field-registry.ts`(下层包不得反向依赖 app,故经 globalThis 约定键;宿主不在就返回 `null` 照常渲染)。**受控 `Input` 只有在父组件给了 `onChangeText` 时才标 `writable`** —— 那正是用户键盘输入走的同一条 path。`navigate` 仅放行 204 条 Screen 白名单;`invoke` 只登记 4 条显式命令(主题三档 + 回首页),**退出登录/注销/支付/清缓存一律不登记**;RN 无 URL,`screen` 语义是"根到叶激活路径"。**接入量现测**:24 个裸 `<TextInput>` 里 17 处已可填(零 JSX 改动),8 处按凭据/只读/rules-of-hooks 有意不注册;另有 476 处裸 `Pressable/TouchableOpacity` 属逐屏采纳(需真机回归,不做无验证批量改写) |
| 扩展(自有界面)       | `ext_ui` / `extension`               | describe / read / navigate / invoke / click / fill / submit | **第五族(2026-09-21 用户批准新增)**:sidepanel/popup 是真实同源 DOM(44 页 / 51 处控件),元素定位靠 `document` 查询,与 web 同七动词;**不能复用 `browser`** —— 该 category 已被"经 content script 操控外部网页"占用,api 侧 `CATEGORY_ENDPOINT` 是 1:1 择端,同端双执行面必须分 category 才互不抢指令(api 用例 ㉒ 为正面证据);导航仅放行 `ext-ui-routes.generated.ts` 生成的自有路由白名单(50 条,从 SidepanelApp 路由表清点);密码/验证码拒填(`PERMISSION_DENIED`)、删除/支付/发布类拒绝(`DESTRUCTIVE_BLOCKED`),判据与 web 逐字对齐                                                                                                                                                                                      |
| 扩展 / 桌面 computer | `browser` / `computer`(既有)         | 鼠标键盘级                                                  | 路线 C 兜底,行为未改:`browser→extension` 仍指"操控用户正在看的外部网页",`computer→desktop` 不变                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CLI                  | 刻意不接                             | —                                                           | `apps/cli` 的 `sampleWithRetry` 是**自带本地 tool loop 的采样器**，再给它传 `agentTools` 会让服务端与本地两套工具循环嵌套。CLI 用户要调平台能力走带凭据的 `/api/mcp` 或 engine 通道，二者已自动看见全量外部工具                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

> CLI / engine 侧**不需要**逐端维护工具清单：`routers/engine.py::_default_tool_lister` 取的是
> `mcp_server.list_tools()`，而外部注册就是往同一张表追加 —— 新工具对 CLI、编排、桌面 agent 自动可见。

小程序两条**代码管不到的部署前置**(缺任一条则链路静默降级为"AI 拿不到小程序端"，不崩不刷屏)：

1. 微信公众平台 → 开发管理 → 服务器域名 → **socket 合法域名**必须包含 API 的 `wss://<host>`，
   否则真机 `Taro.connectSocket` 直接 fail。
2. 小程序切后台约 5s 后 JS 线程被挂起，连接必断、timer 必停，api 侧 `ENDPOINT_TTL_MS=5min`
   后判该端离线。因此 `TARGET_NOT_CONNECTED` 在移动端是**常态**而非故障：桥接层只在
   `onAppShow` 建连起保活、`onAppHide` 立即停 timer 并主动断连，连接类失败**只记 warn 不弹 toast**。

顺带修掉一处既有缺陷：`apps/miniapp-taro/src/app.tsx` 原先自建通知 WS 时用了默认 urlBuilder
(内部 `new URL(baseUrl)`)，微信真机 JSCore 不保证有 WHATWG URL 构造器 → 建连从未真正成功过。
现由桥接层持有**唯一**一条通知连接，并注入不依赖 `URL` 的 urlBuilder，收到的消息仍
`eventCenter.trigger('wsNotification')` 广播给既有消费者，契约不变。

### 安全闸门(不做 bypass 式全量放开)

| 层     | 闸门                                                                                                                                                                                                                            | 落点                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 身份   | 所有桥接调用必须带 `__user_id`，经 `X-Internal-Service-Token` + `X-user-id` 代调，api 侧校验用户存在且活跃                                                                                                                      | `internal-service-token.ts`            |
| 权限   | 写端点(POST/PUT/PATCH/DELETE)需 `__user_role >= 1`，且 api 侧 RBAC 二次兜底                                                                                                                                                     | `api_tools_bridge.make_api_handler`    |
| 越权面 | OpenAPI 的 header/cookie 型参数一律不暴露给 LLM，防越权头注入；路径参数强制 URL 编码，防路径穿越                                                                                                                                | 同上                                   |
| 多租户 | `category='ui'` 指令按 userId 过滤端点，只会推给该用户自己的浏览器                                                                                                                                                              | `agent-control.findEndpointByCategory` |
| 破坏性 | web 前端硬拦截:密码/验证码/secret 类字段拒填(`PERMISSION_DENIED`)，删除/注销/提现/支付类目标拒绝点击提交(`DESTRUCTIVE_BLOCKED`)，导航仅放行站内路由白名单(`ROUTE_NOT_ALLOWED`)                                                  | `ui-action-registry.ts`                |
| 幻觉   | 注入 `_UI_RENDER_PROMPT`:动作 ok=true 只代表前端已执行，必须再 `web_ui_read` 核对，未核对不得声称已提交                                                                                                                         | `conversation.py`                      |
| 开关   | `API_TOOLS_MODE=off\|read\|all`(**默认 all**：放开的是可见面，授权仍走上面的 role 闸门；多租户公开部署可设 `read` 只让 AI 读)、`UI_ACTION_TOOLS=false` / `APP_UI_TOOLS=false` 可独立关闭 web 族与移动两族；密钥缺失 fail-closed | `apps/ai-service/.env.example`         |

### 真机 / 端到端验证中发现并修掉的问题(2026-09-20 ~ 09-21)

前两条是"直打 `/api/agent-control` 就能发现"的可用性问题；后三条**只有走一遍真实聊天
round-trip 才暴露** —— 这正是要验这类功能必须从对话框打进来的原因。

- **元素上限挤掉表单字段**:应用外壳(侧栏/顶栏/AI 任务面板)常驻 200+ 可交互元素,按 DOM 顺序截断到 80
  会把页面真正的输入框整批挤出去,`describe` 回清单里没有可填字段。改为按优先级择优:表单字段
  (input/select/textarea/combobox/checkbox) → 正文区按钮 → 其他 → 外壳导航;入选集仍按 DOM 顺序
  回排以保持 id 稳定。
- **多标签页命令散射**:同一用户开多个应用标签页时都会上报 `endpoint='web'`,api 原先只挑"最后心跳那个",
  于是 `describe` 与紧随其后的 `fill` 会落到不同页面——元素 id 是该页私有映射,必然 `SELECTOR_NOT_FOUND`。
  改为应答携带 `instanceId`、后续动作经 `targetInstanceId` 钉回它刚看过的那一页(钉定端掉线则回落择优,
  且绝不跨用户钉定)。
- **③ 聊天主链调 `/execute` 被 CSRF 钩子拦成 403**：桥接原先只发
  `Authorization: Bearer <内部密钥>`(`/execute` 只认这个)，而 `apps/api/src/plugins/csrf.ts` 的
  豁免判据是"请求带自定义头"(`x-internal-service-token` 存在即视为非浏览器表单)。只发 Bearer
  ⇒ **整条 UI 桥 100% 不可用**。此前从未被发现，是因为直打 `/execute` 用用户 JWT 时顺带带上了
  `auth_token` cookie，绕过了该钩子。现两个头都发(与 `api_tools_bridge` 口径一致)，并有
  `test_call_sends_internal_service_token_for_csrf_exempt` 钉住。
- **④ 页面被重载后每条后续动作都白等 20s**：重载会生成新 `instanceId`，旧实例却还能在
  `ENDPOINT_TTL_MS=5min` 内留在 api 注册表里"活着"；钉定原先只校验"存在 + 同类 + 同用户"，
  于是把动作推到一条已死的 socket 上，表现为看不出根因的 `TIMEOUT`。现改为**钉定还要验活性**——
  比同用户同类最新端落后 ≥ 一个保活周期(60s)即回落择优；两个标签页都在心跳时(落后不足一个周期)
  **仍钉住**，多标签页语义不退化。ai-service 侧同时把 `TIMEOUT` 纳入清钉条件，立刻自愈。
- **⑤ 工具卡片把整个聊天页打崩**：无参工具(`web_ui_describe` / `web_ui_read`)的 toolCall 落库后
  `args` 字段整体缺失，而 `tool-call-card.tsx` 的 `pickStr` / `extractUrl` 在 message-list 的渲染
  路径上直接索引它 → `Cannot read properties of undefined (reading 'path')`，Next 错误边界接管成
  "应用发生严重错误"。也就是说 **AI 成功操控页面之后，用户回到聊天页就看到白屏**。现已在两个入口
  归一 `args`，并加 `apps/web/tests/tool-call-card.test.ts` 四条回归。

### 端到端实证:对话框里说一句话，页面真的动了(2026-09-21)

真实浏览器登录后在对话框输入「导航到模型市场页面」，用 fetch 探针抓到的请求体与 SSE 回执：

```
body.agentTools = [web_ui_describe, web_ui_read, web_ui_navigate, web_ui_click,
                   web_ui_fill, web_ui_submit, web_ui_invoke]      ← 客户端意图闸门生效
SSE: tool-call-start → tool-result(web_ui_describe) → tool-call-start
     → tool-result { toolName: web_ui_navigate, args: {path: "/capability-market"},
                     result: {ok: true, durationMs: 718} } → plan_updated → done
location.pathname: "/" → "/capability-market"，页面 h1 = "能力市场"     ← 端侧真的执行了
```

即：`uiControlToolsFor` 带上本端整族工具 → `llm.py` 进了 tool loop → 模型按"先探后动"先
`describe` 再 `navigate` → api 经 WS 推给用户浏览器 → 前端注册表执行并 `/result` 回传(718ms)→
模型拿到 `ok:true`。全程无 403、无 20s 超时。三条上面的缺陷都是这一次跑动才撞出来的。

### 页面与输入框的覆盖面：量出来的数，不是形容词(2026-09-21)

「所有页面 / 所有输入框」这类话必须用可核对的口径写，实测与实现后如下：

| 维度                | 实现前                                                                                                                               | 现在                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面可发现性        | describe 只回 63 条导航命令，879 条路由**只用于校验**，模型只能猜路径(先猜 `open-model-market` 失败，再猜 `/capability-market` 猜中) | `routes` 摘要常驻(880 total / 779 navigable / ≤25 分组桶，+838 B)，模型按 `describe(query=…)` 取 top-N(封顶 40，满命中 3,286 B)。**冷回执里一条 path 都不铺**(用例断言 JSON 不含任何 `/` 形态路径) |
| 链接可读性          | `UiElementDescriptor` 无 `target`，`a[href]` 采到了也读不到指向                                                                      | link 补 `target=href`(64 元素页 +约 830 B)                                                                                                                                                         |
| `input[type=file]`  | 被选择器显式排除(web 11 处上传点)                                                                                                    | 采集 kind/label/`accept`/`multiple`；`fill` 一律 `PERMISSION_DENIED` 并说明原因(浏览器禁止脚本写路径，造 `File` 不属本次范围)。**不假装填成功**                                                    |
| `[contenteditable]` | 不在选择器内(5 处组件)                                                                                                               | 采集 + 可写(focus → textContent → 派发 input/change，React 受控可见)。ProseMirror/Slate 内部文档模型可能与 DOM 不同步，回执回写后文本供核对                                                        |
| Monaco 代码编辑器   | 不在选择器内                                                                                                                         | 只采容器(内嵌 textarea 去重)；能取到 editor 实例才 `setValue`，取不到回 `UNSUPPORTED_ACTION`；多编辑器绝不自选                                                                                     |
| RN / 小程序输入框   | 无 DOM ⇒ 打在端内**控件注册表**上(组件挂载时交出写通道才可操作)                                                                      | 已落地(2026-09-21):两端各 7 动词,注册表单测 + 采纳防漂移断言齐;RN 17/24 处可填、小程序 15 文件接入;未接入部分需逐屏真机回归(§14 不允许把未验证的 UI 改动当交付)                                    |

`suppressed` 计数与优先级择优保留：应用外壳常驻 200+ 可交互元素，按 DOM 顺序截断会把真正的表单字段整批挤出去，所以是"表单字段 → 正文按钮 → 其他 → 外壳导航"择优。

### 可达面 ≠ 授权面（重要边界）

route A 以 `x-internal-service-token` + `x-user-id` 代调，而 `apps/api` 只有显式接
`checkAuthOrInternalService` 的路由认这套凭据。实测 `/api/memory` 带令牌 200、不带 401；
`/api/conversations`、`/api/notifications`、`/api/admin/users` 一律 401。因此下表数字说的是
**调用面**（能生成并发起多少次调用），真正能落地的范围受"Agent 全面开放工程"授权层收口进度约束；
未授权端点会如实返回 401，由模型按 `_UI_RENDER_PROMPT` 转述失败，而不是编造成功。

抽样实测（2026-09-21，同样的机器凭据打 12 个代表性端点）：**只有 1/12 返回 200**，且那一条是本来就公开的
`GET /api/articles`；`/api/conversations`、`/api/notifications`、`/api/agents`、`/api/user/profile`、
`/api/ai-skills`、`/api/llm/models` 一律 401（另有 3 条 404 是我猜的路径不存在，不作证据）。
也就是说：**route A 今天能"发起"4683 次调用，但几乎读不到用户态数据** —— 认机器凭据的仍只有
5 个路由文件（`agent-control` / `ai-extended` / `edu-ai-management` / `im-gateway` / `memory`），
且是逐路由 `checkAuthOrInternalService` opt-in，没有中央开关。把它放开属授权层工程，不在本桥接的改动范围。

### 对外导出面：刻意不登记（不是遗漏）

`web_ui_*` / `mobile_ui_*` / `taro_ui_*` / `api_endpoints_search` / `api_endpoint_call` **没有**登记进
能力目录 `toolScopeMap`，因此它们在 MCP 对外导出面（`ENABLE_MCP_EXPORT`）上**既不声明也可调用被拒**
（`mcp_export` 的 fail-safe 语义：未登记 → 不对外声明）。这是有意的：这些工具的动作发生在
**用户自己的设备**上（遥控其浏览器/App/小程序），让第三方 API Key 具备这种能力需要单独的
产品与授权决策，不该由一次功能开发顺手登记进去。站内聊天主链（`llm.py`，带真实用户身份与 role）
不受影响，正常使用。若将来要对外开，须逐项决定 scope 与数据类别，而不是加前缀通配。

### 配置项

| 变量                    | 默认                             | 说明                                                                         |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| `API_TOOLS_MODE`        | `read`                           | off 不注册 / read 仅 GET / all 含写操作                                      |
| `API_TOOLS_MAX`         | `300`                            | 注册为独立工具的条数上限(不削弱可调用面:长尾仍可经 `api_endpoint_call` 调用) |
| `API_TOOLS_EXCLUDE`     | `^/docs,^/ws,^/internal,^/debug` | 逗号分隔正则，命中的路径不注册                                               |
| `API_INTERNAL_BASE_URL` | 空(沿用 `API_SERVICE_URL`)       | 覆盖 apps/api 基地址                                                         |
| `UI_ACTION_TOOLS`       | `true`                           | 是否注册 `web_ui_*` 七工具                                                   |
| `UI_ACTION_TIMEOUT`     | `20`                             | 等待前端回传执行结果的秒数                                                   |

> 端类型说明:路线 B 覆盖 **web + desktop(同一份前端)**、**mobile-rn(Expo/RN)** 与 **miniapp-taro(微信小程序)**，
> 三端各自 endpoint/`category`，互不抢指令；三端**动作集相同(七动词)**,差别在定位机理 —— web 靠同源 DOM 查询元素,RN 与小程序无 DOM ⇒ click/fill/submit 打在端内控件注册表上,组件没交出 `setValue`/`onPress`/`onSubmit` 就如实 `UNSUPPORTED_ACTION`
> (click/fill/submit 需业务组件逐个暴露写入通道，不在本路线内)。

---

## 🧭 全局顶栏 GlobalTopBar + Plus 弹窗(2026-07-30 立,平台独占 web-only)

> 实现位置:`apps/web/src/components/layout/GlobalTopBar.tsx`(新建) + `apps/web/src/components/layout/MainShell.tsx`(精简) + `apps/web/src/components/layout/GlobalShell.tsx`(挂载) + `apps/web/src/components/layout/TagsView.tsx`(搜索按钮 + 标签左缘对齐) + `apps/web/src/components/layout/index.ts`(re-export)
> 触发:用户反馈"项目页面打开右上角标签栏不显示,应常驻固定;且需加号按钮弹出含内置浏览器/设置/文档/终端/代码编辑器/MCP/Skill 的小窗"
> AGENTS.md §9 显式标注:仅 web 端,其他 7 端(apps/api/ai-service/desktop/extension/mobile-rn/miniapp-taro/cli)无此概念,Tauri 桌面端有原生 chrome、Chrome extension 有 action popup、miniapp-taro 微信有原生 tabBar、cli 是 terminal 交互、mobile-rn 是 RN navigation,均无 MainShell 概念

### 整合方案

- **原架构**:顶栏(拖拽 + 窗口控制 + TagsView + Globe 入口)只在 `(main)` 路由组 MainShell 内部渲染;marketing/auth/sso/forbidden/login 等路由不显示
- **新架构**:抽出 `GlobalTopBar` 提升到 `app/layout.tsx` 的 GlobalShell `children` 位置,所有路由组共享;MainShell 精简为仅"工作区卡片"容器(无顶栏,避免重复)
- **替代关系**:原 MainShell 顶栏的 Globe 按钮(打开 WebWorkPanel 内置浏览器)统一改从 Plus 弹窗触发

### Plus 弹窗(9 项,分 3 组)

| 分组       | 选项                                   | 动作                                  |
| ---------- | -------------------------------------- | ------------------------------------- |
| 视图(2 项) | 文档 / 内置浏览器                      | 跳 `/docs` / 切换 `useWorkPanelStore` |
| 工具(5 项) | 编辑器 / 终端 / 代码变更 / Agent / MCP | 跳 `/workspace` + `setActiveTopTab`   |
| 设置(2 项) | Skill / 设置                           | 跳 `/ai-skills` / 跳 `/settings`      |

弹窗特性:搜索框模糊匹配 + 快捷键提示(G D / G B / G E / G T / G C / G A / G M / G K / G S)+ Esc 关闭 + 点击外部关闭 + 自动聚焦搜索框

### 桌面端能力(仅 `isDesktop`)

- 8 方向 resize 区域(边 9999 / 角 10000)+ 拖拽 + 双击最大化(250ms 状态机,与 sidebar.tsx 复用)
- 窗口控制按钮(Min/Max/Close,zh-10001),最大化时隐藏 resize 区域
- 模态遮罩等效压暗:任意模态遮罩打开时三按钮随遮罩同幅度压暗(`data-window-controls` 容器 + `data-window-controls-dim` 等效压暗层;压暗色由 DOM 实测遮罩色得出,故浅色 Sheet 下表现为"变亮"而非写死黑罩)
- 窗口失焦非活动态:窗口失去系统焦点时按钮降亮,对标 Windows caption(容器挂 `data-window-inactive`,弱化规则写在 `app/globals.css` 的 `[data-window-controls][data-window-inactive='true'] > button` —— 刻意不用组件内 Tailwind 任意变体,生产构建曾出现"JS 已更新而新 class 未进 CSS")
- 走 `tauri-bridge` 单一桥接层(`minimizeWindow` / `toggleMaximizeWindow` / `closeWindow` / `startWindowDrag` / `startResize` / `onMaximizeChange`)
- 应用更新推送:Tauri 2 updater 插件 + Rust `restart_app` 命令,三阶段自动更新策略:
  - **打开程序**:启动 5s 后静默检查,发现更新自动下载安装(下拉窗显示进度),完成后提示重启
  - **关闭程序**:按「设置 → 桌面端行为」里选的关闭动作执行(隐藏到托盘 / 直接退出 / 每次询问并记住选择);退出路径不查更新,询问超过 3 秒由 Rust 侧兜底,不会卡住
  - **使用中手动检查**:托盘菜单"检查更新"触发,显示弹窗 + "立即更新"按钮,用户自主选择
  - `useUpdater` 状态机(idle → checking → available → downloading → installing → done);**退出路径不查更新**(2026-09-27 起:托盘「退出」与 Ctrl+Q 由 Rust 侧立即终止),更新入口只剩两处会报结果的:启动静默检查、托盘独立「检查更新」
- 更新 feed 平台覆盖(2026-09-24 收口):站点主端点 `https://aizhs.top/desktop-feed.json` 与 GitHub 回退端点
  **四平台键齐全**(`windows-x86_64` / `linux-x86_64` / `darwin-x86_64` / `darwin-aarch64`),两处共用同一份判据
  `scripts/lib/tauri-updater-platforms.mjs`(空签名不出键、macOS 用 `.app.tar.gz` 而非 `.dmg`、mac/linux 直链只认 GitHub)。
  修前主端点只有 windows 一个键 —— Tauri 的端点循环"200 且能反序列化即 break",**缺键不会回落到第二端点**,
  故当时 mac/linux 是硬失败。签名密钥全链路只有一把(私钥仅在 CI secrets),四平台产物验签 keyID 已机检一致。

### 高度 / 对齐根治(2026-07-30 二轮 UI 反馈)

- **顶栏双重高度冲突**:`h-[32px] + pt-2` 双重定义 → 内部仅 24px;统一为 `h-9`(单层 36px),内部 `h-full` 撑满
- **搜索按钮容器未对齐**:`px-2 + px-2` → 左缘 8px;统一为 `pl-[28px]` = 卡片圆角(12px) + main p-4(16px),跟下面 MainShell 工作区内容左缘完美对齐
- **Plus / WindowControl / Dropdown trigger 高度不一**:全部统一为 `h-7 w-7 rounded-md`,不再有 `h-6/h-7` 冲突

### 守门

- typecheck:本任务文件 0 错误(`GlobalTopBar.tsx` / `TagsView.tsx` / `MainShell.tsx` / `GlobalShell.tsx` / `index.ts`),剩余 3 错误为其他 agent 文件已存在问题,按 §12 跳过
- i18n parity:9 × 5 = 45 个 key 补全(`topBar.{document,browser,terminal,editor,codeChanges,agent,mcp,settings,skill,plus}` + `viewSwitcher.{searchPlaceholder,noMatch,groupView,groupTools,groupSettings}` + `nav.{minimize,maximize,restore,openBrowser}`),`check-i18n-keys.mjs` parity + `scan-i18n-zh-residue.mjs` ko/zh-TW 无残留
- 浏览器自验:4 状态截图(默认/hover/active/dark mode)覆盖 marketing 首页 `/` + chat `/chat` + admin `/admin` + login `/login` 4 路由,标签栏在所有路由常驻显示

### 与已有架构的分工

| 组件           | 职责                                           | 渲染位置                       |
| -------------- | ---------------------------------------------- | ------------------------------ |
| `GlobalShell`  | 全局骨架(Sidebar + AISidePanel + 内容槽 + PWA) | `app/layout.tsx` 根级          |
| `GlobalTopBar` | 全站常驻顶栏(标签 + Plus + 窗口控制)           | `GlobalShell` 内 children 上方 |
| `MainShell`    | `(main)` 路由组工作区卡片                      | `(main)/layout.tsx` 路由组级   |
| `TagsView`     | 标签栏(根据 pathname 派生标签)                 | `GlobalTopBar` 内              |

---

## Use Cases(典型使用场景)

> IHUI-AI 适用于以下 8 类核心场景,每个场景都可在 8 端中任一端运行(8-Platform AI Operating System)。

1. **Enterprise AI Assistant(企业 AI 助手)** — 多租户 + RBAC + SSO,企业内部统一 AI 入口,部门隔离 + 审计日志
2. **Multi-model LLM Gateway(多模型 LLM 网关)** — LiteLLM 统一 176 模型,智能路由 + 60% 缓存 + 成本管控,替代单一厂商锁定的 LLM Gateway
3. **AI Agent Marketplace(AI Agent 市场)** — LangGraph + MCP + A2A 三栈协同,Agent 编排/发布/交易,构建垂直行业 Agent 生态
4. **Knowledge Base Q&A(知识库问答)** — pgvector + RAG + 知识图谱 + 用户长期记忆,企业文档/代码/FAQ 智能问答
5. **Code Generation Platform(代码生成平台)** — 自研 CLI 50 命令 + 36 工具 + ACP Server,对标 Claude Code / Cursor 的开源替代
6. **Customer Service Bot(客服机器人)** — 多渠道 IM 接入 + 工作流编排 + 人工接管,7×24 自动应答
7. **Education Tutor(教育辅导)** — AI 教育全栈(课程/题库/考试/直播/证书),开源版 Khan Academy
8. **Developer Productivity(开发者生产力)** — 8 端开发模板 + 12 共享包 + 33+ 守门,Fork 即用,5 分钟启动全栈 AI SaaS

---


---

> 以下为重写前 `README.md` 第 6432–6455 行(main 收编后新增批次),原样搬入。

## AI 对话决策面与运行时事实(2026-09-29 一批落地,对标 Codex / Trae / Qoder / WorkBuddy)

这一批把"用户在对话里点下允许/拒绝时,他到底知道什么"补齐成可核对的事实:

- **推理强度第三轴**:输入区除模型、采样外可点选档位(minimal / low / medium / high)。
  档位是封闭集合,四处(TS 联合 / TS 数组 / Python 钉扎表 / 契约层)由一道对账门逐格比;
  后端把档位钉回或丢弃时**必须回报回落通知**,界面上出徽章 —— "选了档而什么都没发生"
  是这一批点名要消灭的形态。旧客户端不传档位 ⇒ 行为逐字不变(回退 = revert)。
- **审批弹窗显示逐请求事实**:这次调用**在哪儿跑**(沙箱内 / 沙箱外 / 隔离方式)、
  **要连哪个网络目标**(`host:port` 原样显示,不显示哈希)、**哪些目标已被静态策略拦死**。
  "服务端读不到"与"这块没上报"是两态,分别渲染成"未上报"与整块不渲染,绝不合成一句通用文案。
  回退开关 `IHUI_APPROVAL_ENV_REPORT=0` 时一个新字段都不发。
- **放行规则三档到底**:拒绝 / 允许一次 / 本次对话允许该目标 / **始终允许该目标(90 天,单条可撤销)**。
  规则面板按 kind 分节(命令前缀 / 网络目标),列表与撤销共用同一张表;
  主体只取令牌那份、目标只取发帧时存进待决条目那份,所以"批 A 连 B"和"自报别人的键去撤销"都进不来。
- **MCP 连接状态到对话里**:连不上 / 重连中 / 失败会在对话流出现状态行,经 per-user 常连广播下发,
  六端共用一份订阅出口;小程序与 App 端的管理入口在别处,所以状态行附一句去哪配的提示。
- **会话目标(goal)服务化**:目标状态机(六态)存在会话元数据里,**零数据库迁移**;
- **一次调用一个编号,库里查得到**:每条 provider 调用流水都带上本轮的 W3C trace id(与响应头 `X-Trace-Id` 同一个值),排查时给一个编号就能反查那次调用花了多少 token、错在哪一段;编号本身**不上界面**,也**不参与任何授权判定** —— 它只是关联键,拿不到本轮请求时宁可留空也不造一个看起来像的。
  跨端同一份状态词汇,不建第二份枚举。

诚实边界(2026-09-29 现测,替掉本段原来那句"本机没有运行中的服务"):本机**有** PostgreSQL 18.6(`127.0.0.1:5432`,库 `ihui`)与 Redis(memurai,`127.0.0.1:6379`),`api`(8802)与 `ai-service`(8803)在听、`web`(8801)不在听,也没有 IHUI* 服务形态。所以验证分两档:**数据库侧本机真跑得通**(D172 的迁移已在一次性空库里应用两次并量过列/索引形状),**到端渲染与真机行为仍未取证**(没有浏览器会话,§17 的 4 状态截图要有起来的 web 才拍得出)——不写成"已实测"。
那句"没有数据库"是怎么来的:**拿另一台机的端口号(8810/8811)当引擎存在性去探,探不到就下结论**。而本机 PG 在默认 5432,`apps/api/.env` 的 `DATABASE_URL` 一直写着 `127.0.0.1:5432/ihui` —— 应用的连接串才是权威入口。口径:**判"某引擎在不在"要先读被审应用自己那份 DSN**, 端口注册表(AGENTS §2 / `docs/port-management.md`)记的是"约定端口",不是"这台机装了什么"。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
