# 智汇AI社区 (iHui AI) - 专业的AI工具集成平台

> **新人必读**：[开发环境端口约定](docs/DEV_PORTS.md) (8000 后端 / 8888 前端 / 18000 已废弃)
>
> 快速启动开发环境：`powershell -ExecutionPolicy Bypass -File ../scripts/dev-up.ps1`

## 项目简介

智汇AI社区是一个专业的AI工具集成平台，提供丰富的AI能力、智能体管理、内容生成、画廊展示等功能。

## 技术栈

- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite 7
- **UI组件库**: Element Plus + shadcn/ui (Vue)
- **状态管理**: Pinia
- **路由**: Vue Router
- **样式**: SCSS + Tailwind CSS
- **测试**: Vitest + Playwright
- **代码质量**: ESLint + Prettier

## 仓库结构（Monorepo）

本仓库包含 **官网 Web** 与 **微信小程序（UniApp）** 多端代码：

| 目录 | 说明 |
|------|------|
| `src/` | 官网前端（Vue 3 + Vite，端口 8888） |
| `miniapp/` | 微信小程序 UniApp（Vue 2，独立 `node_modules`） |
| `packages/shared-api/` | 多端共享 API 配置（基址、端点、白名单、小程序原始 ID） |
| `packages/shared-types/` | 多端共享业务类型（登录、智能体、订单、分页等） |
| `packages/shared-auth/` | 多端共享登录态 key、token 判断、平台类型归一化 |
| `packages/shared-services/` | 多端共享无 UI 业务服务（token 刷新、智能体请求等） |
| `backend/` | Python FastAPI 辅助服务 |
| `docs/plans/2026-06-10-miniapp-monorepo-migration.md` | 完整融合迁移计划（方案 B） |

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm >= 9.0.0
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（开发小程序时）

### 安装依赖

```bash
# 官网 + 共享包
npm install

# 微信小程序（首次或 miniapp/package.json 变更后）
npm run miniapp:install
```

### 开发模式

```bash
# 官网
npm run dev

# 微信小程序（编译后使用微信开发者工具打开 miniapp/dist/dev/mp-weixin）
npm run dev:mp-weixin
```

项目将在 `http://127.0.0.1:8888` 启动。官网与「AI世界」（`/ai-world`）由同一 dev 服务提供，**无需单独为 AI世界 启任何 dev 服务**。

### 构建生产版本

```bash
# 官网
npm run build

# 微信小程序
npm run build:mp-weixin

# 共享包（会同步生成 miniapp/src/vendor/*.bundle.js）
npm run build:shared

# 全端（官网 web/h5/alipay/electron + 小程序）
npm run build:all
```

官网构建产物输出到 `dist/`；小程序输出到 `miniapp/dist/build/mp-weixin/`

### 可选：Vize 集成（Rust Vue 工具链）

