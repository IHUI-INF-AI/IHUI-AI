# 前端依赖升级审计 (Vite + Vue 3) - 2026-06-18

> 审计对象: `client/package.json` (主前端 Monorepo) + `client/miniapp/package.json` (uni-app 小程序)
> 审计目标: 找出可升级、需升级、需谨慎升级的依赖, 给出风险评估与行动建议
> 审计方法: 跑 `npm run check:outdated` 脚本 (scripts/check-outdated.mjs) + 分析 API 破坏性变更

---

## 1. 主前端 `client/package.json` - 升级状态总览

`npm run check:outdated` 实测结果: **37 个 outdated, 21 个 major 版本可升级**.

### 1.1 主核心栈 (生产关键)

| 包 | 当前 | 实际最新 | 落差 | 状态 | 备注 |
|---|---|---|---|---|---|
| `vue` | ^3.5.25 | 3.5.38 | 🟢 patch | 保持 | 仅 patch 落后, 安全 |
| `vite` | ^7.3.5 | **8.0.16** | 🔴 major | 评估 | Vite 8 已发布, 需评估 |
| `vue-router` | ^4.6.4 | **5.1.0** | 🔴 major | 评估 | Vue Router 5 已发布 |
| `pinia` | ^3.0.4 | 3.x | ✅ 最新 | 保持 | |
| `vue-i18n` | ^11.4.5 | 11.4.6 | 🟢 patch | 保持 | |
| `typescript` | ^5.9.3 | **6.0.3** | 🔴 major | 评估 | TS 6 已发布 |
| `vue-tsc` | ^3.3.5 | 3.x | ✅ 最新 | 保持 | |
| `@vueuse/core` | ^14.1.0 | 14.3.0 | 🟡 minor | 可升 | 性能优化 |
| `axios` | ^1.7.9 | 1.18.0 | 🟡 minor | 可升 | |
| `vitest` | ^4.0.18 | 4.1.9 | 🟡 minor | 可升 | |
| `@vitejs/plugin-vue` | ^6.0.7 | 6.x | ✅ 最新 | 保持 | |
| `eslint` | ^9.39.4 | **10.5.0** | 🔴 major | 评估 | ESLint 10 已发布 |
| `unplugin-auto-import` | ^20.3.0 | **21.0.0** | 🔴 major | 评估 | |
| `unplugin-vue-components` | ^30.0.0 | **32.1.0** | 🔴 major | 评估 | |
| `tailwindcss` | ^3.4.19 | **4.3.1** | 🔴 major | 暂不升 | Tailwind 4 重构, 需重写 config |

### 1.2 工具链 (开发依赖)

| 包 | 当前 | 实际最新 | 落差 | 状态 |
|---|---|---|---|---|
| `@types/node` | ^24.13.2 | **25.9.3** | 🔴 major | 评估 |
| `puppeteer` | ^24.43.1 | 25.1.0 | 🔴 major | 评估 |
| `jsdom` | ^27.4.0 | 29.1.1 | 🔴 major | 评估 |
| `marked` | ^17.0.6 | 18.0.5 | 🔴 major | 评估 |
| `lint-staged` | ^16.4.0 | 17.0.7 | 🔴 major | 评估 |
| `chromatic` | ^11.0.0 | 17.5.0 | 🔴 major | 评估 |
| `pdfjs-dist` | ^5.7.284 | 6.0.227 | 🔴 major | 评估 |
| `rollup-plugin-visualizer` | ^6.0.11 | 7.0.1 | 🔴 major | 评估 |
| `storybook` | ^8.6.0 | **10.4.6** | 🔴 major | 暂不升 |
| `sharp` | ^0.34.5 | 0.35.1 | 🟡 minor | 可升 |

### 1.3 小版本 (🟡 minor, 安全)

`@vizejs/vite-plugin` 0.9.0 → 0.239.0 (实验性, 0.x 跨度大但内部用 dynamic import)
`markstream-vue` 0.0.3-beta.4 → 1.0.3 (beta 转正, 需逐文件验证)

### 1.4 patch 升级 (🟢, 可批量 bump)

`vue` 3.5.25→3.5.38, `vue-i18n` 11.4.5→11.4.6, `dompurify` 3.4.10→3.4.11, `@types/jszip` 3.4.0→3.4.1, `@storybook/addon-essentials` 8.6.0→8.6.14, `@storybook/addon-interactions` 8.6.0→8.6.14, `@storybook/test` 8.6.0→8.6.15, `@typescript-eslint/*` 8.61.0→8.61.1

