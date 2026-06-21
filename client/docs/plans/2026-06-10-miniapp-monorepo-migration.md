# 智汇 AI 多端融合迁移计划（方案 B）

> 状态：阶段 0/1 已完成，阶段 2 P0/P1/P2 已全部落地；阶段 3 页面迁移已启动
> 目标：官网（Vue3 + Vite）与微信小程序（UniApp Vue2）合并为**单一仓库、渐进式代码统一**

---

## 1. 目标与原则

### 1.1 最终形态

```
officialsite/                    # 唯一 Git 仓库
├── src/                         # 官网 Web（Vue 3 + Vite + Element Plus）
├── miniapp/                     # 微信小程序（UniApp Vue2，独立 node_modules）
├── packages/
│   ├── shared-api/              # ✅ API 基址、端点、白名单（已完成）
│   ├── shared-auth/             # ✅ 登录态 key、Token 工具、平台归一化
│   ├── shared-types/            # ✅ 业务 DTO / 枚举（登录、智能体、订单等）
│   └── shared-services/         # ✅ 无 UI 业务服务（刷新 Token、智能体、VIP、支付基础请求）
├── backend/                     # Python FastAPI 辅助服务
└── package.json                 # 根脚本统一 dev/build
```

### 1.2 原则

| 原则 | 说明 |
|------|------|
| 渐进迁移 | 不做大爆炸重写；每阶段可独立上线 |
| 共享下沉 | 先共享「无 UI」层（API、类型、工具），UI 最后统一 |
| 双构建链并存 | 官网 Vite、小程序 UniApp 长期并存，直至 Vue3 UniApp 升级完成 |
| Vue 隔离 | miniapp **不进入** npm workspaces，避免 Vue2/Vue3 依赖冲突 |

---

## 2. 现状快照（迁移前）

| 维度 | 官网 | 小程序 |
|------|------|--------|
| Vue | 3.5 + Pinia | 2.6 + Vuex |
| 构建 | Vite 7 | vue-cli + @dcloudio/uni |
| 路由 | Vue Router | pages.json + 分包 |
| 源文件规模 | 大型 SPA | ~551 个 .vue/.js |
| API 配置 | api-config.ts | apiConfig.js |

**已完成**：`packages/shared-api` 作为两端 API 配置单一数据源；`miniapp/` 已迁入仓库根目录。

---

## 3. 分阶段路线图

### 阶段 0：Monorepo 骨架 ✅

- [x] 将 `Ai-WXMiniVue` 迁入 `officialsite/miniapp/`
- [x] 创建 `packages/shared-api`
- [x] 根目录统一脚本：`dev:mp-weixin`、`build:mp-weixin`、`build:shared`
- [x] 官网 `api-config.ts`、小程序 `apiConfig.js` 改为 re-export
- [x] CI 增加 `build:shared` 步骤

**验收**：`npm run build:shared && npm run typecheck` 通过；`cd miniapp && npm install && npm run build:mp-weixin` 可产出 `dist/build/mp-weixin/`。

> **环境说明**：UniApp Vue2 构建链在 **Node 24** 下可能触发 `split-chunks` 的 `normalizePath` 错误（原独立仓库同样存在）。请使用 **Node 20 LTS** 执行 `miniapp` 相关命令（与官网 `engines` 一致）。

---

### 阶段 1：共享层扩展 ✅

#### 1.1 packages/shared-types

从两端抽取重复接口类型：

- 用户 / 登录响应
- 智能体列表项、分类
- 订单、VIP、分销
- 统一分页 `PageResult<T>`

官网：`import type { AgentItem } from '@aizhs/shared-types'`  
小程序：通过构建产物 `.d.ts` + JSDoc 过渡（Vue2 无 TS 时可用 JSDoc `@typedef`）

**已落地**：`packages/shared-types` 已创建并覆盖 API 响应、登录 token、用户、智能体、订单、分页等基础类型。

#### 1.2 packages/shared-auth

- Token 存储 key 常量
- `isTokenExpiredError` / 刷新 Token 流程（已从 shared-api 导出错误码）
- 白名单 URL 判断（已部分完成）

