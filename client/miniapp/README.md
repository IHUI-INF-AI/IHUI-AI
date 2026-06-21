# 智汇 AI 微信小程序（UniApp）

本目录为 monorepo 中的微信小程序子项目，由原 `Ai-WXMiniVue` 迁入。

## 技术栈

- UniApp（Vue 2.6 + Vuex）
- vue-cli + `@dcloudio/uni`
- 共享 API 配置：`@aizhs/shared-api`（`../packages/shared-api`）
- 共享类型、认证与服务：`@aizhs/shared-types`、`@aizhs/shared-auth`、`@aizhs/shared-services`

## 开发

```bash
# 在仓库根目录
npm run miniapp:install   # 首次安装
npm run dev:mp-weixin     # 监听编译

# 或在本目录
npm install
npm run dev:mp-weixin
```

使用**微信开发者工具**打开：`dist/dev/mp-weixin`（开发）或 `dist/build/mp-weixin`（生产）。

## 环境要求

- **Node.js 18～22**（推荐 20 LTS）。Node 24 可能导致 `build:mp-weixin` 在 split-chunks 阶段失败。

## 注意事项

- 本目录使用 **独立 `node_modules`**（Vue 2），不纳入根 workspaces，避免与官网 Vue 3 冲突
- `src/vendor/shared-api.bundle.js`、`src/vendor/shared-auth.bundle.js` 与 `src/vendor/shared-services.bundle.js` 由根目录 `npm run build:shared` 自动生成，勿手改
- 修改 API 基址/端点时，请改 `packages/shared-api`，不要直接改 `src/config/apiConfig.js` 中的共享常量
- 官网/小程序功能差异记录见：`docs/WEB_MINIAPP_FEATURE_DIFF.md`
- 完整迁移路线图见：`docs/plans/2026-06-10-miniapp-monorepo-migration.md`
