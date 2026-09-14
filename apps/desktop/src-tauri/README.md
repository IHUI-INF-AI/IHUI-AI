# desktop 构建说明（搭 web 便车策略，2026-09-13 W8 立）

## 依赖关系

desktop（Tauri 2）**不独立构建前端**，`tauri.conf.json` 的 `frontendDist` 直接指向 `../../web/out`——即 `apps/web` 的 Next.js 静态导出产物。desktop 与 web 共享同一份前端代码与产物，能力自动对齐（这是有意的单产物分发策略，非配置遗漏）。

## 发布流程

```bash
# 1. 先产出 web 静态导出（必须成功，否则步骤 2 会失败）
pnpm --filter @ihui/web build

# 2. 构建 desktop（beforeBuildCommand 会运行 scripts/ensure-web-out.mjs 校验 web/out 存在）
pnpm --filter @ihui/desktop tauri build
```

## 守门

- `beforeBuildCommand: node scripts/ensure-web-out.mjs`：`web/out` 不存在时立即报错退出，防止打包空产物。
- `device-fingerprint.ts` 已删除（无人调用，不留死抽象）。

## 何时需要重新评估

若未来 desktop 需要脱离 web 独立发版（如桌面专属页面、独立版本节奏），再引入自有产物目录，本 README 与 `ensure-web-out.mjs` 需同步修改。
