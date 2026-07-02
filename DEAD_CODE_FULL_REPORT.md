# 死代码完整扫描报告

> 生成时间: 2026-07-02T14:20:23.394Z
> 扫描范围: src/views + src/components + src/utils
> 判定标准: 文件路径 + 组件名在 src/ 全局无 import/require/标签引用

## src/views/ — 0/320 未引用

✅ 全部文件都有引用

## src/components/ — 18/318 未引用

| # | 路径 | 大小 |
|---|------|------|
| 1 | `components/api/ApiMethodSearch.vue` | 5.2 KB |
| 2 | `components/api/AppCard.vue` | 4.6 KB |
| 3 | `components/api/BillingRecordCard.vue` | 4.2 KB |
| 4 | `components/api/GroupCard.vue` | 5.2 KB |
| 5 | `components/api/GroupComparisonTable.vue` | 3.7 KB |
| 6 | `components/api/LogDetailDialog.vue` | 8.9 KB |
| 7 | `components/api/PackageCard.vue` | 6.2 KB |
| 8 | `components/api/ProductAdvantages.vue` | 4.3 KB |
| 9 | `components/api/RequestBuilder.vue` | 4.2 KB |
| 10 | `components/api/ResponseViewer.vue` | 3.7 KB |
| 11 | `components/api/TicketCard.vue` | 5.0 KB |
| 12 | `components/api/UsageTopStats.vue` | 9.4 KB |
| 13 | `components/common/NativeEmpty.vue` | 3.2 KB |
| 14 | `components/common/PageSkeleton.vue` | 3.8 KB |
| 15 | `components/dev/DevThemeSwitcher.vue` | 6.7 KB |
| 16 | `components/settings/ThemeSettingsPanel.vue` | 22.8 KB |
| 17 | `components/settings/ThemeTransitionPreview.vue` | 11.9 KB |
| 18 | `components/ui/CustomCheckbox.vue` | 0.7 KB |

## src/utils/ — 1/117 未引用

| # | 路径 | 大小 |
|---|------|------|
| 1 | `utils/errorReport.ts` | 2.2 KB |

---
## 总计
- 扫描文件: 755
- 未引用: 19
- 已引用: 736

## 已知限制
- 动态 import (如 `import(`@/views/${name}`)`) 无法被静态扫描
- 通过 index.ts barrel re-export 的 utils 函数可能误报
- components 子组件通过 `<ComponentName />` 引用, 已搜标签名但可能有命名变体
- e2e 测试中的引用不在 src/ 范围内, 可能误报