**已落地**：`packages/shared-auth` 已创建，提供 storage key、access/refresh token 提取、token 过期判断、平台类型归一化；小程序 `utils/auth.js`、`utils/request/requestHandler.js` 与 `utils/service/index.js` 已接入。

#### 1.3 统一环境配置

新建 `packages/shared-env` 或扩展 shared-api：

```ts
export const ENV = {
  API_BASE_URLS, // 已有
  WECHAT_APP_ID: '...',
  MINI_PROGRAM_GH_ID: 'gh_7e8ca1f80135',
}
```

小程序 `WECHAT_MINI_PROGRAM_ID` 迁入此处。

**已落地**：`WECHAT_MINI_PROGRAM_ID` 已迁入 `packages/shared-api`，小程序页面通过 `miniapp/src/config/apiConfig.js` 统一 re-export。

#### 1.4 文档与脚本

- 根 `README.md` 增加「多端开发指南」
- `npm run dev:all`（可选）：并行启动官网 + 小程序 watch

**已落地**：根 `README.md`、`miniapp/README.md`、`miniapp/docs/WEB_MINIAPP_FEATURE_DIFF.md` 已更新；`dev:mp-weixin`、`build:mp-weixin`、`build:shared`、`miniapp:install` 已加入根脚本。

**验收**：修改一处 API 基址，两端构建后行为一致；类型检查无回归。

---

### 阶段 2：业务服务层对齐（P0/P1/P2 已全部落地）

按模块逐个抽取 `packages/shared-services`（纯逻辑，无 DOM / 无 uni）：

| 优先级 | 模块 | 官网位置 | 小程序位置 |
|--------|------|----------|------------|
| P0 | 登录 / 刷新 Token | `src/api/auth*` | `miniapp/src/service/login.js` |
| P0 | 智能体列表/详情 | `src/api/zhs-agent.ts` | `miniapp/src/service/*.js` |
| P1 | 用户中心 / VIP | stores + api | pages/table/user |
| P1 | 支付 / 充值 | payment services | `utils/pay/` |
| P2 | 课程 / 广场 | xuqiu, plaza api | pagesA/plaza |
| P2 | AI 对话 WebSocket | composables | mixins/ai |

每个模块迁移步骤：

1. 对比两端请求参数与响应结构
2. 提取纯函数 + axios/uni.request 适配器接口
3. 官网 adapter：`axios`  
4. 小程序 adapter：`uni.request` 封装
5. 单模块 E2E 回归

**验收**：至少 P0 模块两端共用同一 service 文件；接口 mock 测试通过。

**已落地**：

- `packages/shared-services` 已创建，提供 `refreshAuthToken`、`getAgentList`、`getAgentDetailByCategory` 与请求适配器接口。
- 官网 `src/api/user.ts` 的 refreshToken 自动登录链路已接入 `refreshAuthToken`。
- 小程序两套请求封装 `miniapp/src/utils/request/requestHandler.js` 与 `miniapp/src/utils/service/index.js` 已接入同一个 `refreshAuthToken`。
- 小程序 `miniapp/src/service/aiModels.js` 的 `getAgentType`、`getChargeInfoById` 已通过 `shared-services` 调用，保持原页面返回形状。
- `packages/shared-services` 已新增 `vip-service.ts`、`payment-service.ts`，覆盖 VIP 价格/购买/用户 VIP 信息、微信支付拉起、Token 扣减/返还、订单状态更新/关闭、连续支付产品等基础接口。
- 官网 `src/api/vip.ts`、`src/api/payment.ts` 已接入共享 VIP/支付服务，并保留原页面兼容返回形状。
- 小程序 `miniapp/src/service/vip.js`、`miniapp/src/service/pay.js` 已接入共享 VIP/支付服务，并继续输出原有函数名。
- 已新增 shared-services mock 测试：`packages/shared-services/src/__tests__/auth-service.test.ts`、`packages/shared-services/src/__tests__/agent-service.test.ts`、`packages/shared-services/src/__tests__/vip-service.test.ts`、`packages/shared-services/src/__tests__/payment-service.test.ts`。

#### 1.5 Phase 2 P2 落地（2026-06-11）

新增共享服务模块：

