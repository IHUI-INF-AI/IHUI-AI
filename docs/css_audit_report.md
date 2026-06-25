# CSS 违规审计报告 (2026-06-24 封版前)

> 审计范围: `client/src/**` 所有 .vue/.scss/.ts/.css
> 审计依据: [client/.cursorrules](file:///g:/IHUI-AI/client/.cursorrules) 规则 7-18
> 审计工具: Grep 全文搜索

---

## 1. 规则 7 — `text-shadow` 扫描

| 类型 | 数量 | 状态 | 文件 |
|------|------|------|------|
| `text-shadow: none` (显式禁用) | 3 | **合规** (禁用非使用) | `_el-message-global.scss:116,147`, `index.scss:60` |
| `text-shadow: <value>` (实际投影) | 0 | **合规** | — |

**结论**: ✅ 0 违规。`text-shadow: none` 是显式重置 element-plus 默认投影，符合规则 7 精神。

---

## 2. 规则 8 — `box-shadow` 扫描

| 类型 | 数量 | 实际效果 | 状态 |
|------|------|----------|------|
| `box-shadow: 0 X Y Z ...` (实际投影) | **3** | 真投影 | ❌ 违规 |
| `box-shadow: var(--*-shadow)` (token 引用) | 100+ | 值为 `none` (见 CSS_VARIABLES.md:187) | ⚠️ 多余但合规 |
| `box-shadow: none` (显式禁用) | 30+ | 无投影 | ✅ 合规 |

### 2.1 实际投影违规 (3 处)

| 文件 | 行 | 内容 | 建议 |
|------|----|------|------|
| `styles/CSS_VARIABLES.md` | 253 | `box-shadow: 0 2px 8px ...` (示例) | 文档示例, 标注"反例"即可 |
| `utils/themeShortcut.ts` | 119 | `box-shadow: 0 4px 12px var(--color-black-15)` | 改为 `border: 1px solid var(--color-black-15)` 或 `outline` |
| `utils/themeShortcutManager.ts` | 337 | `box-shadow: 0 4px 12px var(--color-black-15)` | 同上 |

**未删除原因**: 封版期改动 utils 风险大; 优先用 stylelint 拦截新增违规, 历史 2 处先标记 TODO.

### 2.2 token 引用多余 (100+ 处)

依据 `styles/CSS_VARIABLES.md:187` 的 2026-06-24 封版统一决策:

> 所有 `--global-box-shadow` 已改为 `none`. 如需为单元素恢复阴影, 请使用 `border` 或 `outline` 替代.

所有 `box-shadow: var(--*-shadow)` (指向 `--global-box-shadow`) 实际值都是 `none`, **不产生视觉投影但仍消耗解析**.

**未删除原因**: 100+ 文件批量改动风险高; 优先用 stylelint 规则统一治理. (后续在 P3 清理期处理)

---

## 3. 规则 11 — `!important` 扫描

| 出现 | 数量 | 状态 |
|------|------|------|
| `.scss/.vue/.ts` 中使用 | **0** | ✅ 合规 |
| 测试断言 "不使用 !important" | 3 | ✅ 合规 (反向校验) |

文件: `views/__tests__/WalletComponents.test.ts:80,86,98` — 是测试反向校验, 非违规.

**结论**: ✅ 0 违规.

---

## 4. 规则 12 — 长链选择器扫描

| 类型 | 数量 | 状态 |
|------|------|------|
| `html.dark body ...` (dark mode reset) | 4 | ✅ 合规 (非修文字色, 规则 16 限定) |
| `.foo.foo` (堆叠类) | 0 | ✅ 合规 |
| `>3 层` 长链 | 0 (但 `dark-mode-override.scss:16-44` 是 60+ 行 2 层链, 边界) | ✅ 合规 |

文件: `styles/dark-mode-override.scss`, `views/Home.vue.styles.scss`, `stores/darkMode.ts`, `styles/CSS_VARIABLES.md` (文档示例)

**结论**: ✅ 0 违规 (规则 16 限定"为修文字色"才禁, 这些是背景 reset).

---

## 5. 规则 15-18 — 明暗模式文字色扫描

| 规则 | 内容 | 扫描结果 |
|------|------|----------|
| 15 | primary 背景上禁 4 个色 token | 最近改动 **1 处违规已修** (Menu.vue:178-179) |
| 16 | 禁 `html.dark` 单点覆盖 | 0 违规 |
| 17 | 用 `var(--color-on-primary)` | Menu.vue:178-179 已用 |
| 18 | element-plus-vars.scss `--el-button-text-color` 指向 #000000 | 全局样式已配置 (非本次审查范围) |

---

## 6. 总结

| 维度 | 违规数 | 风险等级 | 处置策略 |
|------|--------|----------|----------|
| `text-shadow: none` (禁用) | 0 | 无 | — |
| `box-shadow` 实际投影 | 2 | 中 | TODO, 用 stylelint 拦截新增 |
| `box-shadow` token 多余 | 100+ | 低 | TODO, P3 清理期处理 |
| `!important` | 0 | 无 | — |
| 长链选择器 | 0 | 无 | — |
| primary 背景用错色 | 1 (已修) | 无 | ✅ 已修 |

**关键措施**:
1. ✅ Menu.vue:178-179 已修 (本轮)
2. 🆕 加 **stylelint 规则** 自动拦截新增违规 (本轮执行)
3. 🆕 CI 加 **stylelint 检查步骤** (本轮执行)
4. 🆕 修 **.menu-badge / .top-badge** 暗色模式可读性 (本轮执行)

**历史 2 处 `box-shadow` 实际投影** (utils/themeShortcut*) 标记为 TODO, 封版后处理.
**100+ 处 `var(--*-shadow)` 多余** 标记为 TODO, P3 清理期处理.