项目已集成 [Vize](https://vizejs.dev) 作为可选的 Vue SFC 编译后端，启用后可获得更快的冷启与构建。默认使用官方 `@vitejs/plugin-vue`，无需改动即可开发/构建。启用方式与说明见 [docs/VIZE.md](docs/VIZE.md)。

### 预览生产构建

```bash
npm run preview
```

### 部署后页面/样式是旧版？

**原因**：SPA 入口 `index.html` 被浏览器或 CDN 强缓存后，会一直加载**旧版本**的 JS/CSS（文件名带旧 hash），所以看到的是旧样式（例如 AI世界、首页等）。

**处理**：

1. **Nginx**：对根路径（含 `/`、`/ai-world` 等 SPA 路由）返回的 HTML 禁止缓存。本仓库已配置：
   - `nginx-production.conf`、`nginx.conf` 的 `location /` 已加 `Cache-Control: no-cache, no-store, must-revalidate`。
   - 部署时请使用或合并该配置，并执行 `nginx -s reload`。
2. **CDN**：若前面有 CDN，请对 `index.html` 或路径 `/` 设置「不缓存」或短 max-age（如 0、60）。
3. **临时验证**：用户端可强刷（Ctrl+Shift+R）或清缓存后刷新，确认是否已为新版。

## 项目结构

```
ihui-ai-officialsite-interface/
├── src/
│   ├── api/              # API 接口定义
│   ├── assets/           # 静态资源
│   ├── components/       # Vue 组件
│   │   └── ui/          # shadcn/ui 组件（迁移自 React）
│   ├── composables/     # Vue Composables
│   ├── lib/             # 工具库
│   │   └── utils.ts    # 工具函数（cn 函数）
│   ├── router/          # 路由配置
│   ├── services/        # 业务服务
│   ├── stores/          # Pinia 状态管理
│   ├── styles/          # 全局样式
│   ├── utils/           # 工具函数
│   └── views/           # 页面视图
│       └── AizhsDemo.vue # 组件迁移示例页面
├── components.json       # shadcn/ui 配置
├── tailwind.config.js    # Tailwind CSS 配置
├── tests/               # 测试文件
├── public/              # 公共静态资源（含 ai-world/ 静态站，随 dev/build 一起提供）
└── dist/                # 构建输出目录
```

## 主要功能

- 🤖 **AI能力管理**: 统一的AI能力接口和模型管理
- 👤 **智能体系统**: 智能体创建、管理和使用
- 🧠 **Agentic AI系统**: 智能体集群（Agent Swarm）、分层规划、反思和自我纠正、元学习
- 🎨 **内容生成**: 文本、图片等内容生成工具
- 🖼️ **画廊展示**: 作品展示和管理
- 👥 **用户系统**: 用户注册、登录、个人中心
- 💎 **VIP系统**: 会员订阅和权益管理
- 📊 **数据统计**: 使用统计和数据分析
- 🔌 **MCP集成**: Model Context Protocol 集成
- 🎨 **shadcn/ui 组件**: 迁移自 React 的 UI 组件库，提供现代化的组件设计

## shadcn/ui 组件使用

项目已集成 shadcn/ui（Vue 版本），提供了现代化的 UI 组件。

### 使用示例

```vue
<template>
  <Button variant="default" @click="handleClick">
    点击我
  </Button>
  <Button variant="outline">轮廓按钮</Button>
  <Button variant="destructive">危险按钮</Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
</script>
```

### 查看示例

访问 `/aizhs-demo` 路由查看组件迁移示例页面。

### 添加新组件

项目已配置 `components.json`，可以使用 shadcn/ui CLI 添加新组件（需要适配 Vue）。

## 开发规范

### 代码风格

- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 遵循 Vue 3 Composition API 最佳实践
- 遵循扁平化设计规范（禁止使用 text-shadow 和 box-shadow）

### 提交代码前

> **重要**：首次拉取代码后，请运行 `npm install`，会自动初始化 git hooks（simple-git-hooks）。
> 如果后续 `package.json` 中的 `simple-git-hooks` 配置有变更，请重新运行 `npm install` 或 `npx simple-git-hooks` 更新钩子。

项目已配置以下 git hooks（位于 `.husky/` 目录）：

- **pre-commit**：lint-staged（ESLint + Stylelint）+ no-important 检查 + nul 残留扫描 + 工作区卫生检查 + markraw 规则检查
- **pre-push**：TypeScript 类型检查 + 样式审计（no-important / colors / font-size）+ 设计令牌检查 + 高特异性选择器检测

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format

# 类型检查
npm run type-check

# 高特异性选择器检测（项目代码中不允许有 4 类以上嵌套的选择器）
npm run check:high-specificity
```

## 测试

### 测试状态

- **测试通过率**: **99.8%** (599/600 passed, 1 skipped) ✅
- **测试框架**: Vitest 2.1.8
- **测试文件**: 31 个测试文件
- **测试用例**: 600 个测试用例
- **测试脚本**: 
  - `npm run test` - 运行所有测试
  - `npm run test:watch` - 监听模式运行测试
  - `npm run test:ui` - 打开测试UI界面
  - `npm run test:coverage` - 生成覆盖率报告

### 运行单元测试

```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npm run test tests/unit/utils/storage.test.ts

# 监听模式运行测试
npm run test:watch

# 打开测试UI界面
npm run test:ui
```

### 运行 E2E 测试

```bash
npm run test:e2e
```

### 测试覆盖率

```bash
# 运行测试并生成覆盖率报告
npx vitest run --coverage

# 查看覆盖率报告（会生成 coverage/ 目录）
# 在浏览器中打开 coverage/index.html
```

## 文档

### 文档索引

完整的文档索引请查看: [docs/INDEX.md](docs/INDEX.md)

### 主要文档

- **开发指南**: [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) ⭐ 推荐阅读
- **开发规范**: [docs/DEVELOPMENT_STANDARDS.md](docs/DEVELOPMENT_STANDARDS.md)
- **设计系统**: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- **API文档**: [public/docs/developer/api/](public/docs/developer/api/)
- **用户指南**: [public/docs/user/](public/docs/user/)

## 代码质量检查

### 代码重复检测

```bash
npm run check:duplication
```

### TODO 注释分析

```bash
npm run check:todos
```

### 性能检查

```bash
npm run performance:check
```

## 环境变量

项目使用 `.env` 文件管理环境变量，主要变量包括：

- `VITE_API_BASE_URL`: 后端API地址
- `VITE_JAVA_API_BASE_URL`: Java后端API地址

## 构建配置

- **端口**: 开发服务器默认端口 8888
- **CSS压缩**: 使用 esbuild（支持 Vue :deep() 语法）
- **代码分割**: 已优化，大型依赖库单独打包
- **Tree-shaking**: 已启用

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用私有许可证，未经授权不得使用。

**开放平台半开源售卖**：智汇开放平台以半开源形式在 GitHub 提供代码与文档的有限分发。定价、售卖规则、开源协议及交付说明见 [docs/OPEN_PLATFORM_README.md](docs/OPEN_PLATFORM_README.md)。官网「开放平台」页也提供购买与许可说明。

## 联系方式

如有问题或建议，请联系项目维护团队。

---

## 📊 项目全面分析报告

### 一、环境要求

#### 运行环境
- **Node.js**: >= 20.0.0（项目要求，package.json engines 指定）
- **包管理器**: npm >= 9.0.0
- **操作系统**: Windows 10/11, macOS, Linux（支持跨平台开发）

#### 开发环境
- **开发服务器端口**: 8888（固定端口，不可更改）
- **浏览器支持**: 现代浏览器（Chrome、Firefox、Safari、Edge）
- **构建工具**: Vite 5.4.11

#### 生产环境
- **Web服务器**: Nginx（生产环境使用）
- **部署端口**: 80

### 二、依赖管理

#### 包管理器
- **主包管理器**: npm
- **锁文件**: `package-lock.json`
- **依赖安装**: `npm install`

#### 核心依赖（生产环境）
```json
{
  "vue": "3.5.24",
  "vue-router": "4.6.3",
  "pinia": "2.3.1",
  "element-plus": "2.11.8",
  "axios": "1.7.9",
  "vue-i18n": "9.14.5",
  "echarts": "5.5.2",
  "marked": "11.2.0",
  "socket.io-client": "4.7.5",
  "zod": "4.1.13",
  "vee-validate": "4.15.1",
  "reka-ui": "2.6.0",
  "tailwindcss": "4.1.17"
}
```

#### 开发依赖
- **构建工具**: Vite 5.4.11, vue-tsc 2.1.10
- **测试框架**: Vitest 2.1.8, Playwright 1.56.1
- **代码质量**: ESLint 9.39.1, Prettier 3.4.2
- **类型检查**: TypeScript 5.9.3
- **样式处理**: Sass 1.94.2, PostCSS 8.5.6, Tailwind CSS 4.1.17

### 三、架构设计

#### 整体架构
```
┌─────────────────────────────────────────┐
│           前端应用层 (Vue 3)            │
├─────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ 路由层   │  │ 状态管理 │  │ 组件层 ││
│  │ Vue Router│  │  Pinia   │  │ Vue SFC││
│  └──────────┘  └──────────┘  └────────┘│
├─────────────────────────────────────────┤
│           业务逻辑层                     │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ Composables│ │ Services │ │  Utils ││
│  └──────────┘  └──────────┘  └────────┘│
├─────────────────────────────────────────┤
│           数据访问层                     │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │  API层   │  │ WebSocket│ │ Storage││
│  └──────────┘  └──────────┘  └────────┘│
└─────────────────────────────────────────┘
         │              │              │
    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
    │ Node.js │    │  Java   │    │ Python  │
    │ 后端    │    │  后端   │    │ 后端    │
    │ :3333   │    │ :9206   │    │ :8000   │
    └─────────┘    └─────────┘    └─────────┘
```

#### 架构模式
- **MVVM 模式**: Vue 3 响应式系统
- **组件化架构**: 单文件组件（SFC）
- **组合式 API**: Vue 3 Composition API
- **模块化设计**: 按功能模块划分（api、components、composables、services）

### 四、端口使用规范

项目严格限制端口使用：
- **8888**: 主项目前端（官网）
- **8083**: 后台管理端
- **3333**: Node.js 后端（通过代理）
- **9206**: Java 后端
- **8000**: Python 后端（FastAPI）

### 五、国际化支持

#### 支持的语言（5 种）
- 中文（简体：zh-CN，繁体：zh-TW）
- 英语（en）
- 日语（ja）
- 韩语（ko）

#### 国际化配置
- 默认语言: 简体中文（zh-CN）
- 语言切换: 支持动态切换
- 语言持久化: localStorage 存储
- 字体切换: 根据语言自动切换字体

---

## 🧩 子项目与模块文档

### 一、开放平台模块

开放平台子项目提供了文档管理、格式化工具和日志工具等功能。

#### 目录结构

```
open-platform/
├── api/
│   ├── documents.ts          # 文档管理API
│   └── __tests__/            # API测试
├── utils/
│   ├── format.ts             # 格式化工具
│   ├── logger.ts             # 日志工具
│   └── __tests__/            # 工具测试
├── components/               # 组件
└── views/                    # 视图
```

#### API 文档

##### 文档管理API (`api/documents.ts`)

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getDocuments(kbId?, params?)` | kbId: string, params: PaginationParams | Promise<ApiResponse<DocumentListResponse>> | 获取文档列表 |
| `getDocument(id, kbId?)` | id: string, kbId?: string | Promise<ApiResponse<Document \| null>> | 获取文档详情 |
| `createDocument(data, kbId)` | data: Partial<Document>, kbId: string | Promise<ApiResponse<Document>> | 创建文档 |
| `updateDocument(id, data, kbId?)` | id: string, data: Partial<Document> | Promise<ApiResponse<Document>> | 更新文档 |
| `deleteDocument(id, kbId)` | id: string, kbId: string | Promise<ApiResponse<void>> | 删除文档 |

##### 格式化工具 (`utils/format.ts`)

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `formatDate(date, locale?)` | Date \| string, string | string | 格式化日期 |
| `formatDateTime(date, locale?)` | Date \| string, string | string | 格式化日期时间 |
| `formatRelativeTime(date)` | Date \| string | string | 格式化相对时间 |
| `formatFileSize(bytes, decimals?)` | number, number | string | 格式化文件大小 |
| `formatNumber(num, locale?)` | number, string | string | 格式化数字 |
| `formatPercent(value, decimals?)` | number, number | string | 格式化百分比 |
| `formatCurrency(amount, currency?, locale?)` | number, string, string | string | 格式化货币 |

#### 测试

```bash
pnpm test open-platform
```

---

### 二、用户 Composables 模块

用户中心相关的 Composables 集合，提供用户信息管理、安全设置、消息中心等功能。

#### 项目统计

- **Composables 总数**: 15 个（包含 3 个公共 composables）
- **测试文件**: 15 个
- **测试覆盖率**: 76 个测试用例，76 个通过（100%）

#### 目录结构

```
src/composables/user/
├── usePagination.ts        # 分页管理
├── useStatusFormatter.ts   # 状态格式化
├── useListData.ts          # 列表数据管理
├── useUserProfile.ts       # 用户个人信息
├── useUserSecurity.ts      # 账户安全
├── useUserMessages.ts      # 消息中心
├── useUserSettings.ts      # 用户设置
├── useUserFavorites.ts     # 我的收藏
├── useUserPurchases.ts     # 我的购买
├── useUserUpload.ts        # 上传智能体
├── useUserExamine.ts       # 我的审核
├── useUserOrders.ts        # 订单管理
├── useUserDeveloper.ts     # 开发者管理
├── useUserPurchaseRecords.ts # 购买记录
└── useUserStatistics.ts    # 数据统计
```

#### 公共 Composables

##### usePagination

通用的分页管理 Composable，提供分页状态管理和处理方法。

```typescript
const { pagination, handlePageChange, handlePageSizeChange } = usePagination({
  initialPage: 1,
  initialPageSize: 20,
  onPageChange: async (page) => {
    await loadData(page)
  },
})
```

##### useStatusFormatter

状态格式化 Composable，提供状态文本和类型转换功能。

```typescript
const { getStatusText, getStatusType, isExpired } = useStatusFormatter()
const statusMap = { '0': '待处理', '1': '已完成' }
const text = getStatusText('0', statusMap) // '待处理'
```

##### useListData

列表数据管理 Composable，提供列表数据加载、搜索、缓存等功能。

```typescript
const { list, loading, search, loadData } = useListData({
  loadFunction: async ({ uuid, page, pageSize }) => {
    return await getListData({ uuid, page, pageSize })
  },
  cacheKey: 'myList',
  enableCache: true,
})
```

#### 测试

```bash
pnpm test:run src/composables/user/__tests__
```

---

### 三、AI新闻自动抓取服务

自动从国内外AI权威新闻源抓取最新新闻，每天固定两个时间段自动更新。

#### 功能特性

- ✅ 支持多个新闻源（RSS、API、网页抓取）
- ✅ 每天两个时间段自动抓取（早上8点、晚上8点，北京时间）
- ✅ 自动提取新闻标题、摘要、内容、图片
- ✅ 自动保存到数据库
- ✅ 支持手动触发抓取
- ✅ 支持测试模式

#### 新闻源列表

**国外AI权威媒体**：TechCrunch、The Verge、Wired、MIT Technology Review、OpenAI Blog、DeepMind Blog、Anthropic Blog、AI News、VentureBeat

**国内科技媒体**：36氪、爱范儿、极客公园、雷锋网

#### 使用方法

```bash
# 启动定时任务服务
npm run news-crawler:start

# 手动触发一次抓取
npm run news-crawler:crawl

# 测试模式
npm run news-crawler:test
```

#### 配置

修改 `config.ts` 中的 `SCHEDULE_CONFIG`:

```typescript
export const SCHEDULE_CONFIG = {
  morning: { hour: 8, minute: 0, timezone: 'Asia/Shanghai' },
  evening: { hour: 20, minute: 0, timezone: 'Asia/Shanghai' },
}
```

#### 部署

```bash
# 使用PM2部署
pm2 start npm --name "news-crawler" -- run news-crawler:start
```

---

### 四、AI世界静态站与爬虫

#### 与官网的关系

- **前端展示**：官网导航「AI世界」对应路由 `/ai-world`，页面内嵌静态站 `public/ai-world/index.html`
- **静态站来源**：由仓库内 `pa网站` 项目生成/维护，拷贝到 `public/ai-world/` 后由官网直接提供
- **运行方式**：**只跑官网项目的 `npm run dev`**，AI世界随官网一起提供

#### 爬虫与数据位置

| 用途 | 路径/文件 |
|------|-----------|
| 导航爬虫 | `pa网站/navigation_spider.py` |
| 工具页爬虫 | `pa网站/crawl_ai_tools_playwright.py` |
| HTML 内容替换 | `pa网站/replace_html_content.py` |
| 爬取结果 | `pa网站/crawled_data/`、`pa网站/page_content_data/` |
| 静态站源码 | `pa网站/ai_tools_data/ai-world/` |

#### 更新官网上的 AI世界 静态站

```powershell
robocopy "pa网站\ai_tools_data\ai-world" "public\ai-world" /E /NFL /NDL /NJH /NJS /NC /NS /NP
```

---

### 五、暗色模式 SVG 文件说明

为了支持暗色模式下的图片切换，需要以下文件：

| 文件 | 功能 |
|------|------|
| `bailogo.svg` | 暗色模式下的顶部菜单栏 Logo |
| `baiwelcome.svg` | 暗色模式下的登录页面 Welcome 图片 |

**错误处理**：如果暗色模式文件不存在，系统会自动回退到亮色模式文件。

---

### 六、代码简化工具

一个使用 Claude AI 自动简化和重构代码的命令行工具。

#### 功能特性

- ✅ **配置文件支持** - 项目级和用户级配置
- ✅ **进度条显示** - 批量处理时实时显示进度
- ✅ **智能重试** - 自动重试机制，指数退避
- ✅ **忽略模式** - 支持 glob 模式，可配置忽略文件
- ✅ **更好的错误处理** - 详细的错误信息和分类

#### 安装

```bash
cd code-simplifier
npm install
```

#### 配置 API Key

```bash
# Windows PowerShell
$env:ANTHROPIC_API_KEY="your-api-key"

# Linux/Mac
export ANTHROPIC_API_KEY="your-api-key"
```

#### 使用

```bash
# 简化单个文件
node bin/code-simplifier.js file.js

# 批量处理目录
node bin/code-simplifier.js src/ -r

# 预览模式
node bin/code-simplifier.js src/ -r --dry-run
```

#### 选项

| 选项 | 说明 |
|------|------|
| `-o, --output <path>` | 输出文件路径 |
| `-r, --recursive` | 递归处理目录 |
| `--extensions <exts>` | 文件扩展名（默认: js,ts,jsx,tsx,py,java,cpp,c） |
| `--api-key <key>` | Anthropic API key |
| `--model <model>` | Claude 模型（默认: claude-3-5-sonnet-20241022） |
| `--dry-run` | 预览模式 |

---

### 七、后端 API 服务

云雾API功能后端代码包 - 可直接集成到现有Spring Boot项目。

#### 项目信息

- **Java 版本**：1.8
- **Spring Boot 版本**：2.7.0
- **Lombok 版本**：1.18.24
- **MyBatis Plus 版本**：3.5.3

#### Eclipse 快速开始

1. **导入项目**：`File → Import... → Existing Maven Projects`
2. **配置 JDK 8**：`Window → Preferences → Java → Installed JREs`
3. **刷新 Maven 项目**：右键项目 → Maven → Update Project...

#### 配置状态

- ✅ Maven 构建配置完整
- ✅ Spring Security 依赖已添加
- ✅ Lombok 支持已配置
- ✅ Eclipse Java 版本配置正确（Java 1.8）

---

### 八、Claude Skills

已安装的高星 Claude Skills 集合。

#### 安装概要

- **总 Skills 数**: 20
- **来源仓库**:
  - `anthropics/skills` (官方, 53.4k stars)
  - `ComposioHQ/awesome-claude-skills` (26k stars)

#### 已安装 Skills

| 类别 | Skills |
|------|--------|
| 文档处理 | docx, pdf, pptx, xlsx, doc-coauthoring |
| 开发工具 | mcp-builder, webapp-testing, langsmith-fetch, changelog-generator, skill-creator |
| 设计创意 | algorithmic-art, brand-guidelines, canvas-design, frontend-design |
| 内容写作 | content-research-writer, tailored-resume-generator, twitter-algorithm-optimizer |
| 效率组织 | file-organizer, meeting-insights-analyzer |
| 社交媒体 | x-publish |

---

## 🧠 Agentic AI 系统

### 系统概述

Agentic AI 是项目的核心 AI 能力之一，实现了智能体集群（Agent Swarm）系统，支持多智能体协作、分层规划、反思和自我纠正等高级 AI 能力。

### 核心功能

#### 1. Agent Swarm（智能体集群）

- **功能**: 创建和管理多个智能体协作完成任务
- **协调模式**: 分层协调、点对点、市场机制
- **API**: `/ai/agentic/swarm/create`

#### 2. 分层规划系统

- **战略层**: 高层目标、约束、资源、时间线
- **战术层**: 战术策略、协调机制
- **操作层**: 具体执行步骤、调度计划

#### 3. 反思和自我纠正

Agent 执行任务后进行反思，识别错误并自动纠正。

#### 4. 元学习

学习如何学习，从经验中提取学习模式。

### Agent 类型与状态

| 类型 | 说明 |
|------|------|
| 思考层 | 负责推理和规划 |
| 执行层 | 负责具体执行任务 |
| 专业层 | 负责特定领域的专业任务 |

| 状态 | 说明 |
|------|------|
| IDLE | 空闲 |
| THINKING | 思考中 |
| ACTING | 执行中 |
| REFLECTING | 反思中 |
| COMPLETED | 已完成 |
| FAILED | 失败 |

### 快速开始

```bash
# Windows 一键启动
npm run agentic:quick-start:win

# Linux/Mac 一键启动
npm run agentic:quick-start
```

### 访问地址

- **前端页面**: http://127.0.0.1:8888/agentic-ai
- **后端 API 文档**: http://127.0.0.1:8000/docs
- **健康检查**: http://127.0.0.1:8000/health

### 后端接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/agentic/swarm/create` | 创建 Swarm |
| GET | `/api/ai/agentic/swarm/{swarmId}/status` | 获取状态 |
| GET | `/api/ai/agentic/swarm/{swarmId}/results` | 获取结果 |
| GET | `/api/ai/agentic/swarm/{swarmId}/performance` | 获取性能指标 |
| GET | `/api/ai/agentic/swarms` | 获取列表 |
| POST | `/api/ai/agentic/swarm/{swarmId}/cancel` | 取消 Swarm |
| GET | `/api/ai/agentic/swarm/{swarmId}/optimization` | 获取优化建议 |
| WS | `/api/ai/agentic/swarm/{swarmId}/ws` | WebSocket 实时更新 |

---

## 📚 markstream-vue 融合文档

项目已完整融合 `markstream-vue` 流式 Markdown 渲染库。

### 核心文档

1. **[主融合计划](./docs/MARKSTREAM_VUE_INTEGRATION_MASTER_PLAN.md)** - 完整的技术调研、融合方案、风险评估
2. **[API 完整性检查](./docs/MARKSTREAM_VUE_API_COMPLETENESS.md)** - API 功能检查清单
3. **[更新流程文档](./docs/MARKSTREAM_VUE_UPDATE_PROCEDURE.md)** - 版本更新操作流程
4. **[维护文档索引](./docs/MARKSTREAM_VUE_MAINTENANCE_INDEX.md)** - 文档中央索引

### 融合状态

- ✅ **核心功能**: 100% 完成
- ✅ **代码块复制功能**: 100% 完成
- ✅ **Mermaid 图表支持**: 100% 完成（默认启用）
- ✅ **KaTeX 公式支持**: 100% 完成（默认启用）
- ✅ **滚动控制功能**: 100% 完成
- ✅ **错误处理增强**: 100% 完成
- ✅ **流式输出功能**: 100% 完成
- ✅ **文档体系**: 100% 完成

---

## 📊 项目规模统计

### 代码规模

- **总文件数**: 1,498 个源代码文件
- **总代码行数**: 496,354 行
- **Vue 组件**: 469 个
- **TypeScript 文件**: 721 个
- **测试文件**: 181 个
- **API 接口**: 66 个

### 语言分布

| 语言 | 文件数 | 代码行数 | 占比 |
|------|--------|----------|------|
| TypeScript | 734 | 154,971 | 30.94% |
| JavaScript | 149 | 113,954 | 22.75% |
| JSON | 27 | 104,027 | 20.77% |
| Vue | 470 | 101,651 | 20.29% |
| SCSS | 28 | 14,477 | 2.89% |
| Markdown | 39 | 10,349 | 2.07% |
| Python | 1 | 523 | 0.10% |
| CSS | 57 | 219 | 0.04% |

---

## 🐛 Bug修复历史

### 2025-01-27 - 深度Bug修复与代码质量优化

**修复统计**:
- ✅ **圆角值修复**: 135+处
- ✅ **描边优化**: 552+处
- ✅ **类型安全**: 修复多处 any 类型使用
- ✅ **内存泄漏**: 检查并确认清理逻辑正确
- ✅ **Console日志**: 替换为 logger

**验证结果**:
- ✅ ESLint检查: 通过（0错误）
- ✅ TypeScript类型检查: 通过（0错误）
- ✅ 代码编译: 正常
- ✅ 样式规范: 符合项目规范

---

**最后更新**: 2026-02-13
**分析版本**: 1.0.0
**项目状态**: ✅ 所有任务已完成，代码质量优秀
