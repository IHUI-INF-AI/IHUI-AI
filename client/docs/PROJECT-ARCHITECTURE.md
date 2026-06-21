# 智汇AI社区 (iHui AI) - 项目架构与结构文档

> 更新日期：2026-06-13
> 版本：v2.0（含管理端整合）

---

## 一、项目概述

**项目名称：** ihui-agi-inf-web  
**描述：** 智汇AI社区 - 专业的AI工具集成平台（Monorepo：官网 + 管理端 + 微信小程序）  
**技术栈：** Vue 3 + TypeScript + Vite + Element Plus + Tailwind CSS  
**状态管理：** Pinia（主站）+ Vuex（管理端）共存  
**包管理：** npm workspaces monorepo

---

## 二、项目架构图

```
G:\officialsite/
├── src/                          # 主站源码
│   ├── main.ts                   # 应用入口（Pinia + Vuex + 全局注册）
│   ├── App.vue                   # 根组件（isAdminRoute 条件渲染）
│   ├── router/                   # 路由系统
│   │   ├── index.ts              # 路由配置（合并所有模块）
│   │   ├── modules/              # 路由模块
│   │   │   ├── base.ts           # 基础路由（首页、登录、注册）
│   │   │   ├── admin.ts          # 官网管理路由
│   │   │   ├── admin-ruoyi.ts    # RuoYi管理端路由（97条）
│   │   │   ├── admin-h5.ts       # H5移动端管理路由（6条）
│   │   │   ├── user.ts           # 用户中心路由
│   │   │   ├── ai.ts             # AI功能路由
│   │   │   ├── api.ts            # 开放平台路由
│   │   │   └── community.ts      # 社区路由
│   │   ├── platform/             # 平台特定路由（web/h5/alipay/electron）
│   │   └── utils/                # 路由工具（组件加载器、路由合并）
│   ├── stores/                   # Pinia 状态管理
│   │   ├── auth/                 # 认证状态（token、用户、VIP等）
│   │   ├── darkMode.ts           # 暗色模式
│   │   ├── language.ts           # 语言切换
│   │   └── loading.ts            # 全局加载状态
│   ├── store/admin/              # Vuex 管理端状态（共存）
│   │   ├── index.ts              # Vuex store 入口
│   │   └── modules/              # 模块（app、dict、user、permission、settings、tagsView）
│   ├── api/                      # API 接口层
│   │   ├── core/                 # 核心 API 客户端
│   │   ├── admin/                # 管理端 API（85个文件）
│   │   │   ├── request.ts        # 管理端请求适配器
│   │   │   ├── login.ts          # 登录接口
│   │   │   ├── ai/               # AI业务接口
│   │   │   ├── auth/             # 认证接口
│   │   │   ├── course/           # 课程接口
│   │   │   ├── system/           # 系统管理接口
│   │   │   └── ...
│   │   └── ...                   # 主站API（150+模块）
│   ├── views/                    # 页面视图
│   │   ├── admin-ruoyi/          # 管理端视图（114个Vue文件）
│   │   │   ├── ai/               # AI业务页面（33个）
│   │   │   ├── auth/             # 认证管理页面（15个）
│   │   │   ├── course/           # 课程管理页面（14个）
│   │   │   ├── system/           # 系统管理页面（10个）
│   │   │   ├── monitor/          # 监控管理（2个）
│   │   │   ├── official/         # 官网管理（4个）
│   │   │   ├── h5/               # H5移动端页面（5个）
│   │   │   ├── dashboard/        # 仪表盘图表
│   │   │   └── ...
│   │   └── ...                   # 主站页面（168个）
│   ├── components/               # 组件库
│   │   ├── admin-ruoyi/          # 管理端组件（29个）
│   │   │   ├── Crontab/          # Cron表达式编辑器
│   │   │   ├── DictData/         # 字典数据
│   │   │   ├── Editor/           # 富文本编辑器
│   │   │   ├── SvgIcon/          # SVG图标
│   │   │   └── ...
│   │   └── ...                   # 主站组件（71+目录）
│   ├── layout-admin/             # 管理端布局
│   │   ├── AdminLayout.vue       # 桌面端布局（侧边栏+导航栏）
│   │   ├── AdminLayoutH5.vue     # H5移动端布局（顶部栏+底部TabBar）
│   │   ├── AdminSidebarItem.vue  # 侧边栏菜单项
│   │   ├── components/           # 布局子组件
│   │   │   ├── Navbar.vue        # 导航栏
│   │   │   ├── Sidebar/          # 侧边栏
│   │   │   ├── AppMain.vue       # 主内容区
│   │   │   └── Settings/         # 设置面板
│   │   └── mixin/                # 布局混入（ResizeHandler）
│   ├── utils/admin/              # 管理端工具（28个）
│   │   ├── auth.ts               # 认证工具（含SSO桥接）
│   │   ├── request.ts            # 请求封装
│   │   ├── ruoyi.ts              # RuoYi工具函数
│   │   ├── validate.ts           # 验证工具
│   │   └── dict/                 # 字典工具
│   ├── plugins/admin/            # 管理端插件（6个）
│   ├── directives/admin/         # 管理端指令（7个）
│   ├── locales/admin/            # 管理端国际化（6个语言）
│   ├── assets/admin/             # 管理端静态资源
│   │   ├── styles/               # 样式文件
│   │   │   ├── index.scss        # 主样式入口
│   │   │   ├── theme.scss        # 主题样式（深色/浅色）
│   │   │   └── responsive.scss   # 响应式样式
│   │   ├── icons/                # SVG图标
│   │   └── images/               # 图片资源
│   ├── composables/              # Vue组合式函数
│   ├── services/                 # 服务层
│   ├── config/                   # 配置文件
│   ├── shared/                   # 共享工具
│   ├── styles/                   # 主站样式（87个文件）
│   └── ...
├── packages/                     # Monorepo 共享包
│   ├── shared-api/               # 共享API
│   ├── shared-types/             # 共享类型
│   ├── shared-services/          # 共享服务
│   ├── shared-auth/              # 共享认证
│   ├── shared-logic/             # 共享逻辑（跨平台桥接）
│   ├── shared-tokens/            # CSS设计Token
│   └── shared-ui/                # 共享UI组件
├── miniapp/                      # 微信小程序（UniApp）
│   ├── src/pages/                # 主页面
│   ├── src/pagesA/               # 子包页面（45个目录）
│   └── src/pages.json            # 页面配置（713行）
├── .env                          # 基础环境变量
├── .env.development              # 开发环境
├── .env.production               # 生产环境
├── vite.config.ts                # Vite配置（1852行）
├── tsconfig.json                 # TypeScript配置
├── nginx-production.conf         # Nginx生产配置
├── docker-compose.yml            # Docker编排
└── package.json                  # Monorepo配置
```

