# 架构性优化可行性评估报告:P3-D / P3-E

> **评估范围**:miniapp-taro 本地 interface 下沉(P3-D)+ types/api-client 包按业务域拆分(P3-E)
> **评估方法**:基于实际代码扫描(Grep / Read / 文件统计),不写虚话
> **评估日期**:2026-07-28
> **评估结论**:**P3-D 部分执行(批次 1+2)**;**P3-E 不拆分,改用扩展 subpath exports 替代**

---

## 一、P3-D 评估:miniapp-taro 本地 interface 下沉到 packages/types

### 1.1 当前 miniapp-taro interface 分布(扫描结果)

**扫描命令**:`Grep "^(export\s+)?(interface|type)\s+\w+" apps/miniapp-taro/src`

**总量**:**210+ 个 `interface`/`type` 定义**,分布在 **100+ 文件**中。

按文件类别分布:

| 类别 | 文件数 | 定义数 | 代表性文件 |
| --- | --- | --- | --- |
| `api/index.ts` | 1 | 21 | Course/Live/Order/ChatMessage/VipInfo/News/Circle/Ask/Exam/AgentRawRow/AggregateMessages/NotificationPreferences/DeveloperPricing/DeveloperSubscription/RechargeCreateResult/DistributionInfo/QuestionType/ExamSubmitResult/ApiParams |
| `api/social.ts` | 1 | 3 | PaginationQuery(别名)/PaginatedList/FollowingItem |
| `api/plugin.ts` | 1 | (已部分共用) | plugin 相关 |
| `utils/*` | 15+ | ~25 | auth(UserInfo/LoginResult)/wechat-login(5)/streaming-recognizer(4)/api-client-transport(3)/push-init(2)/miniapp-login(2)/upload-image(2)/file-utils/keyboard-height/pay/privacy/push/voice-recorder/api-bridge |
| `platform/*` | 2 | 8 | auth.ts(5:MiniProgramPlatform/RuntimePlatform/MiniProgramLoginResult/MiniProgramUserProfile/AlipayAuthTaro)+ pay.ts(3:WechatPayParams/AlipayPayParams/PayResult) |
| `stores/*` | 3 | 3 | vip.ts(VipState)/user.ts(UserState)/invite.ts(InviteState) |
| `components/*` | 60+ | ~80 | 每个组件都有自己的 Props(纯 UI 层) |
| `pages/*` | 80+ | ~70 | 每个页面有本地辅助类型(TabKey/Category/SortType/PlanItem 等) |

**对比基线**:mobile-rn 端扫描结果 **214+ 个定义 / 100+ 文件**(已下沉 19 个共享契约)。两端体量相当,均显示"大量本地 interface 是端独占或页面内部辅助类型"的分布特征。

### 1.2 已下沉到 packages/types 的契约清单

miniapp-taro 当前有 **15 个文件** import `@ihui/types`,已接入的共享契约:

| 共享文件(packages/types/src/) | 下沉契约 | 引用文件(miniapp-taro) |
| --- | --- | --- |
| `ui-native-components.ts` | 14 对组件类型(CarouselItem/MenuItem/AgentRuntimeStatus/AgentRuntimePermissionEvent/AgentRuntimePanelProps/ModelConfigType/TitleSwitchOverlap* /TitleSwitchScrollPicker*/TitleSwitchScrollTitle*/TitleSwitchTypeBar*/UserInfo/UserInfoCardMinimalProps/VideoPlayerMinimalProps/AiModelData/AiModelUserType/AiModelCardMinimalProps/VoiceInputMinimalProps) | Carousel/Menu/AgentRuntimePanel/ModelConfigDialog/TitleSwitchOverlap/TitleSwitchScrollPicker/TitleSwitchScrollTitle/TitleSwitchTypeBar/UserInfoCard/AiModelCard/VideoPlayer(not used,VOICE)/VoiceInput |
| `pay.ts` | PayPlatform/WxPayParams/AliPayParams/AnyPayParams | utils/pay.ts |
| `share.ts` | ShareInfo/TimelineShareInfo | utils/share.ts |
| `coze.ts` | (Coze 全套,mobile-rn 主用) | api/plugin.ts(部分) |
| `plugin.ts` | Plugin 契约 | api/plugin.ts |
| `user.ts` `api.ts` `ai.ts` `notification.ts` 等 | User/AuthToken/ChatMessage/NotificationItem 等通用契约 | utils/auth.ts/utils/api-bridge.ts |

