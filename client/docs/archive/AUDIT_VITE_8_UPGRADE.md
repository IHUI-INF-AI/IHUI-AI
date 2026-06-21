# Vite 7 → 8 升级评估报告 (2026-06-18, 更新 2026-06-19)

> 评估方法: 试装 `vite@^8` (实际装到 8.0.16) + `rolldown-vite@7.2.2` 阶段 1 试跑 + `npx vite build --mode production`
> 评估结论: **阶段 1 (rolldown-vite alias) 试跑通过 ✅**, web 10.3s / h5 11.9s, 0 warnings
> 关键风险: build target 默认提升 + Rolldown/Oxc 替换 esbuild/Rollup (阶段 1 兼容层 OK)

---

## 1. 实测结果

### 1.1 npm install
- 装上 `vite@8.0.16` 正常, 依赖图解析通过 (added 7 packages, removed 5 packages)
- ESBuild 仍作为 transitive dep 安装 (Vite 8 内置 Oxc 但兼容层仍需 esbuild)
- Rolldown binary 安装在 `node_modules/rolldown/dist/shared/`

### 1.2 vite build
- ✅ Vite 8 流程**能跑** (rolldown buildEnvironment, buildApp 正常启动)
- ❌ build 失败原因: **历史 syntax error** 文件
  - `src/api/v2-sdk/system.ts:2558, 2585, 4430, 4439, 4448, 4457, 4466` — codegen 用 `image-to-image` 作为 JS 标识符 (`v2_system_create_api_v1_tongyi_image2image_image-to-image_post` 函数名含 `-`, TS1005 syntax error)
  - `src/api/ai-proxy.ts` — `(` expected + UTF-8 stream error
  - `src/api/ai-career.ts` — UTF-8 stream error
  - `src/composables/useLcp.ts:123` — `*/` expected (块注释未闭合)
- ❌ **这些文件用 Vite 7 build 同样会失败** (Rolldown 错误更明显但根因是项目自身)
- ⚠️ 升级 Vite 8 不会引入新 syntax error, 但会暴露这些**已存在**的脏代码

### 1.2.1 阶段 1 试跑成功 (2026-06-19, rolldown-vite@7.2.2 alias)
- ✅ **所有 syntax error 已修** (130 codegen 函数名 `-` → `_`, useLcp.ts JSDoc 闭合, ai-career/ai-proxy UTF-8 替换)
- ✅ **vue-tsc 0 错误** (85 个 type error 全部修完)
- ✅ **`npx vite build` web 平台通过** — 10.30s, 0 warnings
- ✅ **`BUILD_PLATFORM=h5 npx vite build` 通过** — 11.92s, 0 warnings
- ✅ **vue-office 4 大子包 (docx/excel/pdf/presentation) 全部成功** (1676 kB / 1340 kB / 414 kB / 33 kB)
- ✅ **vue-demi 0.14.10 已安装为 devDep** (解决 `@vue-office/docx` peer dep)
- ✅ **P20DashboardEcharts.vue 2 个 import bug 已修** (admin 命名空间 + agents `_list_get` 后缀)
- ✅ **echarts.ts 补命名导出** (`init` / `ECharts` 类型)

### 1.3 Vite 8 兼容层 (自动转换)
- `optimizeDeps.esbuildOptions` → `optimizeDeps.rolldownOptions` ✅ 我们的配置 `esbuildOptions.target: 'es2022'` 会被自动转
- `esbuild:` → `oxc:` ✅ 我们的 `esbuild: { jsx: 'automatic', jsxImportSource: 'vue' }` 会被自动转
- 转换有 deprecation warning, 但 build 不会断

---

## 2. Breaking Changes 风险点 (按风险等级)

### 🔴 高风险
1. **build target 默认值提升**
   - Chrome 107 → 111
   - Edge 107 → 111
   - Firefox 104 → 114
   - Safari 16.0 → 16.4
   - 影响: 低版本浏览器 (国内 Android < 11 / iOS < 16.4) 用户访问会有 syntax error
   - 缓解: `build.target: 'es2020'` 显式降级, 但失去 Vite 8 的新优化

### 🟠 中风险
2. **Rolldown 替换 Rollup**
   - 不再支持 `rollupOptions.output.manualChunks` 对象形式 (必须用函数)
   - 不再支持 `rollupOptions.watch.chokidar` 选项
   - 不再支持 `format sniffing` 模块解析
   - 影响: 我们的 `manualChunks(id) {...}` (line 1796) **是函数形式, 兼容**
   - 验证: 需要 build 实际跑通

