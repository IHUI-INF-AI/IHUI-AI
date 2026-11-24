<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 模型目录双引擎所有权仲裁（2026-11-24）

## 结论：一个 provider 只有一个模型目录所有者

`ai_model_config_models` 表被两套常驻引擎写，历史上没有仲裁，导致"自动上架看似配了却不生效"。现已按平台类型划清所有权：

| 引擎 | 拥有的平台 | 清单来源 | 上游消失时 | 调度 |
|---|---|---|---|---|
| **apps/api `relay-models-sync`** | 14 家号池反代平台（`RELAY_PROVIDERS`：trae/workbuddy/codearts/qoder/codex/opencode/minimax/zcode/loomy/doubao/lingma/grokbot/raccoon/cursor） | 号池代表号的上游清单（适配器 `listModels`/`listModelsDetailed`；qoder 走 SDK `available_models_update` 桥帧） | **软下架** `enabled=false`，可自动复活 | 每 15 分钟 |
| **apps/ai-service `model_sync`** | `free_provider_registry` 中除上述 14 家外的全部直连厂商（moonshot/zhipu/openai/anthropic/…） | 各家直连 `/v1/models`，key 驱动 | **物理删除**旧行，重新上架走 INSERT | 默认 6 小时 |

## 为什么必须仲裁

交集三家 `qoder` / `minimax` / `doubao` 同时出现在两边 registry，命中同一个 `ai_model_config` 父行（`owner_uuid IS NULL`）：

- Python 引擎按 provider_code 拉直连清单，把不在清单里的行当 stale **物理删除**——包含 relay 自动登记、且刻意设为 `is_relay_public=false` 的 qoder 新模型；
- Python 的 `ON CONFLICT DO UPDATE` 把 relay 刻意设私有的状态**覆盖成公开**；
- 结果：relay 每 15 分钟上架的模型，被 Python 下一轮 6 小时同步静默删除/改写，用户看到"配置齐全却不生效"。

修复：`model_sync.py` 定义 `RELAY_OWNED_PROVIDER_CODES` 所有权常量，`_get_configured_providers` 与 `sync_single_provider` 都跳过这些 code。号池平台的模型目录**唯一所有者 = relay-models-sync**。

## 防漂移

- `RELAY_OWNED_PROVIDER_CODES` 与 TS 单一真相源 `apps/api/src/services/relay-account-format.ts:RELAY_PROVIDERS` 由 `apps/ai-service/tests/test_relay_ownership_boundary.py` 跨语言守门逐字比对，任一边新增/删除平台而对边没跟，测试立即红。
- 反向用例钉死：号池平台即便配了真实 key 也不进 Python 同步清单；admin 手动定向同步号池平台被明确拒绝；直连厂商判据不误杀。
- 安全阀保留为第二道防线：Python `_AUTO_DISABLE_MAX_RATIO/ABS_FLOOR` 与 TS `AUTO_DELIST_MAX_RATIO/ABS_FLOOR` 同参（0.5 / 2），空清单都不下架整家。

## "全自动"的客观边界

- **已知平台的新 key / 新模型 / 旧模型清理**：全自动。新 key 入号池即被 DB 动态枚举纳入；新模型按代表号上游清单 15 分钟内上架；上游消失模型软下架、重现自动复活。
- **全新第 15 家平台**：其 chat 私有协议（请求体 / 签名 / SSE 帧翻译）因平台而异，客观上必须写一次适配器才能接入——这是协议本质，不是程序缺陷。接入后即自动进入上述全自动链路，无需再人工盯更新。
- 判据纪律：`ok=false`（取不到清单）绝不回落成"明确空清单"，避免把上游抖动误判成"该平台没模型"进而清空目录。
