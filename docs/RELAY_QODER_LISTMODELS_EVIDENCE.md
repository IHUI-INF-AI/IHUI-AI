# Qoder listModels 端点取证定案(2026-10-27)

> 台账遗留「qoder 上游 listModels 端点无一手证据,维持待取证,不盲做」
> (PROJECT_PLAN 2026-10-27 第八刀批次登记)于本日实弹收口:
> **Qoder 上游不存在可直连的模型列表端点。** 本文明一小时窗口内
> 三组基址共 24 条候选路径的一手实弹证据与方法论对照。

## 1. 取证环境与方法

- 真号:本机 Qoder CN 客户端(com.qodercn.app.stable)登录态,
  auth.v1.dat 经 Local State DPAPI + AES-256-GCM 解出会话
  (与 scripts/qoder-capture.ps1 同源通道;token 只在内存管道,零落盘零回显)。
- **方法论对照**:每轮试探以已知存在端点做活性对照——
  `GET https://openapi.qoder.com.cn/api/v2/quota/usage`(号池 2026-10-23 已实证)
  本日真跑 **200**,响应含 userId/userType/usageType/totalUsagePercentage
  ⇒ 证明:token 有效(dt- 票,过期 2026-11-25)、基址可达、请求头族正确、
  404 判定是上游真实路由结论而非鉴权掩护。
- 请求头:`authorization: Bearer` + `Cosy-ClientType: 10` +
  `Cosy-MachineOS: x86_64_windows`(quota 同款;补满 runtime-info.exe 产出的
  Cosy-MachineToken/Code/Type 三件套复测一轮,结果不变)。

## 2. 实弹结果

| 基址 | 结果 |
|---|---|
| `https://openapi.qoder.com.cn`(CN 主) | 24 条候选全 **404**(含 `/api/v1|v2/models`、`models/list`、`model/list`、`quota/models`、`config/models`、`modelConfigs`、`availableModels`、`smart_cards`、`model/preferences`、`llm/models`、`aigateway/models` 等;含 `/algo/api` 前缀族) |
| `https://openapi.qoder.sh`(国际) | 全部路径(含故意不存在的 `__definitely_nope__`)**一律 401** ⇒ catch-all 认证中间件,**无路由区分度**,不构成任何存在证据 |
| `https://gateway.qoder.com.cn`(chat 网关) | `/algo/api/v2/service/models`、`/algo/api/v2/models` 等 **404**(Spring 标准 404 体,路径回显) |

结论:**openapi 与 chat 网关两侧均无 models 列表路由。**

## 3. 客户端侧旁证

- app.asar(0.4.11)内 `listModels` 仅见 stub 形态:
  `listModels:async()=>[]`、`listModels:()=>Promise.reject(new Error(...))`、
  `listModels:()=>Promise.reject(...)` —— 客户端自身模型清单走
  **内置静态清单/byokModels/本地偏好**(`getModelPreferences`/`saveModelPreferences`),非上游点查。
- asar 字符串全量混淆(字符串表+索引函数),已知名(`quota/usage`、
  `deviceToken/refresh`)静态检索同样不可见 ⇒ 静态混淆不是本结论的漏洞来源,
  404 实弹已独立封死路由面。
- 本机日志(`logs/latest/qodercli.log`)、HTTP 缓存、Local Storage 亦无
  models 请求路径痕迹;Local Storage 确认业务主 host 即 openapi.qoder.com.cn。

## 4. 定案与能力面对照

1. **qoder listModels 台账遗留就此关闭**:端点不存在,不是"待取证"而是"取证完毕,不存在"。
2. 号池 qoder 账号的"可用模型"能力面不再追上游点查;如需在管理页展示,
   唯一客户端同源事实是 CLI 桥(scripts/qoder-chat-bridge.mjs /
   qoder-cli-bridge.ts)侧的运行时清单,后续如需可经桥取——不在本次范围。
3. 与"绝不冒充可用"总口径一致:不伪造静态清单冒充上游点查结果。
