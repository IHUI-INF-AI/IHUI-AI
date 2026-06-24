# Token 迁移映射表

> 本文档记录项目中 CSS 变量（设计 token）的历史迁移记录，供开发者排查旧 token 坑、避免重复踩雷。
>
> 权威变更日志在 [_global-tokens.scss](../../src/styles/_global-tokens.scss) 顶部注释，本文档是对其的结构化整理与补充说明。

---

## 一、已删除 token（死代码清理）

### 1.1 2026-06-19 删除的 9 个死代码 token

| 已删除 token | 替代方案 | 删除原因 |
|---|---|---|
| `--bs-font-sans-serif` | `--global-font-family` | Bootstrap 遗留，项目已迁移到 HarmonyOS Sans SC |
| `--theme-toggle-bg-color` | `--el-fill-color-light` | 主题切换按钮专用变量，未在任何组件中引用 |
| `--theme-toggle-focus-shadow` | `--global-box-shadow` | 主题切换按钮 focus 阴影，统一使用全局阴影 |
| `--global-header-top-gap` | `--global-header-height` | 顶部间距与高度合并，避免重复定义 |
| `--shadow-rgb` | 直接使用 `--global-box-shadow` | 阴影 RGB 分量，无组件引用 |
| `--color-white-0` | `#ffffff` 或 `--el-bg-color` | 纯白别名，直接使用字面量或语义化变量 |
| `--color-white-96` | `color-mix(in srgb, #fff 96%, transparent)` | 半透明白色别名，使用 color-mix 替代 |
| `--color-red-ff4d4f` | `--el-color-danger` | 红色别名，统一使用 Element Plus 语义化变量 |
| `--z-base` | 直接使用具体 z-index 值 | 基础 z-index 别名，无组件引用 |

### 1.2 2026-06-19 删除的 13 个冗余 shadow 别名

| 已删除 token | 替代方案 |
|---|---|
| `--shadow-xs` | `var(--global-box-shadow)` |
| `--shadow-sm` | `var(--global-box-shadow)` |
| `--shadow-md` | `var(--global-box-shadow)` |
| `--shadow-lg` | `var(--global-box-shadow)` |
| `--shadow-xl` | `var(--global-box-shadow)` |
| `--shadow-2xl` | `var(--global-box-shadow)` |
| `--shadow-primary` | `var(--global-box-shadow)` |
| `--shadow-primary-hover` | `var(--global-box-shadow)` |
| `--shadow-success` | `var(--global-box-shadow)` |
| `--shadow-warning` | `var(--global-box-shadow)` |
| `--shadow-danger` | `var(--global-box-shadow)` |
| `--shadow-inner` | `var(--global-box-shadow)` |

**统一规则**：全站投影统一使用 `var(--global-box-shadow)`，不再按尺寸/语义创建别名。

### 1.3 2026-06-19 删除的 2 个未使用 --el-box-shadow 变体

| 已删除 token | 删除原因 |
|---|---|
| `--el-box-shadow-lighter` | Element Plus 组件未引用 |
| `--el-box-shadow-darker` | Element Plus 组件未引用 |

---

## 二、硬编码颜色迁移映射

> 以下映射来自 [css-variables-guide.md](./css-variables-guide.md) 第 9.1 节，是历史迁移的权威参考。

| 硬编码颜色 | 替换为 |
|---|---|
| `#000000` / `#000` | `var(--el-text-color-primary)` |
| `#333333` / `#333` | `var(--el-text-color-regular)` |
| `#666666` / `#666` | `var(--el-text-color-secondary)` |
| `#999999` / `#999` | `var(--el-text-color-placeholder)` |
| `#ffffff` / `#fff`（背景） | `var(--el-bg-color)` |
| `#f5f7fa` / `#f7f8fa`（页面背景） | `var(--el-bg-color-page)` |
| `#e4e7ed`（边框） | `var(--el-border-color-lighter)` |
| `#409eff`（主色） | `var(--el-color-primary)` |
| `#67c23a`（成功色） | `var(--el-color-success)` |
| `#e6a23c`（警告色） | `var(--el-color-warning)` |
| `#f56c6c`（危险色） | `var(--el-color-danger)` |

