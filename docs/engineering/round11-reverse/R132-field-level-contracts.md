<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R132 — 字段级契约：863 个字段槽里只有一个 snake_case

**取证对象**：`codex.exe app-server generate-json-schema` 已导出的 329 个 stable 对象（R130 产物，
`D:\DevEnv\Temp\r130\schema-stable`，三层：顶层 37 / `v1` 2 / `v2` 290）。
**方法**：递归读每份 JSON 的 `properties` 与 `required`，逐槽计数；全部机器派生，一个字段名都不是手敲的。

## 一、规模

| 项 | 数 |
| --- | --- |
| 对象总数 | **329** |
| 声明 `properties` 的对象 | **285**（另 44 是信封或别名，没有字段） |
| 声明 `required` 的对象 | **259** |
| `required` 字段合计 | **521** |
| 字段槽合计 | **863** |
| 去重字段名 | **349** |
| 带 `description` 的字段 | **312** |
| 可空联合（`["x","null"]`） | **223** |

## 二、命名：线上的 camelCase，例外只有四个槽——而且是同一个字段

863 个槽里 **859 个 camelCase、4 个 snake_case**。四个全是 `_meta`，分布在四个转发 MCP 原始载荷的对象上：
`McpServerElicitationRequestResponse` / `McpResourceReadParams` / `McpServerToolCallParams` /
`McpServerToolCallResponse`。

这不是「协议里混着两种命名风格」，而是**协议遇到外部约定时不改名**：`_meta` 是 MCP 规范自己的保留键，
过边界时原样带过。判断「我方字段命名对不对」的正确标尺因此是：**除 `_meta` 外，线上不存在任何下划线字段**。

## 三、194 个字段没有 `type`，不是漏写，是被引用型

| 组合器 | 槽 |
| --- | --- |
| `$ref` | **92** |
| `anyOf` | **71** |
| `allOf` | **26** |
| 裸 schema（无任何关键词） | **5** |

读成「未类型化」是错的——它们是**由引用确定的类型**。这也解释了为什么「按 type 分类」的统计会天然缺一块：
任何只数 `type` 的方法都会漏掉近四分之一的字段。

完整类型分布（12 桶，合计恰为 863）：`string` 283 / `no-type` 194 / `union(string,null)` 161 / `array` 75 /
`boolean` 51 / `union(integer,null)` 21 / `union(array,null)` 20 / `integer` 19 / 布尔 schema 13 /
`union(boolean,null)` 13 / `union(object,null)` 8 / `object` 5。

## 四、三个最大的请求对象：协议关心的是意图，不是管道

**`TurnStartParams`，19 字段，只必填两个：`input`、`threadId`。**
其余 17 个（`model`/`cwd`/`approvalPolicy`/`approvalsReviewer`/`sandboxPolicy`/`outputSchema`/
`parentTurnId`/`rootTurnId`/`disabledPluginIds`/`effort`/`personality`/`summary`/`toolOutput`/
`turnTrigger`/`serviceTier`/`serviceTierForTurn`/`clientUserMessageId`）**全部可选，且多为可空**。

**`ThreadStartParams`，15 字段，`required` 为空——一个都不必填。**
`approvalPolicy`/`approvalsReviewer`/`baseInstructions`/`config`/`cwd`/`developerInstructions`/`ephemeral`/
`model`/`modelProvider`/`personality`/`sandbox`/`serviceName`/`serviceTier`/`sessionStartSource`/`threadSource`。

**`ThreadForkParams`，15 字段，只必填 `threadId`。**

三处只有量过才看得见的非对称：

1. **`ephemeral` 有两种可空性**：`ThreadStartParams` 里是 `["boolean","null"]`，`ThreadForkParams` 里是裸 `boolean`。
   同一个概念，两处写法不同 —— 说明这两个对象不是同一个作者在同一时间写的。
2. **`TurnStartParams` 同时有 `serviceTier` 和 `serviceTierForTurn`**。一个概念两个字段，
   是改名改不动旧名时的典型痕迹。