**已下沉总量**:约 30+ 个核心契约,覆盖 15 个 miniapp-taro 源文件。

### 1.3 候选下沉清单(按 ROI 排序)

#### ROI 高(强推荐)

| # | 候选契约 | 当前位置 | 下沉目标 | 复用场景 | 估算行数 |
| --- | --- | --- | --- | --- | --- |
| 1 | `PayResult` 类型 | `apps/miniapp-taro/src/platform/pay.ts:27` | `packages/types/src/pay.ts`(已存在,补齐) | mobile-rn 同样需要支付结果类型 | ~10 行 |
| 2 | `RecognizerConfig` / `RecognitionEventType` | `apps/miniapp-taro/src/utils/streaming-recognizer.ts:13,21` | `packages/types/src/voice.ts`(新建) | mobile-rn 的 doubao-voice-api 可复用配置类型 | ~15 行 |

#### ROI 中(可选,需先验证 mobile-rn 字段一致性)

| # | 候选契约 | 当前位置 | 下沉目标 | 复用场景 | 估算行数 |
| --- | --- | --- | --- | --- | --- |
| 3 | `VipInfo` / `DistributionInfo` / `News` / `Circle` / `Ask` / `Exam` / `ExamSubmitResult` / `DeveloperPricing` / `DeveloperSubscription` | `apps/miniapp-taro/src/api/index.ts:399,489,563,590,607,681,717,979,989` | `packages/types/src/miniapp-business.ts`(新建)或合并到 `legacy-migration.ts` | mobile-rn 端 api 层有同类业务实体映射 | ~80 行 |
| 4 | `RechargeCreateResult` / `AggregateMessages` / `NotificationPreferences` | `apps/miniapp-taro/src/api/index.ts:467,874,938` | 同上 | 后端响应类型,两端共用 | ~30 行 |
| 5 | `AgentRawRow` | `apps/miniapp-taro/src/api/index.ts:775` | `packages/types/src/agent.ts`(新建,与现有 agent-runtime 区分) | 后端 agents 表原始字段,各端映射用 | ~10 行 |

#### ROI 低(不建议下沉,保持现状)

| 类别 | 原因 |
| --- | --- |
| `components/*` 的 Props 类型(80+ 个) | 已通过 `ui-native-components.ts` 提取公共字段(Minimal Props 模式),各端 Props 字段差异大,保留本地定义是合理设计(参考 `packages/types/src/ui-native-components.ts` 顶部注释的字段映射说明) |
| `pages/*` 的本地辅助类型(70+ 个,如 TabKey/Category/SortType/PlanItem) | 仅本页用,无跨端复用价值 |
| `utils/api-client-transport.ts` 的 `TaroMethod`/`TaroRequestResult`/`TaroRequestTask` | Taro 平台独占类型,其他端用不到 |
| `utils/api-bridge.ts` 的 `_Query` | 内部类型,带下划线前缀表示私有 |
| `platform/auth.ts` 的 `MiniProgramPlatform`/`RuntimePlatform`/`MiniProgramLoginResult`/`MiniProgramUserProfile`/`AlipayAuthTaro` | 小程序平台独占,mobile-rn 用 expo-auth-session,web 用浏览器 API,desktop 用 Electron IPC,下沉会污染共享类型层 |
| `stores/*` 的 `VipState`/`UserState`/`InviteState` | stores 类型与端特定状态耦合(VipState 包含 miniapp 折扣/价格等特定字段),各端 stores 实现差异大 |
| `utils/wechat-login.ts` 的 `WechatLoginOptions`/`WechatLoginResult`/`WechatClient`/`LoginSuccessRes`/`UserProfileSuccessRes` | 微信小程序登录专属,mobile-rn 不用微信登录原生 SDK |

