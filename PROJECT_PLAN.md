# IHUI-AI 项目计划

> 本文件为项目唯一任务计划文档。所有任务计划、进度更新、待办清单只写本文件。

---

## P0 — 已完成

- [x] ✅(2026-07-11) 历史项目迁移完整度回顾（88 个 M 项全部处理，零 ❌）
- [x] ✅(2026-07-11) R65 五大业务功能补建（分片上传 / 实名认证 / 分销统计 / 支付扩展 / Agent 规则）
- [x] ✅(2026-07-11) R66 后端路由补建 5 文件 48 端点（remote / notification / content / organization / ai-image-edit）
- [x] ✅(2026-07-11) R66 前端页面补建 3 个（证书下载 / 用户私信 / 富文本编辑器）
- [x] ✅(2026-07-11) R66 安全配置补建（CSP 5 个安全头到 next.config.ts）
- [x] ✅(2026-07-11) R66 测试文件补建 8 个（5 个 R66 路由 + 3 个 R65 路由），441 个测试全部通过
- [x] ✅(2026-07-11) 数据库迁移执行（0047 upload_sessions + user_auth_info + auto_renew / 0048 certificate 字段）
- [x] ✅(2026-07-11) i18n 翻译键补全（zh-CN 51+150 键 / en/ja/ko/zh-TW 各 150 键同步）
- [x] ✅(2026-07-11) 前端 8 个页面 i18n 接入（全部从硬编码改为 useTranslations）
- [x] ✅(2026-07-11) TypeScript 前后端零错误验证
- [x] ✅(2026-07-11) vitest 441 个测试全部通过
- [x] ✅(2026-07-11) 10 个路由模块注册验证（R65×4 + R66×5 + R67×1）
- [x] ✅(2026-07-11) P0: 数据库迁移日志缺口修复（0047/0048 注册到 _journal.json）
- [x] ✅(2026-07-11) P0: 3 处 Raw SQL 表名不匹配修复（agent_uploads / zhs_developer_link / zhs_category_dictionary）
- [x] ✅(2026-07-11) P0: VIP 购买 mock 模式修复（改为仅开发环境激活）
- [x] ✅(2026-07-11) P0: SMTP 变量名不匹配修复（SMTP_PASSWORD → SMTP_PASS）
- [x] ✅(2026-07-11) P0: 4 个内存数据存储路由改为 DB 持久化（admin-demand-square / admin-faq / admin-zone / ai-user-model-chat）
- [x] ✅(2026-07-11) P1: 创建 apps/web/.env.example（25 个 NEXT_PUBLIC_* + 2 个服务端变量）
- [x] ✅(2026-07-11) P1: Grafana 弱密码修复（ihui-admin → change-me-grafana-password）
- [x] ✅(2026-07-11) P1: 蓝绿部署工作流实现（echo 占位替换为完整蓝绿切换逻辑）
- [x] ✅(2026-07-11) P1: 18 个 stub 管理页面修复（类型安全 + queryKey 统一 + i18n 接入）
- [x] ✅(2026-07-11) P1: 13 处 TODO mutation 修复（Promise.resolve() → 真实 API 调用）
- [x] ✅(2026-07-11) P2: 清理 14 个路由文件中未使用的 `export const prefix` 导出
- [x] ✅(2026-07-11) P2: 补全 apps/api/.env.example 缺失的 48 个环境变量

---

## P1 — 未来需求

- [x] ✅(2026-07-11) i18n 系统完整迁移（4130→5312 键，5 语言同步，80 个管理页面 1181 个硬编码文本提取）
- [x] ✅(2026-07-11) hardcoded-texts.json 管理后台文本 catalog 生成（160KB，1181 个唯一文本，M-82）
- [x] ✅(2026-07-11) html2canvas 依赖安装 + 后端 PDFKit 证书下载端点（POST /certificates/:id/download）
- [x] ✅(2026-07-11) R66 新增 48 端点的带认证集成测试（5 文件 116 测试，API 总测试 557 全部通过）
- [x] ✅(2026-07-11) 18 个 stub 页面对应的后端 API 路由实现验证
- [x] ✅(2026-07-11) 4 个新 DB 持久化路由的 Drizzle schema 定义（当前使用 raw SQL CREATE TABLE）
- [x] ✅(2026-07-11) GitHub Secrets 配置文档（DEPLOY_HOST / DEPLOY_USER / DEPLOY_SSH_PRIVATE_KEY，DEPLOYMENT-R65.md 追加配置章节）
- [x] ✅(2026-07-11) Nginx upstream 蓝绿部署配置文件（deploy/nginx/nginx-blue-green.conf + README.md，端口与 workflow 统一）

---

## P2 — 已知技术债务

