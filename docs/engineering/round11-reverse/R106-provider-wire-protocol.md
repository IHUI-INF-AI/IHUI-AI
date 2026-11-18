<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R106 — provider 的线协议：为什么本地模型池喂不进这个版本

> R105 留了一句话：`exec` 从没真正到达模型（401 直连 `api.openai.com`），所以"hook 没跑"可能压根没走到能触发它的代码路径。
> 这轮去补那个前提——把 codex 指向本地模型池——结果补不动，而且找到了补不动的确切原因。

## 1. 出发点

R93 当时在这儿"打通"过 relay：codex → 本地 8802 → 我们的后端 → 模型。现在同样的配置报 401，直连 `api.openai.com`。

先查现状：
- 8802 **在听**，`GET /v1/models` 返回 **200 + 1043 个模型**
- 但 `config.toml` 里**一条 provider 配置都没有**（之前恢复原状时是整份还原的）

所以我重新配了一遍，然后撞上第一条墙。

## 2. 第一条：chat 协议被砍了

```
Error loading config.toml: `wire_api = "chat"` is no longer supported.
How to fix: set `wire_api = "responses"` in your provider config.
More info: https://github.com/openai/codex/discussions/7782
in `model_providers.ihui.wire_api`
```

**这不是"不推荐"，是"不支持"**——配置直接拒绝加载，带修复指引指向一份 discussion。

⇒ **这个版本只认 `responses`，`chat` 已被删除。**

R93 那套（chat completions）**被版本升级作废了**。这是个必须记下来的修正。

## 3. 第二条：8802 根本不是我们的 relay

查 8802 的监听者：

```
OwningProcess  23060
Path           ...\sandbox_runtime\bases\...\node\node.exe
```

**是豆包 sandbox runtime 的 node 进程**，不是 `apps/api`。

⇒ 那 1043 个模型是 **sandbox runtime 自己的模型池**，不是我们后端的反代号池。
⇒ 我们自己的 api / ai-service（8000 / 8080 / 3000）**一个都没在跑**。

## 4. 第三条：两边的能力正好反过来

拿 codex 现在唯一接受的协议去问本地池：

```
POST /v1/responses          -> 502  {"code":502,"message":"AI service unavailable (502)"}
POST /v1/chat/completions   -> 400  {"code":400,"message":"upstream 400 (client error)"}
                            -> 503  {"code":503,"message":"AI service unavailable (502)"}
```

| | chat | responses |
|---|---|---|
| 本地池 | 路由存在，上游坏 | **502，没实现** |
| codex 本版 | **已删除** | **唯一接受** |

**四个格子，全是对角线**：

```
本地池    chat ✓(坏)   responses ✗
codex    chat ✗        responses ✓
```

**它能给的正是它不要的，它要的正是它没有的。**

## 5. 结论

`GET /v1/models` 通、能列 1043 个模型，但**生成路径不通**。列清单和真出话是两件事。

要让本地池给这个版本的 codex 供能，必须有一个**适配器**：对 codex 讲 Responses，底下转成 chat。这个适配器在本机不存在，做它是另一件工程。

⇒ **本轮没有修好这个网络阻塞。**

⇒ 但重要的是：**R105 那个 401 是真的阻塞，不是别的症状的伪装。** 现在这条被确认了——而且确认它阻塞的具体原因，比我原先想的更硬：不是"relay 掉了"，是"**协议被砍了**"。

## 6. 落成

`apps/ai-service/app/core/codex_provider_wire_api.py`：

- `SUPPORTED_WIRE_APIS = ("responses",)` / `REMOVED_WIRE_APIS = ("chat",)`
- `REMOVAL_ERROR_TEXT`（逐字，含修复指引与讨论链接）
- `LOCAL_RESPONSES_STATUS = 502` / `LOCAL_CHAT_STATUSES = (400, 503)`
- `LOCAL_POOL_MODEL_COUNT = 1043`、`MODEL_LIST_WORKS = True`
- `CAPABILITY_MATRIX`（4 格）+ `MATRIX_IS_INVERTED = True`
- `ADAPTER_REQUIRED = True` / `ADAPTER_EXISTS_HERE = False`
- `R93_RELAY_STILL_VALID = False` / `R93_INVALIDATED_BY_BUILD_UPGRADE = True`
- `NETWORK_BLOCKER_CONFIRMED = True` / `NETWORK_BLOCKER_FIXED = False`
- `HOOK_PREMISE_RESOLVED = False`

**14 passed**、ruff 全绿、水印 2/2。

两条反向变异：`SUPPORTED_WIRE_APIS` 塞进 `chat` → 红；`HOOK_PREMISE_RESOLVED` 改 True → 红。

## 7. 副作用

`config.toml` 已还原（无 `model_providers` 段），`IHUI_RELAY_KEY` 环境变量已清除。
探针只做了 GET 和两次 POST，没有写对方的文件系统。

## 8. 诚实边界

1. **网络阻塞没修好**。本地池不能给这个版本供能，除非做适配器。
2. **hook 那件事仍然原样**：一次都没跑过，前提也没补上。
3. **R93 的"已打通"结论已被推翻**——当时的 chat 路径现在被拒。
4. 我只探了 `/v1/responses` 和 `/v1/chat/completions` 两个路由，没系统枚举本地池的全部路由。
5. 适配器要支持到什么程度（streaming？tool calls？）我没评估。
6. 顺带一个观察：本地池报的错是 `"AI service unavailable (502)"` 与 `"upstream 400 (client error)"`——**它把上游错误透传了**，这是它自己的措辞，不是 codex 的。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
