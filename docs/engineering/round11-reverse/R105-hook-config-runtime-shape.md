<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R105 — 问运行期的解析器：hook 配置到底是什么形状

> 上一轮结束时我写下"最有价值的下一步不是再挖第八个图表 flag，而是让 hook 真的跑起来一次"。
> 这轮去做了，结果分成两半：**形状拿到了，触发没拿到。**

## 1. 方法换了：不问二进制，问解析器

R94 是从 `codex.exe` 里读出 hook 的类型。这轮换了个问法——**把故意写错的 TOML 喂给真正在跑的解析器，读它吐出来的错误。**

它三次纠正我，每次都给出"期望什么"：

```
1  [hooks.UserPromptSubmit]  →  invalid type: map, expected a sequence
                                  in `hooks`

2  [[hooks]]                 →  invalid type: sequence, expected struct HooksToml
                                  in `hooks`

3  [hooks.state]
   enabled = true            →  invalid type: boolean `true`, expected struct HookStateToml
                                  in `hooks.state.enabled`
```

**每一条错误都是一次免费的规格说明。**

## 2. 三条错误推出的五层结构

**第一条**：每个事件的值必须是**数组**，不是单张表。
⇒ `[[hooks.user_prompt_submit]]`（双括号），不是 `[hooks.user_prompt_submit]`。

**第二条**：`hooks` 本身是 **struct**，不是数组。
⇒ 所以事件名是它的**字段**，`[[hooks]]` 是错的。

**第三条**：`hooks.state` 是 **map**，值是 `HookStateToml`；我写的 key `enabled` 恰好是个合法名字。

合起来：

```
hooks                     struct  HooksToml
hooks.<event>             array   MatcherGroup        ← 14 个 snake_case 事件名
hooks.<event>.hooks       array   Handler
Handler                   { type, command / prompt / agent / mcp_tool }
hooks.state               map     <key> -> HookStateToml
HookStateToml             { enabled, trusted_hash, trusted_content_hash }
```

## 3. 这是第一次把两个来源钉在一起

R94 读的是二进制里的类型名（`HooksToml`、`MatcherGroup`、`HookStateToml`）。
这轮读的是**活着在跑的解析器**。

**两边的结论对上了**：

| 层 | 二进制（R94） | 运行期（本轮） |
| --- | --- | --- |
| hooks 根 | `HooksToml` | `expected struct HooksToml` |
| 每事件 | `MatcherGroup`（2 字段） | `expected a sequence`（数组） |
| Handler | `Command/Prompt/Agent/McpTool` | TOML 全接受 |
| state | `HookStateToml`（3 字段） | `expected struct HookStateToml` |

**四十几轮里，这是第一次让"二进制读出来的 schema"和"运行期实际接受的结构"互为印证。**

## 4. 然后——它一次都没跑

这是必须直说的部分。

**我写了 5 种配置，全部被干净接受，然后全部什么都没发生。**

| 配置 | 解析结果 | 执行结果 |
| --- | --- | --- |
| `session_start` + `matcher="*"` + command | 接受 | **没跑** |
| `user_prompt_submit` 用 `[[...]]` | 接受 | **没跑** |
| `user_prompt_submit` 提到 `[hooks.state]` 布尔 | 接受 | **没跑** |
| `hooks.state.enabled` 写成三字段的 `HookStateToml` | 接受 | **没跑** |
| `hooks.state.user_prompt_submit`（用事件名当 key） | 接受 | **没跑** |

`--dangerously-bypass-hook-trust` 是**认的**——它连打两遍警告：

> `--dangerously-bypass-hook-trust` is enabled. **Enabled hooks** may run without review for this invocation.

**注意这句话的条件**："**Enabled** hooks"。它绕过的是 **review**，不是 **enabled**。

⇒ **绕过信任 ≠ 打开开关。** 我一直在绕 review，而 hook 根本没被 enable。

## 5. `enabled` 到底在哪？

排除了两个地方：

- `.codex-global-state.json`（1315 B，全部内容读过）：没有 hook 键
- `state_5.sqlite` 17 张表：没有 hook 表（与 R94 的 `HOOK_COLUMNS_IN_STATE_DB: 0` 一致）

`hooks.state` 这个 map 是**可以被写的**（配置文件里能写），但 R94 早就记过：

> `hooks.state.enabled-table-parses-but-inert`

**这轮亲手复现了它**——写进去，解析了，不生效。

## 6. 四个候选原因，一个都没排除

1. `exec` 模式压根不分发 hook
2. `enabled` 用的 key 不对（我试了事件名和自由名）
3. handler 需要先被**安装**（`trusted_hash` 暗示有安装/信任流程）
4. 那个事件在 `exec` 模式下永远不发生

**四个都还立着。** 我没有把它们中任何一个当成结论。

## 7. 落成

`apps/ai-service/app/core/codex_hook_config_runtime_shape.py`：

- `RUNTIME_TYPE_ERRORS`（3 条，逐字，含路径行）
- `LAYERS`（5 层）、`LAYER_COUNT`
- `ACCEPTED_CONFIGURATIONS`（5 条，全部"接受但没跑"）
- `TRUST_FLAG_RECOGNIZED = True`、`BYPASS_DOES_NOT_IMPLY_ENABLED = True`
- `SHAPE_ESTABLISHED = True`、`TRIGGER_ESTABLISHED = False`
- `HANDLER_EXECUTED = False`、`PAYLOAD_CAPTURED = False`
- `CANDIDATE_REASONS`（4 条）、`REASONS_ARE_UNRESOLVED = True`

**14 passed**、ruff 全绿、水印 2/2。

两条反向变异钉住诚实性：
- 把 `TRIGGER_ESTABLISHED` 改成 `True` → 红
- 把 `ACCEPTED_DOES_NOT_MEAN_RAN` 改成 `False` → 红

## 8. 副作用已清理

探测过程中改过 `C:\Users\Administrator\.codex\config.toml` 多次（加 hook 段、写成错误的形态）。
**已恢复原状**（备份在 `D:\DevEnv\Temp\config.toml.bak`），当前文件里**没有任何 `hooks` 键**。
探针脚本与 payload 文件也都删了。

## 9. 诚实边界

1. **hook 仍然没有真正执行过一次。** 这轮的成果是"形状"，不是"触发"。
2. 4 个候选原因都未排除。
3. `enabled` 的真正存储位置未找到——不在 global-state.json，不在 state sqlite，写配置文件又惰性。
4. `matcher="*"` 我只试了通配，具体匹配器的语义（匹配什么？工具名？事件子类型？）没测。
5. 顺带看到 `codex exec` 报 **401 Unauthorized** 直连 `api.openai.com`——R93 配的 relay 当时不在链路上，所以这轮所有 `exec` 调用其实都没真正发到模型。这一点也可能是 hook 不跑的原因之一，但我没有验证。

## 10. 合规

只改了自己机器上的用户配置文件，改完恢复；没有触碰对方源码。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
