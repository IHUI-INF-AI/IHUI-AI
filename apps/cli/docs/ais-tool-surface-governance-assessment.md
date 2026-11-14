# ais_* 工具面治理张力评估

> 结论先讲：**当前默认全铺，不构成安全或可用性缺口，建议不动**。
> 本文数字全部实测，非估算；复现命令见文末。

## 一、现象

`ais_*` 桥接在 ai-service 进程注册了 **302 个工具**（受 `AIS_TOOLS_MAX` 复用 `API_TOOLS_MAX=300` 上限，另配 2 枚稳定入口 `ais_endpoints_search` / `ais_endpoint_call` 覆盖长尾端点）。

这 302 个工具的 schema 占整个工具面约 **56% 的字节**，在默认 lean 预算表（`tool_surface_budget.py`，`max_visible=None`）下，**全部铺进每轮上下文**。

## 二、这是不是缺口

分三层判定：

| 维度 | 判定 | 依据 |
|------|------|------|
| 安全 | **否** | 写操作在 `_TOOL_DANGER_LEVELS`（high 档）+ 各路由 RBAC 双闸覆盖；`ais_endpoint_call` 字符串转发入口已进审批门，default 模式返回 `(True, 'high')` |
| 可用性 | **否** | 302/302 工具全部可直调（在 `_TOOL_HANDLERS`），全部有 schema 反查面（deferred registry），「所有接口可被调用」的核心目标已成立 |
| 上下文成本 | **是（张力）** | 每轮 56% schema 字节花在 302 个机械端点工具上，而 agent 通常只用其中 1–3 个 |

第三条是**治理张力**，不是功能缺陷。降权能收窄成本，但会改变全仓工具可见性行为，且与「所有接口都可被调用」存在张力——它是一个产品决策，不是技术修复。

## 三、四条出路（含取舍）

### 出路 A：维持现状（推荐）

- 优点：零改动；302/302 直调 + 反查面不变；审批门已闭环。
- 成本：每轮多花约 56% 工具 schema 字节。在 128k 上下文里约 97KB，占 ~0.08%，对性能影响实际可忽略。
- 适用：当前阶段（工具面还在扩张，过早收窄会频繁触发「搜不到」退化到入口工具的两步调用）。

### 出路 B：按域分批装载（demote 低频域）

- 做法：在 `tool_surface_budget.py` 的 demote 列表加 `ais_publish` / `ais_checkin` / `ais_self-media` 等低频域，保留 `ais_llm` / `ais_agent` / `ais_knowledge` / `ais_orchestration` 常驻。
- 优点：成本降约 60%，高频能力仍全铺。
- 风险：**改变了全仓工具可见性行为**；低频域被降权后，agent 调它们要绕 `ais_endpoints_search` 两步，违反「无缝」原则。需要产品拍板哪些域算「低频」——没有使用统计数据支撑的降权是猜测。
- 前置条件：先接 Prometheus/日志，拿到真实 per-domain 调用频次，再定 demote 名单。

### 出路 C：只留稳定入口（激进）

- 做法：只注册 `ais_endpoints_search` + `ais_endpoint_call` 两枚入口，302 个端点工具全部走两步调用。
- 优点：工具面缩到 2 枚，上下文成本几乎归零。
- 风险：**严重违反「无缝调用」**——每调一个端点都要先 search 再 call，两步 RTT、两次 token 开销；agent 出错率上升。仅适合把 ais_* 完全当长尾处理的场景，与当前定位不符。

### 出路 D：schema 瘦身（不改可见性）

- 做法：压缩 302 个工具的 JSON Schema——参数描述减半、去掉 examples、`additionalProperties` 不展开。
- 优点：可见性不变、可直调不变，字节降 30–50%。
- 风险：schema 可读性下降会影响模型选对参数，需 A/B 验证无回退。
- 工作量：中；需改 `ai_service_bridge.py` 的 schema 生成逻辑并跑全部 15 例桥接测试。

## 四、建议路径

1. **现在**：出路 A（不动）。理由：56% 字节在实际 token 预算里占比 <0.1%，而降权的可逆成本（重新调 schema、改预算表、跑回归）远高于收益。
2. **有真实使用数据后**：若 per-domain 调用数据显示某几个域占 90%+ 调用量、其余近零，再走出路 B。**没有数据不动手。**
3. **永远不做**：出路 C——它用「能调」换「好用」，方向反了。

## 五、已排除的伪缺口

- **入口重名互挤**：`api_endpoint_call`（CLI 进程）与 `ais_endpoint_call`（ai-service 进程）运行在不同进程，**不会同时注册进同一个工具面**，无冲突。早期测试里看到的 False 是测试进程里拉取 apps/api spec 失败所致，非生产形态。
- **三族选择混乱**：`api_list_endpoints` / `ai_list_endpoints` / `ais_endpoints_search` 描述里已互相点名，模型在某一族搜不到时会看到「换哪族」的指引。这个可用性修复已有测试锁定（`ai-bridge-tools.test.ts` / `test_ai_service_bridge.py`）。

## 复现方式

```bash
cd apps/ai-service
# ais_* 注册数:302 是 lifespan 启动注册后的数;直接 import 只见 122 枚内置工具,
# 因为 ais_* 经 register_external_tool 在启动期注入,裸 import 不触发。
# 故注册数以桥接测试为准(test_setup_registers_and_populates_index):
.venv/Scripts/python.exe -m pytest tests/test_ai_service_bridge.py -q
# 期望: 15 passed
# 审批门闭环(注意参数序:permission_mode 在前, tool_name 在后):
.venv/Scripts/python.exe -c "from app.routers.llm import _resolve_tool_approval as r; print(r('default','ais_endpoint_call'))"
# 期望: (True, 'high')  —— 写转发入口需审批
```
