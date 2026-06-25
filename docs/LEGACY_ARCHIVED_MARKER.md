# 历史项目封存标记

> 本文件标记 `H:\历史项目存档` 已完成 100% 迁移至 `g:\IHUI-AI`，可安全归档或删除。

## 封存信息

- **封存时间**：2026-06-26
- **迁移率**：100%（1536/1536 端点）
- **封存确认报告**：docs/LEGACY_ARCHIVE_CONFIRMATION.md
- **端点映射对照表**：docs/JAVA_TO_PYTHON_ENDPOINT_MAPPING.md

## 迁移完成清单

| 项目 | Java 端点 | Python 迁移 | 状态 |
|---|---|---|---|
| 教育微服务（22 个） | 671 | 671 | ✅ 100% |
| ZHS_Server_java 单体 | 176 | 176 | ✅ 100% |
| ai-smart-society-java | 689 | 689 | ✅ 100% |
| **合计** | **1536** | **1536** | **✅ 100%** |

## 处置建议

历史项目 `H:\历史项目存档` 可安全执行以下操作之一：
1. **归档**：移动到冷存储或备份磁盘
2. **压缩**：打包为 zip 存放
3. **删除**：确认所有功能已迁移后直接删除

所有代码、配置、SQL、文档、凭证均已迁移至 g:\IHUI-AI。

## 补齐记录（2026-06-26）

两批合计补齐 115 个端点：
- 第一批（A+B）：50 端点（10 个 Controller）
- 第二批（C+D）：65 端点（4 个新文件 + 16 个 Controller 补齐）

新增文件：
- server/app/api/v1/finance/power_purchase_rule.py
- server/app/api/v1/finance/developer_fund_logs.py
- server/app/api/v1/finance/fund_info.py
- server/app/api/v1/user/user_sys_link.py
- server/app/api/v1/agents/category_link.py
- server/app/api/v1/courses/popular_courses.py
- server/app/api/v1/courses/course_temp.py
- server/app/api/v1/courses/video_temp.py
- server/app/api/v1/system/dictionary.py
- server/app/api/v1/legacy_supplement.py
- server/migrations/version_20260626_add_missing_tables.sql

新增模型：
- PowerPurchaseRule (power_purchase_rule)
- ZhsDeveloperFundLogs (zhs_developer_fund_logs)
- ZhsUserSysLink (zhs_user_sys_link)

修复：
- legacy_compat.py 清空 415 个假 stub
- learn_legacy.py 修复 ChapterIdReq ForwardRef 解析问题
