<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R133 — 行为写在散文里：27 条契约，外加一次对自己上一轮数字的更正

R132 说「312 条描述里有 82 条含条件」。**那个 82 是错的**，这一轮第一件事就是改它。

## 一、先认错：82 是匹配器的缺陷，不是数据的性质

匹配器找的是 `" if "`（前后各带一个空格）。**任何以 `If` 开头的句子都不含 `" if "`** ——
`If None, there are no more items to return.` 这类描述全部漏掉。

把文本前后各补一个空格再匹配，条件句从 **82** 变成 **93**，多出 **11 条**。

为什么这个 bug 活了一整轮：`defaults to` / `cannot be combined` / `deprecated` 这些针都**不会出现在句首**，
所以普查的其余九个桶一个数都没错。**只有能开句的那个针坏了**——`if` 是唯一能当句首的连接词。
这类缺陷的形状是「只污染一个维度、其余全对」，所以核对别的桶永远发现不了它。

R132 的 `DESCRIPTION_WITH_CONDITIONAL` 已从 82 改为 **93**，并在常量旁写明成因；
R133 的检测器改为补空再匹配，测试里专设一条钉住「句首 `If` 也算条件句」。

## 二、27 条规则，11 类

读的是 93 条条件句（12,901 字符）。规则表按类型分，每条都带来源字段：

| 类 | 条数 | 代表 |
| --- | --- | --- |
| `steering-suppressed` | 4 | `parentTurnId` / `rootTurnId` / `serviceTierForTurn` / `turnTrigger` 在「向活跃 turn 追加输入」时全部被忽略 |
| `explicit-empty` | 4 | 空数组与省略是两个意思 |
| `mutual-exclusion` | 2（普查 5） | `sandboxPolicy` 不能与 `permissionProfile` 同时给；缓冲输出与流式输出互斥 |
| `default` | 2（普查 25） | 反直觉的那两个 |
| `sentinel` | 2 | 文件时间缺失写 `0` 而不是 `null` |
| `three-state` | 2（普查 17） | `sectionId` 与 `archived` |
| `deprecated-path` | 2（普查 15） | 全历史水合已弃用，正路是 `excludeTurns` + 两个 list 方法 |
| `vendor-uncertainty` | 2 | 字典自己承认「unclear if this is honored today」 |
| `precondition` | 3（普查 1） | `expectedTurnId` 不匹配就失败 |
| `design-rationale` | 3 | 为什么网络审查的 `targetItemId` 必须是 null |
| `compat-absent` | 1（普查 11） | 老服务端不返回 `collaborationMode` |

## 三、最值得记的五条

**1）「不给数字」有两种意思，散文取消了通常那种。**
`ThreadShellCommandParams.timeoutMs`：省略或 null ⇒ **一小时**；`0` ⇒ **立刻超时**，不是无限。
而且它「不影响 RPC 的即时确认」——即超时是命令的执行属性，不是请求的成败。

**2）缓冲与流式是二选一，输的那一侧是空而不是缺。**
`CommandExecResponse.stdout`「Empty when stdout was streamed via `command/exec/outputDelta`」。
消费者若用「字段在不在」判断有没有输出，会把「流式」误读成「没有输出」。

**3）空数组 ≠ 省略。**
`modelProviders`「present but empty, includes all providers」；`sourceKinds`「omitted or empty defaults to interactive sources」。
同样是空，前者放开全部、后者收窄到交互来源——**两个字段的同一个「空」语义相反**。

**4）一个字段三种状态，不是布尔也不是过滤。**
`sectionId`：省略 = 所有分区，`null` = 未分区线程，给 id = 只要那一区。
`archived`：`true` = 只要归档；`false` 或 `null` = 只要未归档（这里 null 反而塌成 false）。

**5）字典自己承认有两处不确定。**
`grantRoot`「unclear if this is honored today」，`FileChangeRequestApprovalParams` 那处还多挂一个 `[UNSTABLE]`。
**协议的自我报告里写着「这个字段可能什么也不做」** —— 照抄行为时，这是一个已知空转点。

## 四、三条设计理由被写进了字典

- **网络审查没有目标条目**：网络调用由 `CommandExecution` 条目触发，但审查的对象是那次调用，
  把 `target_item_id` 指向命令条目「would be misleading」——所以刻意留 `null`。
- **elicitation 的 turn 只是相关性**：MCP 把 elicitation 建模为独立请求，靠 MCP request id 识别；
  turn 上下文是 app-server 侧的关联，**不是协议身份的一部分**，所以可空。
- **完成遥测不属于存储状态**：`contentTokenCount`「Completion telemetry is not part of the stored thread item」
  —— 它读不回来。这解释了 R131 里 `thread_items` 为什么没有这一列。

## 五、落地

- `apps/ai-service/app/core/app_server_prose_rules.py`：27 条规则 + 11 类 + 10 桶普查 + 93/219/12,901 的面，
  `validate_prose_rules()` 逐条自查（含「11 条是补空找回来的」这条守恒）。
- `apps/ai-service/tests/test_app_server_prose_rules.py`（**20 passed**）
  四条反向变异：复制一条同字段规则、打破 312 的分割、把不确定性加成 3、删掉一整类。
- 同批更正 `app_server_field_contracts.py` 的 82 → 93 与它的测试断言。
- 两模块合跑 **54 passed**；`mypy --strict` **1006 文件**零问题；`ruff` 干净。

## 六、边界

- **219 条非条件句没读规则**。它们不含 `when`/`if`/`unless`/`only`，但可能仍描述约束
  （例如「以毫秒为单位」「Opaque cursor」这类）。读到规则为止的那一部分才是这一轮的成果。
- **规则文本是手抄的**（数字是机器量的）。逐字片段加了引号，整段原文在
  `D:/DevEnv/Temp/r133/conditional.txt`（不入库）。
- **`3` 条 precondition 与普查的 `1` 不一致**：普查只数了含 `precondition`/`fails when`/`must match`
  三种字面的句子，而「Required for …」「Only valid when …」是另外两种前置条件的表述。
  **普查口径比规则表窄**，这个差额是已知的，不是错误。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
