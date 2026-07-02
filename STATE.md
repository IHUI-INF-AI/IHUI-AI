# /goal 后续建议收尾 — STATE

**目标**: 继续按上一轮建议执行直到全部做完收尾，没有后续建议可说为止

## 硬性指标

1. ✅ 5 个 views/edu/member/*.vue 业务页面创建 (Profile/Report/Notes/OfflineRecords/CertUpload)
2. ✅ edu.ts 路由由 notFoundComponent 改为真实组件
3. ✅ e2e/learn-cert-download.spec.ts 创建并通过 (17 源码级 × 2 视口 = 34 passed)
4. ✅ en-US i18n 覆盖率从 1% → 90% (555 模块同步自 en, 1983 keys 缺失)
5. ✅ ts-prune 工具接入 (scan-ts-prune.mjs + npm scripts + knip.json ignore 复用)
6. ✅ 6 项守门通过 (typecheck/i18n/theme-tokens/contrast/knip-hints/port-drift/line-endings/agents-md)
7. ✅ 所有 commit 推送到 origin/main (4 commits)

## 软性指标

- ✅ 业务页面 e2e 回归 (源码级 34 passed, 浏览器级条件跳过)
- ✅ 文档更新 (STATE.md + loop-run-log.md)

## 执行计划

- ✅ 轮 1: 创建 5 个 edu/member/*.vue 业务页面 + 路由接入
- ✅ 轮 2: 创建 e2e/learn-cert-download.spec.ts
- ✅ 轮 3: 批量补全 en-US i18n 翻译键
- ✅ 轮 4: 接入 ts-prune
- ✅ 轮 5: 6 项守门 + push 收尾

## Status: DELIVERED
