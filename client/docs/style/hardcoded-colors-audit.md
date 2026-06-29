# 硬编码颜色全面审计说明

本文档说明项目中硬编码颜色的扫描范围、已处理项与例外项。

## 扫描范围（`npm run check:colors` 已移除，以下为历史扫描范围说明）

| 类型 | 扩展名 | 说明 |
|------|--------|------|
| 组件/视图 | `.vue` | 模板、样式、`<script>` 内字面量 |
| 样式 | `.scss`, `.css` | 所有规则与变量定义 |
| 脚本 | `.ts`, `.js` | 默认值、内联样式、API 参数等 |
| 图标/资源 | `.svg` | `fill`、`stroke`、`stop-color` 等 |
| 文档 | `.md` | 项目内所有 Markdown（含 `src/`、`docs/`、根目录） |
| E2E | `e2e/**` | Playwright 等端到端测试（`.ts`） |

**匹配的色值形式**：`#hex`（3/6/8 位）、`rgb(r,g,b)`、`rgba(r,g,b,a)`、**`rgb(r g b / alpha)`**（现代 CSS）、`hsl`/`hsla`。**注释与文档中的色值也会被扫描**，须改为变量名描述（如 `（--el-fill-color-light）`）。

**仅排除**：`node_modules`。**全项目（含测试、文档）均不允许硬编码颜色**。

---

## 已处理（当前需关注 0）

- **Vue/SCSS/CSS/TS/JS**：硬编码已替换为 `var(--el-*)` 或 `var(--color-*)`、`color-mix(...)`。
- **SVG**：`src/assets` 下已扫描的 SVG 中 `fill`/`stop-color` 等已改为 CSS 变量。
- **文档（.md）**：`src/styles/CSS_VARIABLES.md`、`docs/*.md`、根目录 `CHANGELOG.md` 等中的色值已改为变量名描述（如 `（--el-bg-color）`）。
- **测试**：`src/utils/__tests__/*.test.ts` 中的色值已改为 `var(--el-*)` 或变量名，断言与替换后一致，单元测试通过。
- **E2E**：`e2e/docs-dark-theme.spec.ts` 中原有 `#c9d1d9`/`rgb(201,209,217)` 已改为基于相对亮度的断言（不硬编码具体色值），e2e 已纳入扫描。

---

## 例外与说明

**当前无例外**：全项目（源码、测试、文档）一律不允许硬编码颜色，仅排除 `node_modules`。

- **注释中的色值**：已统一改为变量名描述（如 `（--el-fill-color-light）`）。
- **.md 文档**：替换为注释风格变量名（如 `（--el-bg-color）`），不写 hex/rgba 字面量。
- **测试文件**：断言与输入已使用 `var(--el-*)` 或设计变量，与检查规则一致。

---

## 如何再次全面检查

```bash
# 以下命令已失效：`npm run check:colors` 及 `scripts/check-hardcoded-colors.ts` 已移除
# 如需检查硬编码颜色，建议用 stylelint 或手动搜索 `#`、`rgb(`、`rgba(` 等关键字

# 历史命令（无法执行）
# OUTPUT_ALL_ISSUES=1 npm run check:colors

# 批量替换（依赖上一步生成的 color-issues.json，脚本已失效）
# node scripts/replace-hardcoded-colors.cjs

# 再次验证（已移除）
# npm run check:colors
```

---

## 规则摘要

- **不允许**：任何形式的硬编码颜色（含脚本默认值、var fallback、SCSS/组件变量定义、渐变、SVG 内 fill/stop-color 等）。
- **检查脚本**：`scripts/check-hardcoded-colors.ts`（已移除；历史能力含 3/6/8 位 hex、rgb/rgba、扫描 .vue/.scss/.css/.ts/.js/.svg）。
- **替换脚本**：`scripts/replace-hardcoded-colors.cjs`（按 `color-issues.json` + 内置 fallback 映射替换）。