3. **`ThreadStartParams.config` 是 `["object","null"]` + `additionalProperties`** ——
   一个故意不设边界的袋子。**配置面在协议侧根本不可枚举**，只能从二进制与本地 `config.toml` 反推。

## 五、家族对象数：Thread 一家占了 27.6%

`Thread` **91** / `Plugin` 24 / `Fs` 19 / `Turn` 11 / `McpServer` 10 / `Apps` 6 / `Item` 4 / `Account` 3
（八家合计 168，占 329 的 51%；其余 161 个是 `Command*`、`Auth*`、`Log*`、`Notification` 等跨家对象）。

Thread 一家的体量说明这个产品的状态几乎全挂在会话上：列表、读、归档、重命名、分叉、恢复、压缩、
以及 14 个字段的 `ThreadResumeResponse`。`Account` 只有 3 个对象（登录完成通知、限额更新通知、更新通知），
说明账户在这里只是**被通知的对象**，不是**被操作的资源**。

## 五之二、取值面：我第一次数出 0 个 enum，那次是错的

**第一遍扫描 `properties` 得到 `enum` 计数 = 0。这个结论是假的。**
每个对象文件都自带一份 `definitions` 块，值集住在属性下一层：`approvalPolicy` 不是内联枚举，
而是 `anyOf: [{"$ref": "#/definitions/AskForApproval"}, {"type": "null"}]`。
只看 `properties` 的人会同时得到「无类型 194」和「无枚举 0」两个假象——它们是同一件事的两面。

递归重数之后：

| 项 | 数 |
| --- | --- |
| `enum` 子 schema 总出现（递归） | **3,488** |
| 其中在对象正文（匿名内联） | **224** |
| 其中在每份文件自带的 `definitions` 子树里 | **3,264** |
| 有名可引用的独立值集 | **131** |
| 131 套值集在 definitions 上出现的次数合计 | **700** |
| 只有一个取值的伪枚举（常量），按出现计 | **56** |
| `const` 关键字 | **0** |

131 套里重复最狠的是 `ImageDetail`（`auto`/`low`/`high`/`original`）**24 次**；
`CollabAgentTool`、`CommandExecutionStatus`、`McpToolCallStatus` 等各 **19 次**。
最宽的是 `RealtimeVoice`，**35 个取值**。

**「只有一个取值的枚举」是这轮最值得记的形状**：`AgentMessageDelivery = ["async"]` 这类共 56 处。
它不是枚举，是**把常量写成了枚举**——留了一个将来加值的口子，而当下只有一个分支。
`const` 一个都没有，说明这个协议表达常量的唯一手段就是单值 enum。

## 五之三、宽严：329 个对象里只有 1 个禁止多余字段

| `additionalProperties` | 对象数 |
| --- | --- |
| `false`（拒绝未知字段） | **1** |
| `true` | **0** |
| 缺省 | **328** |

draft-07 里缺省等于允许，所以**这份协议字典整体是宽松的**：328 个对象对多余字段不表态。
换句话说，客户端多发一个协议不认识的键，字典层面**不构成违约**。
属性层另有 13 处 `additionalProperties`（`ThreadStartParams.config` 就是其中最有代表性的一个）。

**唯一那个严格的点，位置很说明问题**：`ModelProviderConfigWriteParams` ——
只有 `settings` 一个字段、必填、且 `additionalProperties: false`。
全字典 329 个对象里，只有「写模型提供方配置」这一条路拒收未知键。
这不是随机选中的：那是凭据与端点的写入口，一个拼错的键在这里不该被静默接受。

这条对「照着实现」有直接用处：**不能拿这份 schema 当入参白名单用**——
除了 provider 写这条路，其余 328 个对象都不会因为你多带一个键而报错。

## 五之四、引用面与文字面