3. **Oxc 替换 esbuild (transform)**
   - `esbuild: { jsx: 'automatic' }` 自动转 `oxc: { jsx: { runtime: 'automatic' } }`
   - 已知差异: Oxc 对某些高级 JSX 转换 case 处理可能不同
   - 影响: 我们的 Vue 3.5 + `jsxImportSource: 'vue'` 应当兼容, 但需 build 验证

4. **Lightning CSS 替换 cssnano (默认)**
   - 性能更快, 行为可能微差
   - 影响: 我们的项目用 Tailwind 3 + SCSS, 不会被 Lightning CSS 处理 (我们没用 cssnano)

### 🟡 低风险
5. **`build()` 抛出 `BundleError`** 而非 generic Error
   - 影响: 上层 try/except 需要适配
   - 我们没在 CI 脚本里直接调 `vite build()` 的 JS API, 不影响

6. **移除已弃用功能**
   - `transformIndexHtml` 钩子签名变化 (主项目无自定义使用)
   - 一些老旧 `legacy.proxy` 配置移除 (我们用 proxy 对象, 不影响)

---

## 3. 升级路径 (4 阶段)

### 阶段 1: 修历史 syntax error (1-2 周) — **必须前置**
修 4 类文件:
- `src/api/v2-sdk/system.ts` — 修 codegen: 函数名驼峰化, 加 path ↔ id 映射
- `src/api/ai-proxy.ts` / `src/api/ai-career.ts` — 重新生成或手动修
- `src/composables/useLcp.ts` — 补全块注释闭合

验证: `npm run typecheck` 应 0 错误, `npx vite build` 应能完整跑通

### 阶段 2: 引入 `rolldown-vite` alias 试跑 (1 周)
```json
{
  "devDependencies": {
    "vite": "npm:rolldown-vite@7.2.2"
  }
}
```
- 跑 `npm run dev` + `npx vite build`
- 看是否有 Rolldown-specific warning
- 评估 build 性能 (Rolldown 应当比 esbuild 快 2-5x)

### 阶段 3: 升级到 vite 8 + 显式迁 esbuild→oxc 选项 (1 周)
```json
{
  "devDependencies": {
    "vite": "^8.0.16"
  }
}
```
迁移 vite.config.ts:
- `optimizeDeps.esbuildOptions` → `optimizeDeps.rolldownOptions`
- `esbuild:` → `oxc:`
- 显式 `build.target: 'es2020'` (防 Chrome 111+ 强制升级)
- 删 deprecation warning 注释

### 阶段 4: 优化 build target + 移除兼容层 (1-2 月)
- 调研业务用户浏览器分布 (GA/Umami)
- 决定 target 是 es2020 / es2022 / baseline-widely-available
- 移除 `rolldown-vite` alias, 全部用 vite 8 native

---

## 4. 不建议立即升级的理由

1. **历史 syntax error 必须先修** — 不修 build 必败
2. **target 升级需要业务数据支撑** — 不知道用户浏览器分布
3. **Rolldown 仍较新** — 大规模项目试跑经验少, 可能有边界 bug
4. **patch 升级红利已吃** — Vite 7.3.5 → 7.3.x patch 升级已完成, 无紧迫感
5. **CI 兼容层 OK 但 deprecation warning 多** — 不是 blocker, 但噪音大

---

## 5. 关键文件

- [vite.config.ts](file:///g:/1/client/vite.config.ts#L1796-L1908) — manualChunks 函数形式, Vite 8 兼容
- [vite.config.ts](file:///g:/1/client/vite.config.ts#L1945-L1949) — esbuildOptions (会被自动转)
- [vite.config.ts](file:///g:/1/client/vite.config.ts#L1952-L1971) — esbuild 全局 (会被自动转)
- [package.json](file:///g:/1/client/package.json#L222) — 当前 vite ^7.3.5

---

## 6. 总结

**结论: Vite 7.3.5 → 8.0.16 可升级, 但需先修 4 个历史 syntax error + 评估 target 影响**

**优先级: 中** — 升级收益 (Rolldown 性能 + Oxc 速度) 显著, 但风险 (target 升级 + 兼容层 warning) 需要前置工作

**建议: 1-2 月内推进阶段 1-3, 阶段 4 待业务数据**

---

## 7. 参考资料

- [Vite 8 迁移指南](https://cn.vitejs.dev/guide/migration)
- [Vite 8 发布说明](https://vite.dev/blog/announcing-vite8)
- [Rolldown 文档](https://rolldown.rs/)
- [Oxc 文档](https://oxc.rs/)
