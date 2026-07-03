# 智汇AI全栈生态 - 项目总览（合并文档）

> **新人必读**：[前端开发环境端口约定](client/docs/DEV_PORTS.md) (8000 后端 / 8888 前端 / 18000 已废弃)
>
> 端口配置单一来源：[client/config/ports.ts](file:///g:/1/client/config/ports.ts)
>
> 一键启动本地开发：`powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1`
>
> 一键准备 CI 环境：`powershell -ExecutionPolicy Bypass -File scripts/ci-env-setup.ps1`

**架构名称：IHUI AI 架构。** 本文档由 **ZHS Server Java** 与 **ihui API**（统一 AI 模型调用服务）两份 README 合并而成，并**丰富**了当前工作区前端项目（智汇AI官网）的深度分析。**原有两份文档内容均完整保留**，仅做结构整合与前端能力补充。

---

## 迁移状态徽章 (2026-06-18)

![API v2 迁移率](https://img.shields.io/badge/API_v2_Migration-96%25-brightgreen?style=flat-square)
![v2 端点总数](https://img.shields.io/badge/v2_Endpoints-1035-blue?style=flat-square)
![Vite Proxy 重写](https://img.shields.io/badge/Vite_Proxy-v1_to_v2-success?style=flat-square)
![Smoke Test](https://img.shields.io/badge/Smoke_Test-77%2F77-brightgreen?style=flat-square)
![P9 批次](https://img.shields.io/badge/P9_Batch-7_modules-ff69b4?style=flat-square)
![总迁移批次](https://img.shields.io/badge/Migration_P0_P9-10_batches-blueviolet?style=flat-square)

### 迁移里程碑

| 批次 | 模块数 | 新增端点 | 累计 v2 端点 | 累计覆盖率 |
|------|-------|---------|------------|-----------|
| P0-P4 | 30 | 198 | 198 | 16.5% |
| P5 | 11 | 98 | 296 | 24.6% |
| P6 | 22 | 147 | 443 | 36.9% |
| P7 | 6 | 149 | 592 | 49.3% |
| P8 | 14 | 267 | 859 | 71.4% |
| **P9** | **7** | **176** | **1035** | **86.2%** |

### 关键技术变更

- **Vite proxy v1→v2 自动重写** ([vite.config.ts](file:///g:/1/client/vite.config.ts))：所有前端 v1 调用自动改写为 v2
- **统一 `success()` 返回**：所有 v2 端点使用项目标准 [common schema](file:///g:/1/server/app/schemas/common.py)
- **CI 阻断脚本**：[.github/workflows/ci.yml](file:///g:/1/.github/workflows/ci.yml) 检查 v1 新增端点
- **运行时审计脚本**：[audit_runtime2.py](file:///g:/1/tmp/audit_runtime2.py) 实时统计迁移率

---

## 一、工作区前端项目深度分析（智汇AI官网 / ihui-agi-inf-web）

> 以下内容基于本工作区 **g:\officialsite**（智汇AI社区前端）的包、路由、服务与能力进行归纳，便于与后端/API 服务对照。

### 1.1 项目概览

| 项目 | 说明 |
|------|------|
| **名称** | ihui-agi-inf-web（智汇AI社区 - 专业的AI工具集成平台） |
| **类型** | 前端 Web 应用（Vue 3 + TypeScript + Vite） |
| **多端构建** | Web、H5、支付宝小程序、Electron（同一代码库，`BUILD_PLATFORM` 切换） |
| **开发端口** | 默认 8888（`npm run dev`） |
| **引擎要求** | Node >= 20.0.0 |
| **许可证** | Apache-2.0 |

### 1.2 技术栈与核心依赖

- **框架**：Vue 3、Vue Router 4、Pinia、Vue I18n  
- **构建**：Vite 7、Vue TSC、unplugin-auto-import、unplugin-vue-components  
- **UI**：Element Plus、Tailwind CSS、SCSS（ITCSS + BEM）、设计令牌与断点  
- **文档/办公**：@vue-office（docx/excel/pdf/pptx）、marked、highlight.js、jsPDF、ExcelJS、pdfjs-dist  
- **AI/实时**：axios、socket.io-client、echarts、qrcode、crypto-js、dayjs、DOMPurify  
- **多端/可视化**：Vize 插件（可选）、rollup-plugin-visualizer  
- **测试**：Vitest、@vue/test-utils、@playwright/test  

### 1.3 功能模块（按路由与页面）

#### 基础与认证

- 首页（`/`）、设计系统演示、Aizhs 演示  
- 登录、注册、忘记密码、手机绑定  
- 404 与全局路由守卫（登录态、过期、第三方回调清理）

#### AI 与智能体

- **AI 世界**：`/ai-world`、详情与 Banner 详情  
- **智能体**：广场 `/agents`、分类、创建、详情 `/agents/:id`；设计器 `/designer-agent`；AI 管理 `/ai-management`  
- **MCP**：MCP 服务器管理 `/mcp-manager`、mcp-use 框架 `/mcp-use`、mcp-use 项目页 `/mcp-use-project`  
- **统一 AI**：统一能力中心 `/unified-ai`、模型管理 `/models-management`、Agentic AI `/agentic-ai`、智能体仪表板 `/agentic-dashboard`  
- **对话与知识**：对话页 `/conversation`、聊天记录 `/chat-history`、知识库 `/knowledge`、任务 `/tasks`、收藏 `/favorites`  
- **助手与编排**：AI 助手、n8n 助手、AI 团队、智能体收益、n8n 智能体、变量、OAuth 应用  
- **生成**：AI 生成 `/ai-generation`  
- **API 测试**：`/api-test`

#### 用户与资产

- 用户中心、个人资料、设置、密钥管理 `/key-management`  
- VIP、成为操盘手、个人名片  
- 钱包、充值、提现、订单列表、订单详情、退款与退款管理  
- 分销中心、分销公司/团队/团队详情、分销订单、佣金方案、Token 价值  
- 支付、充值成功/失败、佣金收入、提现与提现记录、VIP 详情、数据统计  
- 客服中心、工单相关

#### 开放平台与文档

- 开放平台首页 `/open`、Dashboard、SDKs、模型、智能体、APIs、文档、文档中心  
- 文件管理、权限管理、审计日志、文档中心（支持中心）

#### 社区与内容

- 广场 `/plaza`、需求 `/xuqiu`、需求详情、工具商店（重定向至智能体）  
- AI 社区、课程列表与详情、社区、关于我们、反馈、帮助、分享  
- AI 职业、技术服务、我的预约、自定义客服、企业服务、人机协作、Agent 场景  
- 学习 AI、隐私政策/服务条款/支付条款/用户协议（重定向文档）、支持文档中心  
- 关于-新闻中心、关于我们、联系我们、加入我们

#### 管理端（需管理员权限）

- 灰度发布、依赖管理、事件总线监控、监控仪表板、错误统计、性能分析、移动端适配  
- 推荐配置、数据库优化、用户管理、产品管理、活动管理、课程管理、智能体管理  
- 支付管理、提现管理、资金管理、反馈管理、FAQ 管理、Webhook 管理  
- Dashboard、结算管理、智能体分类管理、智能体审核管理  

### 1.4 核心服务与能力（src/services、composables、api）

- **统一 AI 编排**：`unified-ai-orchestrator` — 统一编排 Model、Agent、Agentic、MCP、Hybrid、Auto 等能力类型，支持能力组合与降级。  
- **AI 能力发现与推荐**：`ai-capability-discovery` — 按使用场景与关键词推荐能力；`ai-capability-documentation`、`ai-capability-templates`、`ai-capability-marketplace`、`ai-capability-analytics`、`ai-capability-testing` 等配套能力。  
- **AI 工作流**：`ai-workflow-orchestrator`。  
- **Clawdbot 体系**：`clawdbot`（gateway、message-processor、task-executor、self-evolution、automation）及 channels、tools、memory、mcp、integrations、canvas、browser、skills、pairing、nodes、models、voice 等子模块。  
- **MCP 与 mcp-use**：`mcp-use-adapter`、MCP 相关 API 与 composables（如 `useMCP`、`useMCPIntegration`）。  
- **ihui API 集成**：`cozeApiService`（对接 ihui API 统一 LLM 与智能体）。  
- **认证与流程**：`unifiedAuthService`、`auth-flow.service`。  
- **引导与运营**：tour 系列（灰度、依赖、事件总线、监控、性能、权限、安全、告警、推荐、多平台、国际化、版本、回滚、可视化、同步、租户、模板、AI 辅助、可访问性等）。  
- **内容与激励**：`news-crawler`、`news-scheduler`、`news-storage`、`rewardService`、`user-memory`。  
- **技能与认知**：`skills-manager`、`cognitive-intelligence`。  
- **客服**：客服 WebSocket、工单等 composables/api。

### 1.5 状态与存储（stores）

- **auth**：token、user、vip、wallet、permissions、thirdParty、tour-permissions 等。  
- **全局**：loading、language、darkMode、font、chatMode、aiChat、core（app）。  

### 1.6 能力与优势小结

- **多端一致**：Web / H5 / 支付宝 / Electron 一套代码，构建产物分离。  
- **国际化**：vue-i18n + 路由级语言与 SEO 标题/描述/关键词。  
- **统一 AI 体验**：统一能力中心 + 编排 + 发现推荐 + MCP/Agentic/模型/智能体一体化。  
- **开放平台**：API 一览、文档、SDK、模型、智能体、权限与审计，便于对外售卖与集成。  
- **完整用户与商业**：登录注册、VIP、钱包、订单、退款、分销、佣金、提现、客服、密钥管理。  
- **运营与监控**：引导 tour、灰度、监控、错误/性能仪表板、推荐配置等管理端能力。  
- **工程化**：ESLint、Stylelint、lint-staged、simple-git-hooks、Vitest、Playwright、类型检查与预部署检查。  

---

## 二、ZHS Server Java（原 README.md 完整内容）

# ZHS Server Java

ZHS平台是一个综合性的AI服务与教育平台，整合了多种AI能力，提供了完整的用户管理、支付、分销、课程等功能模块，支持微信小程序访问。

## 项目简介

ZHS平台致力于为用户提供智能化的AI服务和优质的教育资源。平台集成了智能体管理、课程管理、支付系统、分销系统等核心功能，为用户提供全方位的服务体验。

## 技术栈

- 后端框架：Spring Boot
- 数据库：MySQL
- 缓存：Redis
- 文件存储：MinIO
- 支付：微信支付
- 认证：JWT
- 实时通信：WebSocket

## 功能模块

### 1. 课程模块功能

#### 课程管理
- 课程列表查询：支持分页、排序、多条件查询
- 课程详情获取：获取课程详细信息
- 新增课程：创建新的课程
- 修改课程：更新课程信息
- 删除课程：删除课程（支持批量删除）
- 下架课程：将课程下架

#### 课程视频管理
- 视频上传：上传课程视频
- 视频编辑：编辑视频信息
- 视频删除：删除课程视频

#### 课程分类管理
- 分类字典管理：管理课程分类

#### 课程支付管理
- 课程购买记录：记录用户购买课程的信息
- 支付日志：记录支付流水

#### 用户课程记录
- 用户观看记录：记录用户观看课程的历史
- 用户评论：用户对课程的评论
- 点赞功能：用户对课程或评论的点赞

#### 教育平台管理
- 平台信息管理：管理教育平台的基本信息
- 用户平台关联：管理用户与平台的关联关系

#### 身份管理
- 用户身份类型管理：管理不同的用户身份类型

#### 组织管理
- 组织架构管理：管理平台的组织结构

### 2. 应用模块功能

#### 授权管理
- 用户授权管理：管理用户的授权信息
- 小程序解绑：解除用户与小程序的绑定关系

#### 支付管理
- 微信支付集成：支持微信支付功能
- 订单管理：订单创建、查询、关闭
- 退款处理：处理退款申请

#### 用户管理
- 用户信息管理：管理用户基本信息
- 用户VIP管理：管理用户的VIP状态
- 用户资金信息：管理用户的资金信息

### 3. Small模块功能（小程序相关）

#### 登录认证
- 微信OpenID获取：获取用户的微信OpenID
- 手机号登录：通过手机号进行登录
- 微信账号换绑：更换绑定的微信账号
- 小程序码生成：生成小程序推广码

#### 资源管理
- Token扣减/回退：管理用户Token的使用和回退
- 智能体列表：获取可用的智能体列表
- 文件上传：支持文件上传功能
- 用户上下文管理：管理用户的对话上下文

#### 支付管理
- 微信支付下单：创建微信支付订单
- 订单查询：查询订单状态
- 关闭订单：关闭未支付订单
- 退款申请：处理退款请求
- 支付回调处理：处理支付成功回调

#### 智能体管理
- 智能体上传：上传自定义智能体
- 变量选择：选择智能体使用的变量
- 请求处理：处理智能体的请求
- 购买记录：记录智能体购买信息

#### 活动管理
- 活动列表查询：查询平台活动
- 活动详情获取：获取活动详细信息

#### 分销管理
- 下家列表：查看下级分销商
- 订单管理：管理分销订单
- 数据统计：查看分销数据统计
- 佣金管理：管理分销佣金

#### 提现管理
- 提现申请：用户发起提现申请
- 提现记录：查看提现历史记录
- 可收款查询：查询可提现金额

#### 身份管理
- 身份开通订单：管理身份开通订单
- 身份类型管理：管理不同的身份类型

#### 用户反馈
- 反馈提交：用户提交反馈
- 反馈列表：查看用户反馈
- 反馈处理：处理用户反馈

#### 智能体审核
- 智能体审核列表：查看待审核的智能体
- 审核详情：查看智能体审核详情
- 审批通过/驳回：处理智能体审核

#### 信息管理
- 资讯发布：发布平台资讯
- 资讯列表：查看平台资讯

#### 应用版本管理
- 版本更新管理：管理应用版本更新

### 4. 核心功能

#### 安全认证
- JWT令牌管理：管理用户认证令牌
- 登录拦截：拦截未登录请求
- 权限控制：控制用户访问权限

#### 缓存管理
- Redis缓存配置：配置和使用Redis缓存

#### 文件存储
- MinIO对象存储集成：集成MinIO进行文件存储

#### WebSocket支持
- 实时通信支持：支持WebSocket实时通信

#### 工具类
- 加密解密：提供加密解密功能
- HTTP请求：封装HTTP请求工具
- 签名验证：验证请求签名
- 图片/视频水印处理：为图片和视频添加水印

### 5. 分销系统

#### 分销流水管理
- 订单列表：查看分销订单
- 流水列表：查看分销流水
- 分销统计：查看分销统计数据

#### 团队管理
- 团队成员查询：查看团队成员
- 按中心查询团队：按中心查看团队成员

#### 佣金管理
- 佣金明细查询：查看佣金明细
- 佣金统计：统计佣金数据

#### 操盘手管理
- 下家管理：管理下级分销商
- 订单统计：统计订单数据
- 数据卡片统计：查看数据卡片统计

## 项目结构

```
src/main/java/com/ai/manager/
├── app/           # 应用模块
├── core/          # 核心模块
├── course/        # 课程模块
└── small/         # 小程序模块
```

## 快速开始

### 环境要求

- JDK 1.8+
- Maven 3.6+
- MySQL 5.7+
- Redis 3.0+

### 安装步骤

1. 克隆项目到本地
```bash
git clone [repository-url]
```

2. 修改配置文件
- 配置数据库连接信息
- 配置Redis连接信息
- 配置MinIO连接信息
- 配置微信支付相关参数

3. 启动项目
```bash
mvn clean install
mvn spring-boot:run
```

## API文档

详细的API接口文档请参考项目中的 `server/deploy/legacy-archive/docs/API接口文档.md` 文件。

## 注意事项

1. 所有需要身份验证的接口都需要在请求头中携带有效的JWT令牌
2. 日期时间格式统一使用ISO 8601标准
3. 金额单位统一为分
4. 分页参数：page从1开始，size默认为10
5. 列表接口默认按创建时间倒序排列

## 联系方式

如有问题或建议，请联系项目维护者。

## 许可证

[License Information]

---

## 三、ihui API（原 README(1).md 完整内容）

# ihui API - 统一AI模型调用平台（IHUI AI 架构 · API 层）

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-green.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.116+-red.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

**🚀 统一AI模型调用接口 | 实时通信 | 多模态支持 | 企业级计费**

[核心功能](#核心功能) • [快速开始](#快速开始) • [API文档](#api文档) • [架构设计](#架构设计)

</div>

---

## 📖 项目简介

ihui API 是 **IHUI AI 架构** 下的统一 AI 模型调用服务，基于 FastAPI 构建。项目核心围绕 `langchain_api_mini.py` 提供的统一 LLM 接口展开，为各类 AI 模型和智能体提供标准化的调用方式，同时支持公共 Socket、Room 聊天、用户管理等子功能。

### 核心价值

- 🎯 **统一模型接口** - 通过`langchain_api_mini.py`统一调用各类AI模型和智能体
- ⚡ **高性能架构** - 支持高并发请求，连接池优化，Redis缓存加速
- 🔌 **实时通信** - WebSocket流式对话、公共Socket推送、Room聊天
- 🎨 **多模态支持** - 图像、视频、音频等多媒体处理能力
- 💰 **灵活计费** - Token计费系统，支持多种用户类型和计费规则
- 🛡️ **企业级安全** - OAuth认证、权限管理、数据加密

---

## 🎯 核心功能

### 🤖 统一LLM接口 (langchain_api_mini.py)

这是项目的核心接口，提供统一的AI模型调用能力：

#### 主要特性
- ✅ **统一模型配置** - 通过`zhs_ai_model_info_unify`表统一管理所有模型配置
- ✅ **多协议支持** - 支持URL模式、Curl模式、WebSocket模式
- ✅ **流式响应** - 实时推送思考过程(thinking)和答案(content)
- ✅ **多模态支持** - 支持文本、图像、视频、音频输入
- ✅ **自动计费** - 根据模型配置自动计算和扣除Token
- ✅ **上下文保存** - 自动保存对话历史到数据库

#### 支持的模型类型
- **Ark Responses API** - 豆包系列模型
- **DashScope Responses API** - 通义千问系列模型
- **OpenAI兼容接口** - DeepSeek等兼容模型
- **Curl模式** - 支持自定义curl命令的模型
- **ihui 智能体** - 通过内部 WebSocket 代理调用（兼容 Coze 等平台）

#### 核心接口

##### 1. HTTP非流式接口
```
POST /ihui-ai-api/llm/chat
```

**请求参数：**
```json
{
  "prompt": "用户输入",
  "model_id": "模型code",
  "user_uuid": "用户UUID",
  "chat_id": "聊天ID",
  "files": [{"imgUrl": "图片URL"}],
  "zidingyican": [{"name": "temperature", "value": 0.7}]
}
```

**响应格式：**
```json
{
  "code": 0,
  "data": {
    "content": "答案内容",
    "thinking": "思考过程",
    "model": "模型名称"
  }
}
```

##### 2. WebSocket流式接口
```
WS /ihui-ai-api/llm/ws
```

**消息格式：**
```json
{
  "prompt": "用户输入",
  "model_id": "模型code",
  "user_uuid": "用户UUID",
  "chat_id": "聊天ID",
  "files": [{"imgUrl": "图片URL"}],
  "zidingyican": [{"name": "temperature", "value": 0.7}]
}
```

**推送事件：**
- `conversation.message.delta` - 思考过程片段
- `conversation.chat.completed` - 答案片段
- `system.error` - 错误信息

##### 3. 模型列表接口
```
GET /ihui-ai-api/llm/models-unify
```

返回所有可用模型的完整配置信息。

### 🔌 实时通信

#### 公共Socket (public_socket)
- ✅ 用户消息推送
- ✅ 实时状态更新
- ✅ 多设备同步
- ✅ 消息持久化

#### Room聊天 (chat_room_socket)
- ✅ 多用户群聊
- ✅ 房间管理
- ✅ 消息广播
- ✅ 在线状态

#### WebSocket流式对话
- ✅ 实时流式响应
- ✅ 思考过程展示
- ✅ 自动重连机制
- ✅ 心跳检测

### 👤 用户管理

#### 用户认证
- OAuth 2.0认证
- JWT令牌验证
- 设备码认证
- PKCE认证

#### 用户权限
- Token余额验证
- 模型访问控制
- 计费规则管理
- 操作日志记录

### 💎 多媒体处理

#### 图像生成
- 通义千问图像生成
- 豆包图像生成
- 即梦图像生成
- 火山引擎视觉服务

#### 视频处理
- 通义千问视频生成
- 豆包视频生成
- 可灵视频合成
- 视频编辑转换

#### 音频处理
- 通义千问音频处理
- 豆包实时语音
- 语音转文字
- 文字转语音

### 🤖 智能体管理

#### 智能体生命周期
- ✅ 智能体创建与编辑
- ✅ 智能体发布与审核
- ✅ 智能体分类管理
- ✅ 智能体购买系统
- ✅ 智能体结算管理
- ✅ 开发者收益提现

#### 智能体配置
- ✅ 智能体头像与开场白
- ✅ 智能体变量配置
- ✅ 智能体计费规则
- ✅ 智能体权限管理

#### 核心接口

**智能体列表**
```bash
GET /ihui-ai-api/agents
# 或兼容路径：/cozeZhsApi/agents
```

**创建智能体**
```bash
POST /ihui-ai-api/agents
# 或兼容路径：/cozeZhsApi/agents
```

**智能体审核**
```bash
POST /ihui-ai-api/agent-examine
# 或兼容路径：/cozeZhsApi/agent-examine
```

**智能体购买**
```bash
POST /ihui-ai-api/agent-buy
# 或兼容路径：/cozeZhsApi/agent-buy
```

**结算管理**
```bash
GET /ihui-ai-api/agent-settlement
# 或兼容路径：/cozeZhsApi/agent-settlement
```

**提现管理**
```bash
GET /ihui-ai-api/agent-withdrawal-detail
# 或兼容路径：/cozeZhsApi/agent-withdrawal-detail
```

### 🔐 用户认证与授权

#### OAuth认证方式
- ✅ **设备码认证** - 适用于无浏览器设备
- ✅ **Web授权** - 标准OAuth 2.0 Web流程
- ✅ **PKCE授权** - 移动端和单页应用
- ✅ **JWT授权** - 服务端到服务端集成

#### 用户管理
- ✅ 用户注册与登录
- ✅ 用户信息管理
- ✅ 用户SK（Secret Key）管理
- ✅ 用户权限验证
- ✅ 用户余额管理

#### OAuth应用管理
- ✅ 应用创建与管理
- ✅ 应用密钥管理
- ✅ 应用权限配置

#### 核心接口

**设备码授权**
```bash
POST /ihui-ai-api/oauth/device
# 或兼容路径：/cozeZhsApi/oauth/device
```

**获取设备令牌**
```bash
POST /ihui-ai-api/oauth/device/token
```

**刷新设备令牌**
```bash
POST /ihui-ai-api/oauth/device/refresh
```

**Web授权**
```bash
POST /ihui-ai-api/oauth/web
```

**PKCE授权**
```bash
POST /ihui-ai-api/oauth/pkce
```

**JWT授权**
```bash
POST /ihui-ai-api/oauth/jwt
```

### 🛠️ 工具与辅助

#### Token管理
- ✅ Token余额验证
- ✅ Token计算与扣减
- ✅ Token流水记录
- ✅ 多用户类型计费（普通/VIP/操盘手）

#### 文件管理
- ✅ 文件上传
- ✅ 文件下载
- ✅ 图片处理
- ✅ 文件持久化

#### 消息处理
- ✅ 消息格式化
- ✅ 消息推送
- ✅ 消息历史管理

#### 用户上下文
- ✅ 用户智能体上下文管理
- ✅ 对话历史管理
- ✅ 会话状态维护

#### 核心工具接口

**Token验证**
```bash
POST /api/token/check
```

**文件上传**
```bash
POST /api/file/upload
```

**Base64上传**
```bash
POST /api/file/uploadByBase64
```

---

## 🏗️ 架构设计（IHUI AI 架构）

本服务属于 **IHUI AI 架构** 的 API 层，与前端（智汇AI官网）、ZHS Server Java 共同构成智汇AI全栈生态。

### 技术栈

#### 后端框架
- **FastAPI** - 高性能Web框架
- **Uvicorn** - ASGI服务器
- **SQLAlchemy** - ORM框架
- **Pydantic** - 数据验证

#### 数据存储
- **MySQL** - 关系型数据库（双数据源）
- **Redis** - 缓存和会话存储

#### 实时通信
- **WebSocket** - 实时双向通信
- **Socket.IO** - 跨平台实时通信
- **SSE** - 服务器推送事件

#### AI服务集成
- **通义千问（DashScope）** - 阿里云AI服务
- **智谱AI（GLM）** - 智谱AI大模型
- **豆包** - 字节跳动AI服务
- **DeepSeek** - DeepSeek大模型
- **ihui 智能体** - 智汇 AI 自建智能体（兼容 Coze 等平台）

### 项目结构

```
ihui-api/                    # 原 coze_zhs_py，ihui API 服务仓库
├── api/                           # API接口层
│   ├── langchain_api_mini.py       # 核心统一LLM接口 ⭐
│   ├── public_socket.py            # 公共Socket推送
│   ├── chat_room_socket.py        # Room聊天
│   ├── token_utils.py             # Token计费工具
│   ├── websocket_*.py            # 各模型WebSocket实现
│   └── ...
├── models/                        # 数据模型层
├── schemas/                       # 数据模式层
├── services/                      # 服务层
├── utils/                         # 工具模块
├── sql/                          # SQL脚本
├── static/                       # 静态文件
├── docs/                         # 文档
├── config.py                     # 配置管理
├── database.py                   # 数据库配置
├── main.py                       # 应用入口
└── requirements.txt              # 依赖列表
```

### 核心设计

#### 统一模型调用流程

```
用户请求 → langchain_api_mini.py
         ↓
    查询模型配置(zhs_ai_model_info_unify)
         ↓
    判断调用模式(URL/Curl/WebSocket)
         ↓
    构建请求参数(messages/variables)
         ↓
    调用对应模型服务
         ↓
    处理响应(思考过程/答案)
         ↓
    Token计费和扣减
         ↓
    保存对话记录
         ↓
    推送公共Socket
```

#### 分层架构
- **API层** - 接口定义和请求处理
- **服务层** - 业务逻辑实现
- **模型层** - 数据访问和持久化
- **工具层** - 通用工具和辅助函数

#### 多数据源设计
- 小程序库（zhs_ai_project）- 业务数据
- 中心库（zhs_center_project）- 用户数据
- 智能路由和透明切换

---

## 🚀 快速开始

### 环境要求

- Python 3.8+
- MySQL 5.7+
- Redis 5.0+

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/yourusername/ihui-api.git
cd ihui-api
```

2. **安装依赖**
```bash
pip install -r requirements.txt
```

3. **配置环境变量**

创建`.env`文件并配置以下关键参数：

```env
# API服务配置
API_HOST=0.0.0.0
API_PORT=8000
API_DEBUG=True

# 数据库配置
DATABASE_URL=mysql+pymysql://user:password@host:port/zhs_ai_project
DATABASE_URL1=mysql+pymysql://user:password@host:port/zhs_center_project

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# ihui API / 第三方智能体配置（可选）
COZE_API_TOKEN=your_token
COZE_API_BASE=https://api.coze.cn

# 第三方服务配置
DASHSCOPE_API_KEY=your_key
GLM_API_KEY=your_key
DOUBAO_API_KEY=your_key
```

4. **初始化数据库**

```bash
# 执行SQL脚本初始化数据库表
mysql -u user -p zhs_ai_project < sql/zhs_agent_category.sql
mysql -u user -p zhs_ai_project < sql/zhs_agent_developer.sql
# ... 其他SQL脚本
```

5. **启动服务**

```bash
python main.py
```

或使用Uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 访问服务

- API服务: http://localhost:8000
- Swagger文档: http://localhost:8000/docs
- ReDoc文档: http://localhost:8000/redoc

---

## 📚 API文档

### 核心接口

#### 1. 统一LLM接口

**HTTP非流式**
```bash
POST /ihui-ai-api/llm/chat
```

**WebSocket流式**
```bash
WS /ihui-ai-api/llm/ws
```

**获取模型列表**
```bash
GET /ihui-ai-api/llm/models-unify
```

#### 2. 公共Socket接口

**发送消息**
```bash
POST /api/public/send
```

**订阅消息**
```bash
WS /api/public/subscribe
```

#### 3. Room聊天接口

**加入房间**
```bash
WS /api/room/join
```

**发送消息**
```bash
POST /api/room/send
```

详细API文档请访问：http://localhost:8000/docs

---

## 💡 使用示例

### HTTP调用示例

```python
import httpx

async def call_llm():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/ihui-ai-api/llm/chat",
            json={
                "prompt": "你好，请介绍一下自己",
                "model_id": "qwen-plus",
                "user_uuid": "user123",
                "chat_id": "chat456"
            }
        )
        result = response.json()
        print(f"答案: {result['data']['content']}")
        print(f"思考过程: {result['data']['thinking']}")
```

### WebSocket流式调用示例

```python
import asyncio
import websockets
import json

async def stream_chat():
    uri = "ws://localhost:8000/ihui-ai-api/llm/ws"
    async with websockets.connect(uri) as websocket:
        # 发送请求
        await websocket.send(json.dumps({
            "prompt": "讲一个有趣的故事",
            "model_id": "qwen-plus",
            "user_uuid": "user123",
            "chat_id": "chat456"
        }))

        # 接收流式响应
        async for message in websocket:
            data = json.loads(message)
            event = data.get("event")

            if event == "conversation.message.delta":
                # 思考过程
                print(f"思考: {data['data']['content']}", end="")
            elif event == "conversation.chat.completed":
                # 答案片段
                print(f"答案: {data['data']['content']}", end="")
```

更多示例代码请参考 [examples/](examples/) 目录。

---

## 🔧 配置说明

### 模型配置 (zhs_ai_model_info_unify表)

| 字段 | 说明 | 示例 |
|------|------|------|
| code | 模型唯一标识 | qwen-plus |
| name | 模型名称 | 通义千问Plus |
| model_code | 实际模型代码 | qwen-plus |
| url | API地址 | https://dashscope.aliyuncs.com/api/v2 |
| access_key | API密钥 | sk-xxx |
| task_generation | 创建任务curl | curl -X POST ... |
| task_query | 查询任务curl | curl -X GET ... |
| manufacturer | 厂商 | dashscope |
| is_gratis | 是否免费 | 0/1 |
| variables | 自定义参数 | [{"name":"temperature","value":0.7}] |

### 计费配置

```python
# config.py
TOKEN_BASE_MULTIPLIER = 2.0  # Token倍率
TOKEN_NORMAL_USER_PER_YUAN = 20000  # 普通用户
TOKEN_VIP_USER_PER_YUAN = 20000  # VIP用户
TOKEN_TRADER_USER_PER_YUAN = 80000  # 操盘手
```

---

## 📊 性能优化

### 缓存策略
- Redis缓存模型配置
- 内存缓存降级
- 缓存过期和更新机制

### 连接池优化
- 数据库连接池（50核心+200溢出）
- HTTP连接池复用
- WebSocket连接管理

### 异步处理
- 异步IO操作
- 异步数据库查询
- 流式响应

---

## 🛡️ 安全性

- OAuth 2.0认证
- JWT令牌验证
- CORS跨域控制
- 数据加密存储
- 权限管理和访问控制
- API密钥管理

---

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 📮 联系方式

- 项目主页: [https://github.com/yourusername/ihui-api](https://github.com/yourusername/ihui-api)
- 问题反馈: [https://github.com/yourusername/ihui-api/issues](https://github.com/yourusername/ihui-api/issues)
- 邮箱: your.email@example.com

---

<div align="center">

**如果这个项目对您有帮助，请给个⭐️支持一下！**

Made with ❤️ by IHUI AI 架构 · 智汇AI团队

</div>

---

## 四、三者协作关系简要说明

- **前端（本工作区 ihui-agi-inf-web）**：面向用户与运营的 Web/H5/支付宝/Electron 端，提供统一 AI 能力中心、智能体广场、开放平台、用户/订单/分销/客服等完整界面，并调用后端与 **ihui API**。
- **ZHS Server Java**：提供课程、支付、分销、小程序端业务（登录、Token、智能体、活动、提现、反馈、审核、资讯等）的 REST API 与 WebSocket，与前端和小程序对接。
- **ihui API（Python/FastAPI）**：**IHUI AI 架构** 下的统一 AI 层，提供统一 LLM 调用、流式对话、多模态、Token 计费、OAuth、智能体生命周期与结算等能力，与前端“统一 AI”及 Java 侧智能体业务配合，形成完整 AI 中台。

三者共同构成 **IHUI AI 架构** / 智汇AI全栈生态：前端展示与交互，Java 负责业务与数据，ihui API 负责统一 AI 与计费。

---

## 五、开发规范（P22/P23 工程化强化）

### 5.1 工作区卫生

项目实施 **三层防护** 确保文件夹时刻保持干净整洁：

| 层级 | 机制 | 作用 |
|------|------|------|
| 1. 本地 pre-commit | client/.husky/pre-commit + server/.pre-commit-config.yaml | 提交前拦截运行时产物 |
| 2. CI workflow | .github/workflows/ci.yml `workspace-hygiene` job | 推送后检查 git 追踪的禁止文件 |
| 3. .gitignore | 根/client/server 三级 .gitignore | 兜底排除所有运行时产物 |

### 5.2 禁止提交的文件

以下文件/目录 **禁止提交到 git**（被 pre-commit 钩子和 CI 拦截）：

**目录类**：`pw-output/` `screenshots/` `test-results/` `storybook-static/` `audit/` `.ruff_cache/` `logs/` `tmp/`

**文件类**：`eslint-report.json` `e2e_failed_list.txt` `e2e_full_log.txt` `test-output.json` `temp_style.scss` `pytest_full.txt` `pytest_result.txt` `business-metrics.txt` `*.log` `.env.backup` `.env.bak`

### 5.3 一键清理命令

```bash
# 前端清理（删除 pw-output/screenshots/dist/*.log 等）
cd client && npm run clean

# 后端清理（删除 __pycache__/.pytest_cache/*.log 等）
cd server && python scripts/clean.py
```

### 5.4 定期自动清理

- **CI 定时任务**：[.github/workflows/weekly-cleanup.yml](file:///g:/1/.github/workflows/weekly-cleanup.yml) 每周一北京时间 03:00 自动运行 clean 脚本并提交清理
- **手动触发**：在 GitHub Actions 页面可手动触发 `weekly-cleanup` workflow

### 5.5 提交前检查清单

**前端**（client/）：
- `npm run lint` — ESLint 检查（0 errors）
- `npm run typecheck` — vue-tsc 类型检查（0 errors）
- `npm run check:no-important` — 禁止 !important 样式

**后端**（server/）：
- `ruff check app/ scripts/ tests/` — Ruff lint
- `mypy app/ --ignore-missing-imports` — MyPy 类型检查
- `pytest --collect-only -q` — 测试收集检查（0 errors）

### 5.6 项目目录结构

```
g:\1/
├── .github/workflows/     # CI + 定期清理
├── client/                # 前端（Vue 3 + Vite + TS）
├── server/                # 后端（FastAPI + Python）
├── docs/archive/          # 历史文档归档
├── scripts/archive/       # 历史脚本归档
├── public/mock-data/      # Mock 数据
├── .gitignore             # 根级忽略规则
├── docker-compose.yml     # 容器编排
├── Dockerfile.client      # 前端镜像
├── Dockerfile.server      # 后端镜像
├── nginx.conf             # 反向代理
└── README.md              # 项目总览
```