### 1.4 改造方案(分批策略)

#### 批次 1:补齐支付类型(高 ROI,~30 分钟)

**目标**:补齐 `packages/types/src/pay.ts` 增加 `PayResult` 类型,miniapp-taro `platform/pay.ts` 改为 re-export。

**改动文件**:
- `packages/types/src/pay.ts`:追加 `PayResult` 类型定义(~10 行)
- `apps/miniapp-taro/src/platform/pay.ts`:删除本地 `PayResult` 定义,改为 `export type { PayResult } from '@ihui/types'`

**验证**:
- `pnpm --filter @ihui/types typecheck`
- `pnpm --filter @ihui/miniapp-taro typecheck`

#### 批次 2:抽业务实体映射类型(中 ROI,~3-4 小时)

**前提条件**:先扫描 mobile-rn 的 api 层,验证两端业务实体字段映射是否一致。**如果字段映射不一致,本批次放弃**。

**目标**:把 miniapp-taro `api/index.ts` 中 9 个业务实体映射类型抽到 `packages/types/src/miniapp-business.ts`(或合并到 `legacy-migration.ts` 已有 28 组类型)。

**改动文件**:
- `packages/types/src/miniapp-business.ts`(新建):~80 行类型定义
- `packages/types/src/index.ts`:追加 `export * from './miniapp-business'`
- `apps/miniapp-taro/src/api/index.ts`:删除本地定义,改为 re-export

**验证**:
- `pnpm --filter @ihui/types typecheck`
- `pnpm --filter @ihui/miniapp-taro typecheck`
- 跨端验证:mobile-rn 是否可改为引用共享类型(可选,不在本批次范围)

#### 批次 3:抽语音识别配置类型(中 ROI,~1 小时)

**目标**:把 `streaming-recognizer.ts` 的 `RecognizerConfig`/`RecognitionEventType` 抽到 `packages/types/src/voice.ts`(新建)。

**改动文件**:
- `packages/types/src/voice.ts`(新建):~15 行
- `packages/types/src/index.ts`:追加 export
- `apps/miniapp-taro/src/utils/streaming-recognizer.ts`:删除本地定义,改为 import