---

## 三、路由架构

### 3.1 路由模块总览

| 模块 | 文件 | 路由数 | 说明 |
|------|------|--------|------|
| base | base.ts | 8 | 首页、登录、注册、404、403 |
| admin | admin.ts | 24 | 官网管理（灰度发布、监控等） |
| admin-ruoyi | admin-ruoyi.ts | 97 | RuoYi管理端（系统/AI/认证/课程/监控） |
| admin-h5 | admin-h5.ts | 6 | H5移动端管理（仪表盘/用户/订单/设置） |
| user | user.ts | 57 | 用户中心（VIP/钱包/订单/分销等） |
| ai | ai.ts | 44 | AI功能（智能体/MCP/模型/生成等） |
| api | api.ts | 17 | 开放平台（API文档/SDK/权限等） |
| community | community.ts | 50 | 社区（广场/课程/企业/动态等） |
| **总计** | | **303** | |

### 3.2 路由守卫流程

```
请求 → beforeEach
  ├── 检查 Alipay 回调
  ├── 检查 OAuth state
  ├── 检查登录状态 (useAuthStore)
  │   ├── 已登录 → 检查 requiresAdmin
  │   │   ├── 是管理员 → 放行
  │   │   └── 非管理员 → 重定向 /403
  │   └── 未登录 → 重定向 /login
  └── afterEach → 更新 meta、SEO、预加载
```