- `packages/shared-services/src/course-service.ts`：课程 CRUD、视频管理、视频日志操作、上架/下架等。
- `packages/shared-services/src/content-service.ts`：课程星球、知识星球、资讯字典/列表、首页资源。
- `packages/shared-services/src/plaza-service.ts`：广场任务列表、发布、详情。
- `packages/shared-services/src/ai-model-service.ts`：AI 模型对话 CRUD、Agent 上下文查询、AIGC 列表、分享状态、群组列表。
- `packages/shared-services/src/distribution-service.ts`：操盘手统计、团队、下家列表、佣金详情、分销流水、提现审批。

新增类型定义：

- `packages/shared-types/src/course.ts`：CourseItem、CourseVideoItem、CourseListParams、VideoComment、HomePageResource。
- `packages/shared-types/src/content.ts`：KnowledgePlanetItem、InformationItem、InformationListParams。
- `packages/shared-types/src/plaza.ts`：PlazaTaskItem、PlazaTaskListParams、PlazaDemand。
- `packages/shared-types/src/distribution.ts`：TraderStats、SubordinateItem、CommissionDetail、FlowItem、WithdrawalRequest/Status、AgentGroupItem。

新增 API 端点：

- `packages/shared-api/src/endpoints.ts`：新增 COURSE、INFORMATION、PLAZA、DISTRIBUTION、AI_CHAT、N8N、FEEDBACK、GROUP、RESOURCE（扩展）端点组。

小程序服务接入：

- `miniapp/src/service/coursePlanet.js` → 使用 `sharedGetCoursePlanet`
- `miniapp/src/service/knowledgePlanet.js` → 使用 `sharedGetKnowledgePlanetInfo`、`getInformationDictionary`、`sharedGetInformationList`
- `miniapp/src/service/aigc.js` → 使用 `sharedGetAigcList`
- `miniapp/src/service/rankings.js` → 使用 `sharedGetGroupList`
- `miniapp/src/service/getSubordinates.js` → 使用 `sharedGetSubordinates`、`sharedGetUserAndChildrenOrders`
- `miniapp/src/service/tixian.js` → 使用 `sharedSubmitWithdrawal`、`sharedGetWithdrawalStatus`
- `miniapp/src/service/index.js` → 使用 `sharedGetPopularCourses`、`sharedGetPlantInformation`、`sharedGetHomePageResources`

新增测试：

- `packages/shared-services/src/__tests__/course-service.test.ts`
- `packages/shared-services/src/__tests__/content-service.test.ts`
- `packages/shared-services/src/__tests__/plaza-service.test.ts`
- `packages/shared-services/src/__tests__/ai-model-service.test.ts`
- `packages/shared-services/src/__tests__/distribution-service.test.ts`

验证：`npm run build:shared` 和 `npm run typecheck` 均通过；`shared-services.bundle.js` 已重新生成（28.8kb）。

#### 1.6 Phase 3 页面迁移（2026-06-11 启动）

小程序页面组件向 Vue3 Web 端迁移，补齐缺失页面：

新增页面：

- `src/views/MessageCenter.vue`：消息中心，展示系统通知/站内信列表，支持搜索、已读标记。路由 `/messages`。
- `src/views/NewsDetail.vue`：新闻资讯详情页，展示文章内容、元信息、相关推荐。路由 `/news/:id`。
- `src/views/StudyVideoDetail.vue`：课程视频详情页，支持视频播放、目录/介绍/评论 Tab 切换。路由 `/study/video/:id`。

路由变更：

- `src/router/modules/community.ts`：新增 `/messages`、`/news/:id`、`/study/video/:id` 路由。

已有页面覆盖情况（小程序 → Web）：

