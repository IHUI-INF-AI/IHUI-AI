# /goal FINAL 收尾 — STATE

**目标**: 完整的做完所有后续建议工作直到没有建议工作为止（工作收尾）

## 硬性指标

1. ✅ 工作树干净 (无 M / ??)
2. ✅ `npm run typecheck` 通过 (exit 0)
3. ✅ `npm run check:i18n` 通过 (5 语言覆盖)
4. ✅ `npm run check:theme-tokens` 通过 (无硬编码)
5. ✅ `npm run check:contrast` 通过 (4/4)
6. ✅ `npm run scan:knip:hints` 通过 (0 Configuration hints)
7. ✅ `npm run check:port-drift` 通过
8. ✅ `npm run check:line-endings` 通过
9. ✅ 所有新 commit 推送到 origin/main

## 软性指标

- ✅ 临时文件清理 (.trae/, archive/ 加 .gitignore, _tmp_*.mjs 删除)
- ⏳ e2e 完整回归 (业务页面未接入，未跑)

## 收尾 commit 清单 (7 个, 已 push)

| commit | 类型 | 主题 |
|---|---|---|
| f9fad21a | docs(agents) | 补全 AI 浮窗入口唯一性 + 登录按钮设计令牌守门章节 |
| fc5a9729 | chore(governance) | AGENTS.md 章节完整性守门 (pre-commit + CI 双层防护) |
| 57c84444 | chore(husky) | pre-commit 集成 check-agents-md 守门 |
| f84a1c85 | feat(learn) | 证书 PDF 导出/打印功能 (html2canvas + jspdf) |
| cdf1dc0d | feat(api) | 教育模块 C + F API 客户端 |
| b65318a5 | fix(learn) | CertificateDownload.vue 主题色硬编码改 THEME_TOKENS |
| 551f2b27 | feat(edu) | 教育模块 C + F 业务页面组件 + useStudentProfile |
| 493234d2 | fix(edu) | 6 个 edu 组件 + .stylelintrc.json 硬编码颜色改走项目 CSS 变量 |

## Status: DELIVERED