**主前端结论: 仍是 Vue 3.5 + Vite 7 主力栈. Vite 8 / TS 6 / Vue Router 5 / ESLint 10 已发布但破坏性大, 不建议快速跟进. patch 升级安全, 可批量 bump.**

---

## 2. 潜在风险点 (主前端)

### 2.1 `vue: 'vue/dist/vue.esm-bundler.js'` alias (vite.config.ts:1047)

```ts
resolve: {
  alias: {
    'vue': 'vue/dist/vue.esm-bundler.js',  // ⚠️ Vue 3.5 已不推荐
  }
}
```

**风险**: Vue 3.4+ 已不需要这个 alias. 官方推荐直接用 `vue` (会自动选 esm-bundler).

**影响**: 当前能正常工作, 但失去了对 production 模板编译器的优化.

**建议**: 评估移除. 需先 typecheck + build 验证.

### 2.2 HMR host 配置错误优先级 (vite.config.ts:1070) ✅ **已修复**

```ts
// 修复前 (有 bug)
host: hmrHost || devHost === '0.0.0.0' ? 'localhost' : devHost,
// 实际解析为: hmrHost || (devHost === '0.0.0.0' ? 'localhost' : devHost)

// 修复后 (2026-06-18)
host: hmrHost || (devHost === '0.0.0.0' ? 'localhost' : devHost),
```

**问题**: JS 运算符优先级. `a || b === c ? d : e` 实际解析为 `a || (b === c ? d : e)`.

**影响**: 当 `hmrHost` 为空字符串/falsy 且 `devHost='0.0.0.0'` 时, 会用 `false`, 实际 HMR 失效.

**状态**: ✅ 已加括号修正, 已 commit 到 vite.config.ts.

### 2.3 `chunkSizeWarningLimit: 3000` (vite.config.ts:1634)

**说明**: 阈值 3MB, 实际项目有 echarts (~1MB) + pdf (~1.5MB) + element-plus (~1MB) 等大 chunk.

**影响**: 阈值高, 不会触发 warning. 不算 bug, 但失去了"体积预警"作用.

**建议**: 维持现状 (项目方主动 manualChunks 拆分已经做得不错).

### 2.4 `force: false` in optimizeDeps (vite.config.ts:1856)

**说明**: 不强制重新构建 deps. 偶尔会导致新增依赖后 dev 启动时未 prebundle.

**建议**: 保留 `force: false` 避免每次启动重新构建.

### 2.5 Vite 7 + Sass + legacy-js-api (vite.config.ts:1797)

```ts
silenceDeprecations: ['legacy-js-api', 'import'],
```

**说明**: 用了 `silenceDeprecations` 抑制 Sass 的 `legacy-js-api` 弃用警告.

**风险**: 这是 Vite 4 → Vite 5 时的 legacy API. Vite 7/8 仍保留向后兼容, 但建议迁移到 modern API.

**建议**: 维持 `silenceDeprecations`, 等下次大改再统一迁移.

### 2.6 Tailwind 3 vs 4 (package.json:212)

**说明**: Tailwind 4 已发布, 完全重构 (CSS-first 配置).

**风险**: 升级破坏性大, 需要重写 config 和大量 utility.

**建议**: **暂不升级**, 待 4.x 生态稳定后单独 PR.

### 2.7 Storybook 8 vs 10 (package.json:168-172, 208)

**说明**: Storybook 10 (2025-Q4 / 2026) 已发布, 破坏性 API 重构.

**建议**: 维持 8.6.0, 待 Storybook 10 生态稳定后评估.

---

## 3. Miniapp `client/miniapp/package.json` - 待升级

`npm run check:outdated:miniapp` 实测待补. (miniapp 需在 dcloudio 兼容下评估)

| 包 | 当前 | 建议 | 风险 |
|---|---|---|---|
| `vue` | ^3.4.0 | ^3.5.x | 🟡 低风险 - 内部升级, API 兼容 |
| `vite` | ^5.4.0 | ^7.x | 🟠 中风险 - 需 @dcloudio/vite-plugin-uni 兼容 |
| `pinia` | ^2.1.0 | ^3.x | 🟠 中风险 - API 微变 (defineStore 返回值) |
| `@dcloudio/*` | 3.0.0-4060620250520001 | 保持 | 🟢 已是 uni-app 3.0.x 最新日期版本 |
| `@dcloudio/types` | ^3.4.0 | ^3.4.8+ | 🟢 低风险 |
| `typescript` | ^5.4.0 | ^5.9.x | 🟢 低风险 |
| `vue-tsc` | ^2.0.0 | ^2.1.x | 🟢 低风险 |