| 小程序页面 | Web 页面 | 路由 |
|-----------|----------|------|
| pages/login-app/login | Login.vue | /login |
| pages/table/aiIndex/ai_index | AICommunity.vue | /ai-community |
| pages/table/tools/index | Agents.vue | /agents |
| pages/table/user/index | User.vue | /user |
| pagesA/vip_info/index | Vip.vue | /vip |
| pagesA/distribution/index | Distribution.vue | /distribution |
| pagesA/plaza/index | Plaza.vue / Xuqiu.vue | /plaza / /xuqiu |
| pagesA/top-up/index | TopUp.vue | /top-up |
| pagesA/withdrawal/index | Withdrawal.vue | /withdraw |
| pagesA/study/ | LearnAI.vue | /learn-ai |
| pagesA/settings/ | Settings.vue | /settings |
| pagesA/business-card/ | BusinessCard.vue | /business-card |
| pagesA/earn_commission/ | CommissionPlan.vue | /commission/plan |
| pagesA/ai_career/ | AICareer.vue | /ai-career |
| pagesA/fankui/ | Feedback.vue | /feedback |
| pagesA/message/ | **MessageCenter.vue** (新增) | /messages |
| pagesA/news/ | **NewsDetail.vue** (新增) | /news/:id |
| pagesA/study/video_detail | **StudyVideoDetail.vue** (新增) | /study/video/:id |
| pages/income/ | MyCommission.vue | /income/commission |
| pages/distribution_personnel_list/ | DistributionTeam.vue | /distribution/team |
| pages/distribution_order_list/ | DistributionOrderList.vue | /distribution-order-list |
| pages/user_order_list/ | OrderList.vue | /order-list |
| pagesA/vip/trader | VipTrader.vue | /vip/trader |
| pagesA/vip/details | VipDetails.vue | /vip/details |
| pagesA/dev_enter/ | AgentDeveloper pages | /ai-management |
| pagesA/assistant/ | AIAssistant.vue | /ai-assistant |

待迁移（优先级较低）：

- pagesA/live-streaming/ — 直播功能（需 WebSocket 支持）
- pagesA/AgentDialoguePage/ — Agent 对话页（Web 已有 AIAssistant + conversation）
- pagesA/AICircle/ — AI圈（小程序端也仅为占位页）
- pagesA/carte/ — 个人名片分享页（Web 已有 BusinessCard）

验证：`npm run typecheck` 通过；新路由可通过 `npm run dev` 访问。

---

### 阶段 3：小程序 Vue3 UniApp 升级（预计 4～8 周）

> 这是方案 B 的核心，完成后可共享 composables、逐步复用组件。

#### 3.1 技术选型

- **目标**：UniApp Vue3 + Vite（官方 `@dcloudio/uni-app` 3.x）
- **不采用**：把官网 Vite SPA 直接编译为小程序（不可行）

#### 3.2 升级步骤