- [x] ✅(2026-07-11) M-15 STUB 路由真实化（9 个端点：3 移除做减法 + 4 实现 + 2 TODO 修复）
- [x] ✅(2026-07-11) M-9 运维告警降噪规则（noise-rules.yml Alertmanager 抑制规则已配置，纯配置方案满足需求）
- [x] ✅(2026-07-11) M-11 租户 DB 隔离（基础设施已就绪：withTenant + tenant-db-isolation 插件，当前单租户行级过滤足够，DB schema 隔离待多租户需求激活）
- [x] ✅(2026-07-11) canary-service.ts 评估确认已完全实现 DB 持久化（M-14，无需修改）
- [x] ✅(2026-07-11) stock-service.ts 评估确认已完全实现（M-14，无 STUB/TODO）
- [x] ✅(2026-07-11) 17 个客户端服务文件处理（评估为死代码，按"做减法"原则删除 11 个 service + file-worker + 4 个上传组件）
- [x] ✅(2026-07-11) file-worker.ts 处理（评估为死代码已删除，workspace 页面已简化移除未工作的文件处理逻辑）
- [x] ✅(2026-07-11) 9 张死表彻底清理完成：
  - 3 张补建后端路由激活（sensitive-words: CRUD+内容过滤 / agreements: CRUD+当前协议查询 / exchange-rate: CRUD+汇率换算）
  - 2 张旧 schema 删除+DROP TABLE 迁移（search_hot_keywords→hot_words 替代 / private_letter_sessions+messages→message_private_letter 替代）
  - 4 张之前已 DROP TABLE（app_content→carousels / exchange_rate→zhsExchangeRate / admin_oper_log→audit_logs / search_index→globalSearch 跨表聚合）
- [x] ✅(2026-07-11) 4 处 throw new Error() 改为 error() 包装函数（已确认 0 处残留）
- [x] ✅(2026-07-11) 工作区未跟踪文件审查完成（全部已提交或 .gitignore）
- [x] ✅(2026-07-11) git push 到远程仓库（42 个 commit 全部推送）

---

## 迁移完整度

> 2026-07-11 深度代码审计修正：逐文件比对后发现 14 项存在真实缺口。

| 指标                    | 数值     |
| ----------------------- | -------- |
| M 项追踪总数            | 88       |
| ✅ 已修复/已补建/已替代 | 74       |
| ⚠️ 部分修复/未来需求    | 14       |
| ❌ 未修复               | 0        |
| **综合迁移完整度**      | **~92%** |

### 14 项部分修复/未来需求清单

| M 项 | 标题               | 缺口                                          | 等级 |
| ---- | ------------------ | --------------------------------------------- | ---- |
| M-9  | 运维能力           | 数据回填系统缺失（Saga 已接入 order-service） | 中   |
| M-16 | Web Worker         | file-worker.ts 已删除无替代                   | 低   |
| M-17 | 客户端服务层       | 11 个 service 已删除无替代                    | 低   |
| M-25 | 部署基础设施       | K8s/Helm/ArgoCD 由 Docker Compose 替代        | 中   |
| M-63 | 6 模块端点         | ~22 端点部分缺失                              | 中   |
| M-76 | 清理服务           | uploads/outputs LRU 清理未迁移                | 低   |
| M-77 | 定时任务           | 3 个 cron job 未迁移                          | 低   |
| M-81 | 管理后台页面       | 24 页未覆盖，3 个严重缺失                     | 高   |
| M-84 | 聊天室 WebSocket   | ws-chat 功能范围与旧架构不同                  | 中   |
| M-85 | SRS 媒体服务器     | 零代码，由腾讯云 VOD 替代                     | 中   |
| M-87 | RemoteDeviceByTask | 零代码，无替代方案                            | 中   |
| M-88 | 前端埋点           | 缺 API 调用追踪/点击事件/行为分析             | 低   |
| M-31 | i18n 系统          | 已大幅补全（4130→5312 键）但未达 100%         | 低   |
| M-82 | hardcoded-texts    | 已生成 160KB catalog 但未接入                 | 低   |

### 代码级问题（2 处 mock/placeholder）

- `apps/api/src/routes/ai-user-model-chat.ts:195` — 返回 mock 响应，未接入模型网关
- `apps/api/src/routes/ai-image-edit.ts` — 8 处 placeholder URL，未接入真实 AI 图片 API
- `apps/api/src/services/workspace-ai-service.ts:409` — LLM 思考步骤返回 stub

### 审计报告

- `migration-audit/migration-audit.html` — 可视化深度审计报告（含 M-1~M-88 逐项验证）

---

## 关键参考

- `MIGRATION_GAP_ANALYSIS.md` — 88 项迁移缺口深度报告（只读参考）
- `migration-final-review/migration-final-review.html` — 可视化分析报告
- `DEPLOYMENT-R65.md` — 生产部署清单
- `docs/I18N-COMPLETION-PLAN.md` — i18n 迁移分阶段计划