**Miniapp 结论**: **不建议现在升级 vite 5 → 7/8**. 因为:
1. uni-app 的 vite plugin 是 Vite 版本敏感的, 跟着 dcloudio 官方节奏升级最稳
2. dcloudio 当前 release 是 2025-05-20 的 3.0.0-4060620250520001, Vite 还是 5.x
3. 强升 vite 7 会导致 `@dcloudio/vite-plugin-uni` 兼容性问题

**安全升级建议** (Miniapp):
- `vue: ^3.4.0` → `vue: ^3.5.x` (小版本升级, 修复 reactive 性能)
- `pinia: ^2.1.0` → `pinia: ^2.3.x` (小版本, 修复)
- `typescript: ^5.4.0` → `typescript: ^5.9.x`
- `vue-tsc: ^2.0.0` → `vue-tsc: ^2.1.x`

**不建议升级**:
- `vite: ^5.4.0` → `vite: ^7.x/^8.x` (需等 dcloudio 官方跟进)
- `pinia: ^2.1.0` → `pinia: ^3.x` (uni-app 3.0.x 模板可能未适配)

---

## 4. 行动建议 (TODO 5 收尾)

### ✅ 已完成 (2026-06-18)
1. **修正 HMR host 优先级 bug** (vite.config.ts:1070) — 加括号
2. **新建 `client/scripts/check-outdated.mjs`** — 自动化过期检测
3. **在 client/package.json 添加 3 个脚本命令** (`check:outdated`, `:miniapp`, `:strict`)
4. **写本审计报告** (client/docs/AUDIT_VITE_VUE_UPGRADE.md)

### 立即可做
1. **批量 bump patch 升级** (7 个包, 风险极低)
   - vue 3.5.25→3.5.38
   - vue-i18n 11.4.5→11.4.6
   - dompurify 3.4.10→3.4.11
   - @types/jszip 3.4.0→3.4.1
   - @typescript-eslint/* 8.61.0→8.61.1
2. **跑 `npm run check:outdated` 进 CI** — 周级别监控

### 短期 (1-2 周)
1. Miniapp 升级 vue / pinia / typescript 到 5.9 / vue-tsc 2.1
2. 评估 `@types/node 24→25` 升级 (Node 25 已发布, 我们的 engines 是 `>=20.0.0`)

### 中期 (1-2 月)
1. 评估 Tailwind 3 → 4 升级 (需重写 config)
2. 评估 Storybook 8 → 10 升级
3. 评估 Vite 7 → 8 升级 (Vite 8 已发布, 需先在 preview branch 试)

### 长期 (3 月+)
1. 评估 miniapp vite 5 → 7/8 (需等 dcloudio 官方兼容)
2. 评估 `vue/dist/vue.esm-bundler.js` alias 移除
3. 评估 Vue Router 4 → 5 升级
4. 评估 ESLint 9 → 10 升级
5. 评估 TypeScript 5 → 6 升级

---

## 5. 关键文件参考

- 主前端: [client/package.json](file:///g:/1/client/package.json)
- 主前端 vite: [client/vite.config.ts](file:///g:/1/client/vite.config.ts)
- Miniapp: [client/miniapp/package.json](file:///g:/1/client/miniapp/package.json)
- 审计脚本: [client/scripts/check-outdated.mjs](file:///g:/1/client/scripts/check-outdated.mjs)
- 本报告: [client/docs/AUDIT_VITE_VUE_UPGRADE.md](file:///g:/1/client/docs/AUDIT_VITE_VUE_UPGRADE.md)

---

## 6. 总结

**主前端 (client/)**:
- ✅ Vite 7 + Vue 3.5 + TS 5.9 仍是主流稳态栈 (Vite 8 / TS 6 刚发布, 暂不跟)
- ✅ HMR host bug 已修
- ✅ check:outdated 脚本已就位, 可在 CI 跑
- ⚠️ 21 个 major 可升级, 但破坏性大, 建议分批评估
- 🟢 7 个 patch 升级可批量 bump

**Miniapp (client/miniapp/)**:
- 🟡 仍是 Vite 5 + Vue 3.4 (因 uni-app 3.0.x 兼容性)
- 🟡 建议小版本升级 vue 3.5 / pinia 2.3 / typescript 5.9
- 🔴 不建议大升级 vite 5 → 7/8 (需 dcloudio 官方跟进)