**引用面**：92 个属性直接指向命名定义，**只落到 61 个不同目标** —— 说明引用是被复用的，不是一次性展开。
最常被引用的是 `AbsolutePathBuf`（7）与 `Thread`（7），其后 `RequestId`(4) / `Turn`(4) / `AskForApproval`(3)。
另有 **71** 个引用藏在 `anyOf` 分支里、**26** 个在 `allOf` 里（`approvalPolicy` 就是这类：
属性本身没有 `type`，也没有 `$ref`，只有一个 `anyOf: [{$ref: AskForApproval}, {"type":"null"}]`）。

递归数下来 `$ref` 关键字共 **4,586** 处——远大于 92+71+26=189。
差额全是**每份文件把自己用到的 definitions 整段重抄一遍**造成的。
这意味着「按原始计数理解协议」会同时错两次：既会把 189 看成 4586（重抄放大 24 倍），
也会把「属性层 0 个直接引用」看成「没有引用」。

**踩过的坑值得记**：在 PowerShell 里用双引号 here-string 跑这段分析，
`$ref` 会被当变量展开成空字符串，于是输出「0 个引用目标」。**false 0 又一次出现**——
和前面「0 个 enum」是同一种错误家族：**查询本身坏了，而结果看起来只是一个正常的零**。

**文字面**：312 个属性带 `description`，其中 **59** 个以 `Optional` 开头 —— 那是把可空联合已经说过的话
用散文再说一遍；**82** 个含条件词（`when` / `if` / `unless` / `only`），即**行为藏在文字里而不是 schema 里**。
中位长度 72 字符，最长 726 —— 那不是标签，是一篇说明文。



## 六、落地

- `apps/ai-service/app/core/app_server_field_contracts.py`
  12 桶类型分布（合计断言 == 863）、组合器分解（92/71/26/5）、四个 `_meta` 槽及其持有对象、
  三份逐字字段表与各自 `required`、八家族计数、131 套 enum 值集全表、`additionalProperties` 三桶、
  引用面（92 / 61 / 71 / 26 / 4586）与文字面（312 / 59 / 82 / 72 / 726），
  以及 `validate_contract()` + `validate_value_surface()` 两组自查（每条都被单测反向变异钉住）。
- `apps/ai-service/tests/test_app_server_field_contracts.py`（**34 passed**）
  含八条反向变异：篡改类型分布桶、加第二个 snake_case 字段、让 `required` 指到未声明字段、
  让 `ThreadStartParams` 声称有必填字段、改掉 `ImageDetail` 的取值、把 `additionalProperties: false` 数加成 2、
  改掉直接引用数、改掉描述总数。
- `mypy --strict` 1005 文件零问题；`ruff` 干净（首轮 5 处 Yoda 条件由 `--fix` 收口）。

## 七、边界（写清楚，不糊）

- **只钉了三份逐字字段表**（`TurnStartParams` / `ThreadStartParams` / `ThreadForkParams`），
  剩下 282 个有字段的对象已提取到磁盘但没逐条钉进模块。聚合数是精确的，逐对象表是生成而非手打的。
- **131 套 enum 值集已全量钉住**，引用面已量（92 直接 + 71 `anyOf` + 26 `allOf` → 61 个目标），
  但**没有逐字段标出「哪个字段指向哪个定义」** —— 只钉了最常被引用的六个目标。
- **`description` 只做了计数与形态分类**（312 / 59 / 82 / 72 / 726），**没逐条读内容**。
  那 82 条含条件词的文字里是真实行为约束（何时刷新、什么状态算失败），读它们才是把行为面补齐。
- **`additionalProperties: false` 那唯一 1 个对象已点名**（`ModelProviderConfigWriteParams`，见五之三），
  但它 `settings` 袋子的内部形状没查 —— 那是 provider 配置的真实字段面，字典在这里不设边界。
- **`ModelProviderConfigWriteParams.settings` 的实际键**只能从二进制或本地 `config.toml` 反推，
  字典明确不表态。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