**不做**:components/* Props、pages/* 本地类型、platform/auth.ts 小程序独占类型、stores/* State 类型、utils/wechat-login.ts 微信专属类型 — 全部保持现状。

### 1.5 ROI 评估

| 维度 | 评估 |
| --- | --- |
| **改造成本** | 批次 1(30 分钟)+ 批次 2(3-4 小时,前提是 mobile-rn 字段一致)+ 批次 3(1 小时)= **总计 ~5 小时** |
| **维护收益** | 批次 1 收益小(1 个类型,mobile-rn 未来可用);批次 2 收益中(9 个业务类型,但需 mobile-rn 跟进改造才有真收益);批次 3 收益中(2 个类型,mobile-rn doubao-voice-api 可复用) |
| **整体 ROI** | **中低**。miniapp-taro 本地 210+ interface 中,真正高复用价值的已下沉(pay/share/ui-native-components/coze/plugin),剩余 80% 是端独占或页面内部辅助类型,下沉收益有限 |
| **对比基线** | mobile-rn 端 214+ 本地 interface 中已下沉 19 个共享契约(占 ~9%),剩余 80+ 本地 interface ROI 较低 — miniapp-taro 情况完全一致,本批次预计再下沉 ~12 个契约,达到与 mobile-rn 相近的共用率(~10%) |

### 1.6 风险点

1. **业务实体字段映射差异** ⚠️ 高风险
   - miniapp-taro 的 `Course`/`Live`/`Order` 是基于 api-client `Course`/`Live`/`Order` 做字段映射的 `Pick<>&{}`(参考 `apps/miniapp-taro/src/api/index.ts:130,156,181` 的注释)
   - mobile-rn 是否用同样映射未知,贸然下沉可能导致两端字段不一致
   - **缓解**:批次 2 执行前必须先扫描 mobile-rn 的同类映射,验证字段一致性

2. **stores 类型与端特定状态耦合** ⚠️ 中风险
   - `VipState` 包含 VIP 折扣/价格等 miniapp-taro 特定字段,mobile-rn 的 VIP 状态结构可能完全不同
   - **缓解**:不下沉 stores 类型(已纳入"不做"清单)

3. **平台独占类型误下沉** ⚠️ 中风险
   - `TaroMethod`/`TaroRequestResult` 是 Taro 平台独占,下沉会污染共享类型层
   - **缓解**:`utils/api-client-transport.ts` 的类型保持本地(已纳入"不做"清单)

4. **维护成本反而上升** ⚠️ 低风险
   - 下沉后改一个类型要跨包 PR,如果两端字段不一致还要写映射层,可能比本地定义更复杂
   - **缓解**:只下沉已验证两端一致或未来 mobile-rn 明确要用的类型

---

## 二、P3-E 评估:types/api-client 包按业务域拆分

### 2.1 当前 packages/types 包结构

**扫描命令**:`Get-ChildItem packages/types/src -File | Sort Length -Descending`

**总量**:**38 个文件,~290 KB / ~9300 行**(纯类型,无运行时代码)。

**Top 10 文件(按大小)**:

| 文件 | 大小 | 行数 | 业务域 |
| --- | --- | --- | --- |
| `agent-runtime.ts` | 42.3 KB | 1378 | Agent 运行时 |
| `legacy-migration.ts` | 31.3 KB | 993 | 旧架构迁移补齐(28 组类型) |
| `v1-endpoints.ts` | 23.0 KB | 875 | /v1/* 对外开放 API 端点 |
| `admin-types.ts` | 13.2 KB | 478 | Admin 后台业务类型 |
| `terminal.ts` | 9.8 KB | 321 | 终端集成 |
| `app.ts` | 9.8 KB | 293 | 跨端 app 组件类型 |
| `ui-native-components.ts` | 9.7 KB | 264 | 跨端同名组件共享 props |
| `registry.ts` | 9.0 KB | 303 | 资源上游同步中心 |
| `api-key.ts` | 7.3 KB | 213 | 开发者 API Key |
| `orchestration.ts` | 6.7 KB | 251 | 跨支柱编排中枢 |

**已有 subpath exports**(packages/types/package.json):
- `.` / `./user` / `./api` / `./ai` / `./message-repair` / `./workspace` / `./api-contracts` / `./orchestration`(共 8 个入口)

### 2.2 当前 packages/api-client 包结构

**总量**:**60+ 个 endpoints 文件 + 6 个核心文件,~600 KB / ~18000 行**。

**Top 10 文件(按大小)**:

| 文件 | 大小 | 行数 | 业务域 |
| --- | --- | --- | --- |
| `client.ts` | 53.8 KB | 1370 | 核心 HTTP 客户端 |
| `endpoints/admin-content.ts` | 24.7 KB | 630 | Admin 内容管理 |
| `endpoints/admin-system.ts` | 22.4 KB | 733 | Admin 系统管理 |
| `endpoints/agent-runtime.ts` | 19.6 KB | 648 | Agent 运行时 |
| `endpoints/workspace.ts` | 18.1 KB | 551 | 工作区 |
| `endpoints/payment.ts` | 16.4 KB | 515 | 支付 |
| `endpoints/admin-business.ts` | 15.8 KB | 452 | Admin 业务管理 |
| `endpoints/business.ts` | 14.4 KB | 466 | 业务 |
| `endpoints/ai.ts` | 14.2 KB | 453 | AI |
| `endpoints/admin-auth.ts` | 12.7 KB | 402 | Admin 认证 |

**已有 subpath exports**(packages/api-client/package.json):
- `.` / `./client` / `./api-error` / `./utils` / `./endpoints/*`(共 4 个固定入口 + 通配符 endpoints/*)

**域分布**:`endpoints/` 目录已按业务域组织(admin-*(8 个)/agent*(2 个)/ai*(3 个)/auth/chat/coze/edu/exam/files/learn/live/llm/member/notification/order/payment/plugin 等)。

### 2.3 跨端引用分布

**@ihui/types 引用统计**(Grep `from ['"]@ihui/types['"]`):
- **总量**:**115 处 import,分布在 100 个文件**
- **按端分布**:web(60+ 文件,主要在 src/components/ide、src/stores、src/hooks、src/lib)/ api(20+ 文件,主要在 src/services、src/routes)/ mobile-rn(15+ 文件,主要在 src/screens、src/components)/ miniapp-taro(15 文件,见 1.2 节)/ cli(15+ 文件,主要在 src/commands、src/tools、src/skills)/ extension(5+ 文件)/ ai-service(0,Python 端)/ desktop(0)

**@ihui/api-client 引用统计**(Grep `from ['"]@ihui/api-client['"]`):
- **总量**:**113 处 import,分布在 100 个文件**
- **按端分布**:web(50+ 文件)/ extension(30+ 文件,sidepanel 大量页面)/ mobile-rn(20+ 文件)/ miniapp-taro(10+ 文件)/ cli(5+ 文件)/ desktop(0)/ ai-service(0,Python)

### 2.4 候选拆分粒度

按业务域可拆分为 9 个子包(估算):

| 子包名 | 包含文件 | 大小 | 主要消费者 |
| --- | --- | --- | --- |
| `@ihui/types-auth` | user.ts / api.ts / api-key.ts / cli-config.ts | ~30 KB | 所有端 |
| `@ihui/types-chat` | ai.ts / message-repair.ts / message-bus.ts / context-mention.ts | ~15 KB | web / mobile-rn / miniapp-taro / cli |
| `@ihui/types-billing` | pay.ts / token.ts / share.ts | ~10 KB | web / mobile-rn / miniapp-taro |
| `@ihui/types-agent` | agent-runtime.ts / agent-control.ts / work-panel.ts / terminal.ts / hooks.ts / rules.ts / spec.ts | ~80 KB(最大) | web / cli / extension |
| `@ihui/types-workspace` | workspace.ts / ide-workspace.ts / memory.ts / webhook.ts / webhook-trigger.ts / orchestration.ts | ~25 KB | web / cli / api |
| `@ihui/types-notification` | notification.ts / notification-channels.ts | ~6 KB | web / api / extension |
| `@ihui/types-content` | admin-types.ts / legacy-migration.ts / registry.ts / leaderboard.ts / education.ts / coze.ts / plugin.ts | ~75 KB | web / api |
| `@ihui/types-platform` | ui-native-components.ts / app.ts | ~20 KB | mobile-rn / miniapp-taro |
| `@ihui/types-v1` | v1-endpoints.ts / api-contracts.ts | ~26 KB | api / cli |

### 2.5 拆分方案

**伞包模式**(推荐,若真要拆):
- `@ihui/types` 保留为伞包,`src/index.ts` 继续 `export * from './xxx'`
- 各子包独立 `package.json` + `tsconfig.json` + `src/index.ts`
- 跨端 import 路径:**保持向后兼容**,各端可继续 `from '@ihui/types'`,也可改为精确 `from '@ihui/types-agent'`

**依赖关系**(单向,避免循环):

```
@ihui/types-auth (无依赖,基础)
       ↑
@ihui/types-billing (依赖 auth 的 User)
       ↑
@ihui/types-chat (依赖 auth 的 User / billing 的 token)
       
@ihui/types-agent (依赖 auth 的 PermissionMode)
       ↑
@ihui/types-workspace (依赖 agent 的 PlanState)

@ihui/types-notification (无依赖)
@ihui/types-content (依赖 auth 的 admin)
@ihui/types-platform (无依赖)
@ihui/types-v1 (依赖 auth)
```

**已知命名冲突**:`agent-runtime.ts` 与 `workspace.ts` 都导出 `PermissionMode` / `PermissionDecision`(参考 `packages/types/src/index.ts:22-26` 的注释),拆分后冲突更易暴露,需显式 `export type` 处理。

### 2.6 ROI 评估

#### 拆分成本(高)

| 项 | 估算 |
| --- | --- |
| 新建 9 个子包 | 9 × 3 文件(package.json + tsconfig.json + src/index.ts)= 27 文件,~1 天 |
| 跨端 import 评估 | 215 处 import(115 types + 113 api-client)需评估是否替换,~2 天(评估为主,实际替换可选) |
| workspace 配置 | pnpm-workspace.yaml + 根 package.json + turbo.json 更新,~2 小时 |
| CI/构建链路 | 每个子包都要 build/typecheck/lint,增加 ~9 倍构建任务,~1 天调试 |
| 命名冲突处理 | PermissionMode 等已有冲突案例需显式处理,~4 小时 |
| 文档同步 | PACKAGES.md / architecture.md / README.md 同步,~4 小时 |
| **总计** | **5-7 天** |

#### 维护收益(低)

| 维度 | 评估 |
| --- | --- |
| **当前包大小** | types 290KB / api-client 600KB — 在合理范围(对比业内 monorepo 单包可达 1MB+) |
| **已有 subpath exports** | types 8 个入口 / api-client 4 个固定 + endpoints/* 通配符,各端可精确导入 |
| **类型构建速度** | tsc --noEmit 对纯类型包很快(types 包 < 3s),拆分后多包并行反而增加 turbo 调度开销 |
| **end users 已用 subpath** | 各端可 `import from '@ihui/types/workspace'` 精确导入,无需拆包即可实现 tree-shaking |
| **private 包无 npm 压力** | packages 是 private,不像公开 npm 包需要按域拆分降低用户 bundle size |
| **endpoints/ 已按域组织** | api-client 的 endpoints/ 目录本身就是按业务域组织,无需再拆包 |

#### 拆分 vs 替代方案对比

| 方案 | 成本 | 收益 | 推荐度 |
| --- | --- | --- | --- |
| **方案 A(拆分 9 包)** | 5-7 天 | 边际(伞包模式下旧 import 仍可用,实际收益取决于各端是否主动迁移) | ❌ 不推荐 |
| **方案 B(扩展 subpath exports)** | 2-3 小时 | 80%(补齐 30+ 个 subpath,各端按需精确导入) | ✅ 推荐 |
| **方案 C(保持现状)** | 0 | 当前 subpath 已覆盖高频复用类型 | ⚠️ 可接受 |

### 2.7 风险点

1. **跨包循环依赖** ⚠️ 高风险
   - `agent-runtime.ts` 引用 `workspace.ts` 的 `PermissionMode`,`workspace.ts` 引用 `agent-runtime.ts` 的 `PlanState`
   - 拆分后需要明确单向依赖或合并
   - **缓解**:按 2.5 节的依赖关系图,workspace 依赖 agent(单向),不反向

2. **类型重新导出导致命名冲突** ⚠️ 中风险
   - 已有 `PermissionMode` 冲突案例(参考 `packages/types/src/index.ts:22-26`)
   - 拆分后冲突概率上升
   - **缓解**:显式 `export type` 处理,伞包模式下保持现有冲突解决机制

3. **构建链路复杂化** ⚠️ 中风险
   - 9 个新包加入 turbo pipeline,增量构建图变复杂
   - 可能影响 CI 时间(虽然单包 typecheck 快,但 turbo 调度开销不可忽略)
   - **缓解**:若拆分,需要重新调优 turbo cache 策略

4. **跨端 import 不一定跟着改** ⚠️ 低风险
   - 各端从 `'@ihui/types'` 顶层导入,即使拆分后旧 import 仍可用(伞包模式)
   - 拆分实际收益取决于各端是否主动迁移到子包导入
   - **缓解**:不强制迁移,新代码鼓励用子包导入

5. **private 包无 npm 发布压力** ℹ️ 信息
   - packages 是 private,不像公开 npm 包需要按域拆分降低用户 bundle size
   - 拆分的主要动机(独立版本化 / 独立发布 / 用户按需安装)在 private monorepo 中不成立

6. **endpoints/* 已经按域组织** ℹ️ 信息
   - api-client 的 `endpoints/` 目录本身就是按业务域组织
   - 通过 `@ihui/api-client/endpoints/auth` 可精确导入,无需再拆包

### 2.8 建议

**不值得拆分**。理由汇总:

1. **包大小在合理范围**:types 290KB / api-client 600KB,远低于业内 monorepo 单包 1MB+ 的常见阈值
2. **已有 subpath exports 机制可解决 tree-shaking**:types 8 个入口 + api-client 4 个固定 + endpoints/* 通配符,各端可精确导入
3. **拆分成本(5-7 天)远超收益(边际)**:伞包模式下旧 import 仍可用,实际收益取决于各端是否主动迁移
4. **private 包无 npm 发布压力**:拆分的主要动机(独立版本化 / 独立发布 / 用户按需安装)在 private monorepo 中不成立
5. **endpoints/ 已按域组织**:api-client 的目录结构本身就是按业务域组织,无需再拆包
6. **替代方案(扩展 subpath exports)成本仅 2-3 小时,即可获得 80% 收益**

#### 何时拆分(触发条件,任一满足即可考虑)

- types 包增长到 **1 MB+** 或 **100+ 文件**(当前 290KB / 38 文件,远未达到)
- 公开发布到 npm(需要按域收费 / 版本化)
- 某业务域类型独立演进(如 billing 类型被多个外部包引用,需要独立版本)
- 某业务域类型引入重量级运行时依赖(如 agent 域需要 zod runtime,其他域保持纯类型)

#### 拆分顺序(若未来真要拆)

1. **先拆 `@ihui/types-agent`**(最大,80KB,agent-runtime + agent-control + work-panel + terminal + hooks + rules + spec)— 主要消费者 web / cli / extension,拆分后这三端可减少无关类型加载
2. **再拆 `@ihui/types-content`**(admin-types + legacy-migration + registry + leaderboard + education + coze + plugin,75KB)— 主要消费者 web / api,拆分后 mobile-rn / miniapp-taro 可不再间接引入 admin 类型
3. **再拆 `@ihui/types-v1`**(v1-endpoints + api-contracts,26KB)— 主要消费者 api / cli
4. **其他子包**(auth / chat / billing / workspace / notification / platform)视情况,收益较小

---

## 三、优先级建议(可执行路径)

### 3.1 执行顺序

| 优先级 | 任务 | 估算 | 前置条件 | 收益 |
| --- | --- | --- | --- | --- |
| **P1** | **P3-D 批次 1**:补齐 `packages/types/src/pay.ts` 增加 `PayResult`,miniapp-taro `platform/pay.ts` re-export | 30 分钟 | 无 | 高(mobile-rn 未来可复用) |
| **P2** | **P3-E 替代方案**:扩展 `packages/types/package.json` 的 subpath exports,补齐 30+ 个子路径 | 2-3 小时 | 无 | 高(各端按需精确导入,纯 package.json 改动) |
| **P3** | **P3-D 批次 3**:抽 `streaming-recognizer.ts` 的 `RecognizerConfig` / `RecognitionEventType` 到 `packages/types/src/voice.ts` | 1 小时 | 无 | 中(mobile-rn doubao-voice-api 可复用) |
| **P4** | **P3-D 批次 2**:抽 miniapp-taro `api/index.ts` 9 个业务实体映射类型到 `packages/types/src/miniapp-business.ts` | 3-4 小时 | **必须先验证 mobile-rn 字段映射一致性** | 中(需 mobile-rn 跟进改造才有真收益) |
| **不做** | **P3-E 拆分 9 包** | 5-7 天 | 无 | 边际(伞包模式下旧 import 仍可用) |

### 3.2 整体 ROI 总结

- **P3-D 部分执行**(批次 1+2+3,共 ~5 小时,~125 行改动):**中等收益**
  - 批次 1 高 ROI(立即做)
  - 批次 3 中 ROI(立即做)
  - 批次 2 中 ROI(需先验证 mobile-rn 字段一致性,可推迟)
- **P3-E 不拆分,改用扩展 subpath exports 替代**(2-3 小时,纯 package.json 改动):**高收益**(成本低,80% 收益)
- **整体不做的部分**:components/* Props、pages/* 本地类型、platform/auth.ts 小程序独占类型、stores/* State 类型、utils/wechat-login.ts 微信专属类型、utils/api-client-transport.ts Taro 平台类型 — 全部保持现状,下沉 ROI 低

### 3.3 关键决策依据

1. **mobile-rn 基线对照**:mobile-rn 端 214+ 本地 interface 中已下沉 19 个共享契约(占 ~9%),剩余 80+ 本地 interface ROI 较低 — **miniapp-taro 情况完全一致**,本评估建议再下沉 ~12 个契约,达到与 mobile-rn 相近的共用率(~10%),剩余 80% 本地类型保持现状是合理设计
2. **已有 subpath exports 机制**:types 包 8 个入口 + api-client 4 个固定 + endpoints/* 通配符,已能解决 80% 的 tree-shaking 需求,拆分收益边际
3. **private monorepo 特性**:无 npm 发布压力,拆分的主要动机不成立
4. **endpoints/ 目录已按域组织**:api-client 的目录结构本身就是按业务域组织,无需再拆包

---

## 四、附录:扫描数据来源

### 4.1 扫描命令清单

```bash
# miniapp-taro interface 分布
Grep "^(export\s+)?(interface|type)\s+\w+" apps/miniapp-taro/src
# 结果:210+ 定义,100+ 文件

# mobile-rn interface 分布(对比基线)
Grep "^(export\s+)?(interface|type)\s+\w+" apps/mobile-rn/src
# 结果:214+ 定义,100+ 文件

# packages/types 文件大小
Get-ChildItem packages/types/src -File | Sort Length -Descending
# 结果:38 文件,~290KB / ~9300 行

# packages/api-client 文件大小
Get-ChildItem packages/api-client/src -File -Recurse | Sort Length -Descending | Select -First 30
# 结果:60+ endpoints + 6 核心,~600KB / ~18000 行

# @ihui/types 跨端引用
Grep "from ['\"]@ihui/types['\"]" apps
# 结果:115 处 import,100 文件,8 端分布

# @ihui/api-client 跨端引用
Grep "from ['\"]@ihui/api-client['\"]" apps
# 结果:113 处 import,100 文件,7 端分布
```

### 4.2 关键文件引用

| 引用位置 | 用途 |
| --- | --- |
| `packages/types/src/index.ts` | 38 个文件的 re-export 入口,已有 7 个 subpath exports |
| `packages/types/src/pay.ts:1-43` | 已下沉的 PayPlatform/WxPayParams/AliPayParams/AnyPayParams(无 PayResult) |
| `packages/types/src/ui-native-components.ts:1-285` | 14 对跨端组件类型,字段映射说明详尽 |
| `packages/types/src/legacy-migration.ts:1-993` | 28 组旧架构迁移补齐类型 |
| `packages/types/package.json:8-41` | 已有 subpath exports 配置(8 个入口) |
| `packages/api-client/src/index.ts:1-168` | 60+ endpoints re-export 入口 |
| `packages/api-client/package.json:9-30` | 已有 subpath exports 配置(4 固定 + endpoints/* 通配符) |
| `apps/miniapp-taro/src/api/index.ts:130,156,181,202,399,467,489,563,590,607,681,703,717,775,874,938,979,989` | 18 个候选下沉类型位置 |
| `apps/miniapp-taro/src/platform/pay.ts:27` | `PayResult` 类型(候选批次 1) |
| `apps/miniapp-taro/src/utils/streaming-recognizer.ts:13,21` | `RecognizerConfig` / `RecognitionEventType`(候选批次 3) |

---

**报告完成日期**:2026-07-28
**评估人**:AI Agent(基于实际代码扫描)
**下一步行动**:按 3.1 节优先级表执行 P1-P4 任务
