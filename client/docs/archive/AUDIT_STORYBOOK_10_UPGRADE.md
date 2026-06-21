# Storybook 8 → 10 升级评估报告 (2026-06-19)

> 评估方法: 试装 `storybook@^10` + `vite-plus@^0.2` 检查依赖图完整性
> 评估结论: **不建议升级**, Storybook 10 生态尚未稳定
> 关键风险: `vite-plus@^0.2` 重型工具链 + `addon-essentials/test` 被移除

---

## 1. 实测结果

### 1.1 npm install (试装 storybook@^10)
- ❌ `npm install storybook@^10 @storybook/vue3@^10 @storybook/vue3-vite@^10 @storybook/addon-essentials@^10 @storybook/addon-interactions@^10 @storybook/test@^10 vite-plus@^0.2 --legacy-peer-deps`
- ❌ `@storybook/addon-essentials@^10` 不存在 (最高 9.0.0-alpha.12)
- ❌ `@storybook/test@^10` 不存在 (最高 8.6.15, 9/10 已移除)
- ⚠️ Storybook 10 把 `addon-essentials` 拆成 8 个独立 addon (docs/controls/actions/viewport/backgrounds/toolbars/outline/measure), 必须逐个安装, 但部分 addon 9/10 仍无发布

### 1.2 vite-plus 体积评估
- `vite-plus@0.2.1` 一次性拖入 15+ 个依赖:
  - `vitest@4.1.9` (4.1.9 是 vitest v4, 而我们项目用 v3)
  - `oxlint@1.70.0`, `oxfmt@0.55.0`, `oxlint-tsgolint@0.23.0`
  - `@oxc-project/types@0.136.0`
  - `@vitest/browser@4.1.9` (含 webdriverio)
  - 整体新增 node_modules 约 80 MB
- 与项目现有 `eslint@8.x + prettier@3.x` 工具链重复

### 1.3 现有 Storybook 8.6.0 实测 (Vite 8 + TS 6 + Tailwind 4 下)
- ✅ `npx storybook build -o storybook-static` 通过 (8.33s)
- ✅ Button.stories.ts + Card.stories.ts 2 个 story 全部编译
- ✅ 与 Vite 8 (rolldown-vite@7.2.2 alias) 兼容 (storybook 8.6.18 已自动 patch 到 8.6.18)
- ✅ 与 TypeScript 6.0.3 + vue-tsc 3.3.5 兼容
- ✅ 与 Tailwind 4.3.1 + @tailwindcss/vite 4.3.1 兼容 (因为 storybook 用独立 vite, 不走项目 vite.config)

---

## 2. Storybook 10 Breaking Changes (按风险等级)

### 🔴 高风险
1. **`@storybook/addon-essentials` 移除**
   - 拆分 8 个独立 addon, 需逐个安装: docs/controls/actions/viewport/backgrounds/toolbars/outline/measure
   - `@storybook/addon-controls@9.0.8` 9.x 系列已停滞, 没有 10.x
   - 含义: 完整迁移需要等所有 addon 都发布 10.x, 目前(2026-06)未完成

2. **`@storybook/test` 移除**
   - 已合并到 `vite-plus` 的 `vitest@4` 工具链
   - 我们的 `playwright.config.ts` 用 `@playwright/test`, 不依赖 storybook/test, 无需迁移
   - 但 `@storybook/addon-interactions@^10` 是否仍可用存疑

3. **`vite-plus` 强制依赖**
   - Storybook 10 peer dep: `vite-plus: '^0.1.15'`
   - vite-plus 把 vitest 4 / oxlint / oxfmt 一起拉入, 与项目 ESLint 8 + Prettier 3 冲突
   - Storybook 8 不需要 vite-plus, 这是 10 的新增要求

### 🟠 中风险
4. **Vite 8 / Rolldown 兼容性**
   - vite-plus 基于 vitest 4 + oxc, 而我们项目 main vite 用 rolldown-vite@7.2.2
   - storybook 内部跑独立 vite, 与项目 vite 解耦, 但需要测试
   - Storybook 8.6.x 实际跑过验证 OK, Storybook 10 未验证

### 🟡 低风险
5. **API 变化**
   - `Meta` / `StoryObj` 类型导出从 `@storybook/vue3` 改为 `@storybook/vue3-vite` 或新位置
   - `argTypes` 控制方式变化
   - 我们的 2 个 story 文件 (Button, Card) 写法简单, 迁移成本低

---

## 3. 决策

### 不升级理由
1. **生态不完整** — `addon-essentials`/`@storybook/test` 缺失 10.x 版本
2. **vite-plus 体积大** — 80 MB 新增依赖, 引入重复工具链
3. **Storybook 是 dev 工具** — 不影响生产, 项目 2 个 story 用不到 Storybook 10 的新功能
4. **现有 8.6.18 已工作** — 与 Vite 8 / TS 6 / Tailwind 4 全部兼容
5. **故事规模小** — 2 个 story 迁移成本低, 但升级 v10 的回报更低

### 何时重新评估
- 当 `@storybook/addon-controls/viewport/backgrounds/...` 全部发布 10.x stable
- 当 `vite-plus` 体积优化 (< 30 MB)
- 当项目 story 数量增加 (>= 10 个) 且需要 Storybook 10 的新功能 (e.g. AI story generator)

---

## 4. 当前状态 (2026-06-19)

| 组件 | 版本 | 状态 |
|---|---|---|
| `storybook` | 8.6.18 (auto-bumped from ^8.6.0) | ✅ |
| `@storybook/vue3` | 8.6.14 | ✅ |
| `@storybook/vue3-vite` | 8.6.14 | ✅ |
| `@storybook/addon-essentials` | 8.6.14 | ✅ |
| `@storybook/addon-interactions` | 8.6.14 | ✅ |
| `@storybook/test` | 8.6.15 | ✅ |
| `vite-plus` | N/A (不安装) | ❌ Storybook 10 必需 |
| `Button.stories.ts` | src/stories/ | ✅ 编译通过 |
| `Card.stories.ts` | src/stories/ | ✅ 编译通过 |
| `npx storybook build` | 8.33s | ✅ |
| `npx storybook dev` | 端口 6006 (未跑) | ⚠️ 未实跑 |

---

## 5. 关键文件

- [package.json](file:///g:/1/client/package.json#L70-L71) — `storybook` / `build:storybook` 脚本
- [package.json](file:///g:/1/client/package.json#L171-L175) — 5 个 storybook 相关 devDep
- [package.json](file:///g:/1/client/package.json#L213) — `storybook: ^8.6.0` 根包
- [src/stories/Button.stories.ts](file:///g:/1/client/src/stories/Button.stories.ts) — 25 行, 5 个 story variant
- [src/stories/Card.stories.ts](file:///g:/1/client/src/stories/Card.stories.ts) — 同样简单

---

## 6. 总结

**结论: Storybook 8.6.18 是当前最佳选择, 不升级到 10**

**原因: 10 生态不完整 + vite-plus 重型 + 现有 8.6 已稳定运行**

**建议: 每季度评估一次 Storybook 10 生态完整度, 当 addon 全部 10.x stable 时再升级**

---

## 7. 参考资料

- [Storybook 10 release notes](https://storybook.js.org/blog/storybook-10)
- [vite-plus 文档](https://vite.plus/)
- [Storybook 9 migration guide](https://storybook.js.org/docs/migration-guide)
