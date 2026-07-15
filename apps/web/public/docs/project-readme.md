# 智汇 AI社区 (iHui AI) - 专业的AI工具集成平台

## 项目简介

智汇 AI社区是一个专业的AI工具集成平台，提供丰富的AI能力、智能体管理、内容生成、画廊展示等功能。

## 技术栈

- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite 7
- **UI组件库**: Element Plus + shadcn/ui (Vue)
- **状态管理**: Pinia
- **路由**: Vue Router
- **样式**: SCSS + Tailwind CSS
- **测试**: Vitest + Playwright
- **代码质量**: ESLint + Prettier

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm >= 9.0.0

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

项目将在 `http://127.0.0.1:8888` 启动。官网与「AI世界」（`/ai-world`）由同一 dev 服务提供，**无需单独为 AI世界 启任何 dev 服务**。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录

### 预览生产构建

```bash
npm run preview
```

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

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format

# 类型检查
npm run type-check
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

## 联系方式

如有问题或建议，请联系项目维护团队。