### 3.3 平台路由

| 平台 | 检测方式 | 路由前缀 | 说明 |
|------|----------|----------|------|
| web | 默认 | / | 桌面端 |
| h5 | UA检测mobile | /m/ | 移动端浏览器 |
| alipay | window.my | / | 支付宝小程序 |
| electron | process.versions.electron | / | 桌面应用 |

---

## 四、状态管理

### 4.1 Pinia（主站）

```
stores/
├── auth/               # 认证状态
│   ├── user.ts         # 用户信息
│   ├── token.ts        # Token管理
│   ├── vip.ts          # VIP状态
│   ├── wallet.ts       # 钱包状态
│   ├── permissions.ts  # 权限状态
│   └── thirdParty.ts   # 第三方登录
├── core/
│   ├── app.ts          # 应用状态（主题/语言/通知）
│   └── index.ts
├── darkMode.ts         # 暗色模式
├── language.ts         # 语言切换
├── loading.ts          # 全局加载
├── font.ts             # 字体状态
└── chatMode.ts         # 聊天模式
```

### 4.2 Vuex（管理端）

```
store/admin/
├── index.ts            # Vuex入口
├── getters.ts          # 全局Getters
└── modules/
    ├── app.ts          # 侧边栏/设备
    ├── dict.ts         # 字典缓存
    ├── user.ts         # 用户认证
    ├── permission.ts   # 动态路由生成
    ├── settings.ts     # 布局设置
    └── tagsView.ts     # 标签页管理
```

---

## 五、API 架构

### 5.1 主站 API（150+模块）

```
api/
├── core/
│   ├── client.ts       # API客户端（Axios封装）
│   ├── base-service.ts # 基础服务类
│   ├── types.ts        # 类型定义
│   └── error-handler.ts
├── admin/              # 管理端API
│   ├── request.ts      # 管理端请求适配器
│   ├── login.ts        # OAuth2.1登录
│   ├── ai/             # AI业务（32个）
│   ├── auth/           # 认证（14个）
│   ├── course/         # 课程（14个）
│   ├── system/         # 系统（10个）
│   ├── monitor/        # 监控（3个）
│   ├── official/       # 官网（4个）
│   └── ...
├── agents.ts           # 智能体
├── ai.ts               # AI功能
├── auth.ts             # 认证
├── payment.ts          # 支付
└── ...
```

### 5.2 后端服务

| 服务 | 地址 | 说明 |
|------|------|------|
| Java后端 | bsm.aizhs.top:8080 | 主API（管理端/认证/支付） |
| Python后端 | zca.aizhs.top | AI服务（对话/生成/模型） |
| 教育平台 | 47.94.40.108:6600 | 课程/教育 |
| 开放API | kou.aizhs.top | 智能体/规则 |

---

## 六、管理端整合架构

### 6.1 整合方式

```
主站 App.vue
├── <Header v-if="!isAdminRoute" />     ← 管理端隐藏主站Header
├── <AIChat v-if="!isAdminRoute" />     ← 管理端隐藏AI聊天
├── <MobileBottomNav v-if="!isAdminRoute" />
│
├── <div v-if="isAdminRoute" class="admin-route-container">
│   └── <RouterView />                 ← 管理端独立容器
│
└── <div v-else class="app-container">
    └── <RouterView />                 ← 主站容器
```

### 6.2 管理端依赖注册（main.ts）

```
1. Vuex Store 注册 (admin-vuex.ts)
2. 全局函数注册 (addDateRange, parseTime, handleTree...)
3. 全局组件注册 (SvgIcon, DictTag, Pagination, RightToolbar)
4. 指令注册 (hasPermi, hasRole, clipboard, dialogDrag)
5. 插件注册 (admin plugins)
6. DictData mixin 注册 (字典数据)
```

### 6.3 SSO 桥接

管理端 `utils/admin/auth.ts` → `getToken()` 读取顺序：
1. OAuth2.1 token（admin专用）
2. **主站 localStorage token**（SSO桥接）
3. Cookie（Admin-Token）

---

## 七、H5移动端架构

### 7.1 布局结构