---

## 三、语义化抽象层（--app-* token）

> 2026-06-19 新增，推荐新组件优先使用。

| 语义化 token | 映射目标 | 用途 |
|---|---|---|
| `--app-surface-1` | `var(--el-bg-color-page)` | 页面主背景 |
| `--app-surface-2` | `var(--el-bg-color)` | 容器背景 |
| `--app-overlay` | `var(--el-bg-color)` | 遮罩层背景 |
| `--app-text-primary` | `var(--el-text-color-primary)` | 主要文字 |
| `--app-text-secondary` | `var(--el-text-color-regular)` | 次要文字 |
| `--app-text-muted` | `var(--el-text-color-secondary)` | 弱化文字 |
| `--app-divider` | `var(--el-border-color)` | 分割线 |

**优势**：更换 UI 框架时只需修改 `--app-*` 定义，无需改动组件代码。

---

## 四、Token 弃用流程

当需要弃用某个 token 时，按以下步骤执行：

1. 在 token 定义行添加弃用标记：
   ```scss
   --old-token: #fff; /* @deprecated 已被 --app-surface-1 替代 | 删除日期 2026-07-01 */
   ```
2. 运行 `npm run tokens:deprecated` 检查弃用 token 的使用情况
3. 迁移所有使用该 token 的组件代码
4. 迁移完成后，等待删除日期到达后删除 token 定义
5. 在 [_global-tokens.scss](../../src/styles/_global-tokens.scss) 顶部的 Token 变更日志中登记删除记录

**注意**：删除日期建议设置为弃用标记添加后 2 周，给迁移留足时间。

---

## 五、当前未使用 token 白名单

> 2026-06-19 新增白名单机制，以下 token 不计入死代码统计。

- 8 个框架内部 token（Element Plus 运行时引用，静态分析无法检测）
- 2 个预留 token（为未来功能预留，暂未使用）

白名单定义在 `tokens:check` 脚本中，阈值为 12（白名单 10 个不计）。

---

## 六、相关工具与脚本

| 命令 | 用途 | 状态 |
|---|---|---|
| `npm run tokens:naming` | token 命名规范检查 | ✅ 可用 |
| `npm run tokens:check` | CI 阈值检查（阈值 12） | ✅ 可用 |
| `npm run tokens:autocompletion` | CSS 变量自动补全 | ✅ 可用 |
| `npm run tokens:docs` | token 文档自动生成 | ✅ 可用 |
| `npm run tokens:dark-mode` | 暗色模式覆盖检查 | ✅ 可用 |
| `npm run tokens:deprecated` | 弃用 token 检查 | ✅ 可用 |
| `npm run tokens:record` | token 使用趋势记录 | ✅ 可用 |
| `npm run tokens:trend` | token 使用趋势监控 | ✅ 可用 |
| `npm run tokens:usage` | token 使用统计 | ⚠️ 脚本文件缺失（token-usage.cjs 不存在） |
| `npm run check:colors` | 硬编码颜色检查 | ⚠️ 脚本文件缺失（check-hardcoded-colors.ts 不存在） |
| `npm run style:audit` | 样式审计 | ⚠️ 脚本文件缺失（style-audit.cjs 不存在） |

---

## 七、相关文档

- [CSS 变量命名规范](./css-variables-guide.md) — 命名约定、层级结构、迁移指南
- [样式迁移指南](./STYLE_MIGRATION_GUIDE.md) — 旧样式迁移到模块化结构的步骤
- [样式维护指南](./STYLE_MAINTENANCE_GUIDE.md) — 日常样式维护检查清单
- [设计审计报告](./design-audit-report.md) — 历史审计结果与改进记录
- [硬编码颜色审计](./hardcoded-colors-audit.md) — 硬编码颜色清理记录
- [SHADOW_AND_BORDER_RULES.md](../SHADOW_AND_BORDER_RULES.md) — 投影与描边规则
