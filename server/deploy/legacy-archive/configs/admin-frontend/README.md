# admin-frontend 配置归档

## 来源
- 源路径：`H:\历史项目存档\ihui-ai-admin-frontend\`（RuoYi-Cloud v3.6.5 admin 前端）
- 归档时间：2026-06-28（Round 34）
- 归档原因：历史项目 admin 前端的生产/开发环境配置文件，封存追溯用

## 文件清单（16 个）
### 环境配置（.env 系列，加 .legacy 后缀避免冲突）
- `.env.legacy` - 基础环境变量
- `.env.development.legacy` - 开发环境
- `.env.production.legacy` - 生产环境（VITE_APP_BASE_API=/prod-api）
- `.env.staging.legacy` - 预发布环境
- `.env.example.legacy` - 配置示例

### 构建配置
- `vite.config.ts` - Vite 构建配置
- `package.json` - 依赖清单（RuoYi-Cloud v3.6.5）
- `tsconfig.json` / `jsconfig.json` - TypeScript/JS 配置
- `env.d.ts` - 环境变量类型声明
- `.eslintrc-auto-import.json` - ESLint 自动导入配置
- `index.html` - 入口 HTML

### 其他
- `.editorconfig` / `.gitignore` / `.npmrc` - 编辑器/git/npm 配置

## ⚠️ 敏感信息说明
`.env.production.legacy` 可能含生产环境 API 地址，属敏感配置。

## 与新项目的关系
新项目 `g:\IHUI-AI\client\` 已重写 admin 前端（Vue3 + Vite + TS），admin 业务功能在 `client\src\views\admin\` 下。
本归档仅作历史配置追溯，新项目代码不引用这些文件。