```
AdminLayoutH5.vue
├── <header class="h5-header">          ← 渐变导航栏
│   ├── 返回按钮 / Logo
│   └── 用户头像（下拉菜单）
├── <main class="h5-content">           ← 内容区（可滚动）
│   └── <RouterView> + <KeepAlive>
└── <nav class="h5-tabbar">             ← 底部TabBar
    ├── 首页 | 用户 | 订单 | 设置
    └── 订单数量角标
```

### 7.2 页面列表

| 路由 | 组件 | 说明 |
|------|------|------|
| /m/admin/dashboard | Dashboard.vue | 统计卡片+快捷操作+订单+通知 |
| /m/admin/users | UserList.vue | 搜索+筛选+用户卡片列表 |
| /m/admin/users/:id | UserDetail.vue | 用户信息+账户+统计 |
| /m/admin/orders | OrderList.vue | 订单统计+筛选+订单卡片 |
| /m/admin/settings | Settings.vue | 用户卡+系统设置+管理功能 |

---

## 八、样式架构

### 8.1 CSS 隔离

```css
/* App.vue */
.admin-route-container {
  isolation: isolate;  /* 创建独立层叠上下文 */
}
```

### 8.2 管理端样式

```
assets/admin/styles/
├── index.scss          # 主入口（导入所有子模块）
├── variables.scss      # CSS变量（颜色/间距/圆角）
├── theme.scss          # 深色/浅色主题（1950+行）
├── sidebar.scss        # 侧边栏样式
├── responsive.scss     # 响应式断点（sm/md/lg/xl）
├── element-ui.scss     # Element Plus覆盖
└── ...
```

### 8.3 响应式断点

| 断点 | 宽度 | 适配 |
|------|------|------|
| xs | <480px | 小屏手机 |
| sm | <640px | 手机 |
| md | <768px | 大手机/小平板 |
| lg | <1024px | 平板 |
| xl | <1280px | 小桌面 |

---

## 九、环境配置

| 变量 | 开发环境 | 生产环境 | 说明 |
|------|----------|----------|------|
| VITE_API_BASE_URL | /api | /api | 主API路径 |
| VITE_ADMIN_API_BASE | /dev-api | bsm.aizhs.top/prod-api | 管理端API |
| VITE_APP_DEMO_MODE | true | false | 演示模式 |
| VITE_ENABLE_MOCK | true | false | Mock数据 |

---

## 十、部署架构

```
Nginx (端口 80/443)
├── /              → dist/web/index.html (SPA)
├── /admin-ruoyi/* → dist/web/index.html (SPA, 管理端)
├── /m/admin/*     → dist/web/index.html (SPA, H5管理端)
├── /api/*         → Java后端 (localhost:3001)
├── /auth/*        → 认证服务 (localhost:3002)
├── /ws/*          → WebSocket (localhost:3001)
├── /assets/*      → 静态资源 (1年缓存)
└── /images/*      → 图片资源 (1年缓存)
```

---

## 十一、构建与开发

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 (端口8888) |
| `npm run build` | 生产构建 → dist/web/ |
| `npm run build:h5` | H5构建 → dist/h5/ |
| `npm run build:wx` | 微信小程序构建 |
| `npm run lint` | ESLint检查 |
| `npm run typecheck` | TypeScript类型检查 |
| `npm run test` | Vitest单元测试 |

---

## 十二、关键文件索引

| 文件 | 说明 |
|------|------|
| `src/main.ts` | 应用入口（所有注册逻辑） |
| `src/App.vue` | 根组件（isAdminRoute条件渲染） |
| `src/router/index.ts` | 路由配置（303条路由） |
| `src/stores/auth/` | 主站认证状态 |
| `src/store/admin/` | 管理端Vuex状态 |
| `src/utils/admin/auth.ts` | SSO桥接（读取主站token） |
| `src/layout-admin/AdminLayout.vue` | 管理端桌面布局 |
| `src/layout-admin/AdminLayoutH5.vue` | 管理端H5布局 |
| `vite.config.ts` | 构建配置（1852行） |
| `nginx-production.conf` | Nginx生产配置 |
| `docker-compose.yml` | Docker编排 |