1. 在 `miniapp/` 新建分支，使用 [uni-app Vue3 迁移指南](https://uniapp.dcloud.net.cn/tutorial/migration-to-vue3.html)
2. `Vuex` → `Pinia`（可与官网共用 store 模式）
3. `pages.json` 保留，逐页改为 `<script setup>`
4. 替换 Vue2 专有 API：`$set`、`filters`、`.sync` 等
5. 微信插件 `materialPlugin`、uniCloud 配置原样迁移
6. 分分包验证：主包 tab → tools 分包 → pagesA 分包

#### 3.3 阻塞项清单（需专项处理）

| 阻塞项 | 处理方式 |
|--------|----------|
| Vue 2.6 + vue-template-compiler | 升级至 Vue 3 + @dcloudio/vite-plugin-uni |
| Options API mixins（aiWebSocketMixin 等） | 改写为 composables |
| flyio | 统一为 shared-services + uni.request |
| markdown-pdf 等 Node 依赖 | 移出小程序 bundle，仅 H5/服务端使用 |

**验收**：`npm run dev:mp-weixin` 使用 Vue3 工具链；主流程（登录→首页→智能体对话）与升级前一致。

---

### 阶段 4：UI 与设计系统对齐（预计 4～6 周）

- 将官网 `_design-tokens.scss` 导出为 CSS 变量包 `packages/shared-tokens`
- 小程序全局样式引用同一套色板 / 圆角 / 间距
- 抽取无 Element Plus 依赖的展示组件到 `packages/shared-ui`（按钮、卡片、空状态）
- 官网继续 Element Plus；小程序用 uni-ui 或自研，但**视觉 token 一致**

**验收**：设计稿对比误差在 token 级别可解释；暗色模式变量命名统一。

---

### 阶段 5：CI/CD 与发布一体化（预计 1 周）

```yaml
# 目标流水线
- build:shared
- typecheck (web)
- build:web → 部署 CDN
- miniapp:install + build:mp-weixin → 上传微信开发者工具 / CI 上传
- build:h5 (可选，小程序 H5 与官网 H5 策略分离)
```

- 微信 `project.config.json` 的 `miniprogramRoot` 保持 `dist/build/mp-weixin/`
- uniCloud `uniCloud-aliyun/` 随 miniapp 目录一并维护
- 废弃根目录无效的 `BUILD_PLATFORM=wx` Vite 构建（已改为 `build:mp-weixin`）

---

## 4. 目录与命令速查

### 开发

```bash
# 官网
npm run dev              # http://127.0.0.1:8888

# 共享包
npm run build:shared

# 微信小程序（首次需安装 miniapp 依赖）
npm run miniapp:install
npm run dev:mp-weixin    # 产出 dist/dev/mp-weixin，用微信开发者工具打开

# 全量构建
npm run build:all
```

### 微信开发者工具

打开目录：`officialsite/miniapp/dist/dev/mp-weixin`（开发）或 `dist/build/mp-weixin`（生产）

---

## 5. 风险与回滚

| 风险 | 缓解 |
|------|------|
| Vue2/Vue3 依赖冲突 | miniapp 独立 `node_modules`，不加入 workspaces |
| 小程序包体积超限 | 保持分包结构；阶段 3 后 tree-shaking |
| API 变更导致一端失败 | shared-api 单测 + 变更必须同时改两端 re-export |
| 迁移周期过长 | 每阶段独立合并；功能开关控制新 service |

**回滚**：保留 `G:\Ai-WXMiniVue` 原仓库只读备份，直至阶段 3 完成。

---

## 6. 里程碑时间表（建议）

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M0 Monorepo | ✅ 已完成 | miniapp 迁入 + shared-api |
| M1 共享层 | ✅ 已完成 | shared-types、shared-auth |
| M2 服务对齐 | ✅ 已完成 | 登录 + 智能体 + VIP + 支付 + 课程 + 广场 + AI对话 + 分销 共用 service |
| M3 页面迁移 + Vue3 升级 | ✅ 已完成 | Web 页面补齐 3 个缺失页；UniApp Vue3 升级完成 |
| M4 设计统一 | ✅ 已完成 | shared-tokens + shared-ui 落地 |
| M5 CI 一体化 | ✅ 已完成 | 自动构建小程序 |

### M3 详细完成清单（2026-06-11）

**Vue3 升级：**
- [x] package.json 升级到 Vue3 + UniApp 3.x + Pinia
- [x] vite.config.ts 创建 Vite 构建配置
- [x] tsconfig.json 创建 TypeScript 配置
- [x] Pinia store 创建（user.ts）
- [x] main.ts 使用 createSSRApp API

**Vue2 API 替换：**
- [x] `$store` → Pinia `useUserStore`（24处）
- [x] `$children` → `ref`（4处）
- [x] `beforeDestroy` → `beforeUnmount`（33处）
- [x] `$styleVariables` 注册到 `globalProperties`

**页面迁移：**
- [x] 主包：login.vue、user/index.vue、tools/index.vue、learn.vue、distribution/index.vue、income/index.vue、member/index.vue
- [x] tools 子包：token_value.vue、ranking-detail.vue、ai_assistant.vue、ai_assistant_n8n.vue、ai_index2.vue、ai_index3.vue、ai_group/index.vue、aigc/index.vue
- [x] 其他子包：distribution_personnel_list/index.vue、distribution_order_list/index.vue、user_order_list/index.vue
- [x] pagesA 子包：settings/index.vue、top-up/index.vue、withdrawal/index.vue、distribution/index.vue、news/detail.vue、message/index.vue、fankui/index.vue、vip_info/index.vue、study/video_detail.vue、business-card/index.vue、earn_commission/index.vue、plaza/index.vue

---

## 7. 下一步行动（立即可做）

1. 执行 `npm run miniapp:install` 安装小程序依赖  
2. 微信开发者工具导入 `miniapp/dist/dev/mp-weixin` 验证主流程  
3. 启动阶段 1：创建 `packages/shared-types`，从 `login.js` / `auth` API 开始抽取类型  
4. 在 `miniapp/docs/` 记录与官网功能差异表（页面级对照）

---

*文档版本：2026-06-10 · 维护者：智汇 AI 前端团队*
