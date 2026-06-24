# edu-service-mapping · 23 服务 → IHUI-AI 域映射表

> **生成时间**:2026-06-24
> **状态**:阶段 A 初版(对照迁移清单)

## 标记规则

- 🆕 **新建**:IHUI-AI 中**不存在**同名域,需要从零新建
- 🔧 **增强**:IHUI-AI 中**已存在**同名或近似域,只做差异增强
- 📦 **冻结**:仅放 `storage/edu-assets/java-source/`,不迁
- ⚠️ **冲突**:需特殊处理(命名冲突、跨域依赖)

## 23 微服务映射矩阵

| # | Java 服务(edu) | 端口 | 业务一句话 | IHUI-AI 对应位置 | 标记 |
|---:|---|---:|---|---|:-:|
| 1 | `ihui-ai-edu-gateway-service` | 6600 | 路由网关(23 服务统一入口) | `nginx-production.conf` + `app/main.py` | 📦 冻结(网关模型取消,路由改 Nginx + FastAPI 中间件) |
| 2 | `ihui-ai-edu-auth-service` | 6601 | 鉴权 + SSO(微信/钉钉/飞书/企业微信/keypair) | `app/api/v1/auth/`(19 文件已存在)+ `app/security.py` | 🔧 增强(补 SSO 登录回调) |
| 3 | `ihui-ai-edu-member-service` | 6602 | 会员(学员/家长/学号档案) | `app/api/v1/member/` 已存在 | 🔧 增强(补家长绑定/学号字段) |
| 4 | `ihui-ai-edu-usercenter-service` | 6603 | 用户中心 | `app/api/v1/user/` 已存在 | 🔧 增强 |
| 5 | `ihui-ai-edu-setting-service` | 6604 | 系统设置 | `app/api/v1/system/setting/` 已存在 | 🔧 增强(补课程分类/学制/学期) |
| 6 | `ihui-ai-edu-resource-service` | 6605 | 教学资源(课件/视频/教辅) | `app/api/v1/resource/` 已存在 | 🔧 增强 |
| 7 | `ihui-ai-edu-content-service` | 6606 | 内容管理(CMS) | `app/api/v1/content/` 已存在 | 🔧 增强(edu 课程内容) |
| 8 | `ihui-ai-edu-learn-service` | 6607 | 学习(课程章节/作业/证书/学习地图) | `app/api/v1/learn/`(16 子模块已存在)| 🔧 增强(homework/rate/certificate/map 补) |
| 9 | `ihui-ai-edu-live-service` | 6608 | 直播(课表/回放/考勤) | `app/api/v1/live/` 已存在 | 🔧 增强(edu 直播特性) |
| 10 | `ihui-ai-edu-exam-service` | 6609 | 考试(试卷/题库/错题本) | `app/api/v1/exam/` 已存在 | 🔧 增强 |
| 11 | `ihui-ai-edu-ask-service` | 6610 | 答疑(师生问答) | ❌ 不存在 | 🆕 新建 |
| 12 | `ihui-ai-edu-circle-service` | 6611 | 班级圈(社区/动态) | `app/api/v1/community/` 存在但非 edu 语义 | 🆕 新建 edu 版(`/api/v1/edu/circle`) |
| 13 | `ihui-ai-edu-behavior-service` | 6612 | 学习行为分析 | `app/api/v1/behavior/` 已存在 | 🔧 增强(观看时长/答题路径) |
| 14 | `ihui-ai-edu-pay-service` | 6613 | 支付(学费分期/课程包) | `app/api/v1/payments/` 已存在 | 🔧 增强(edu 学费分期) |
| 15 | `ihui-ai-edu-point-service` | 6614 | 积分(学分兑换) | `app/api/v1/point/` 已存在 | 🔧 增强(学分兑换) |
| 16 | `ihui-ai-edu-message-service` | 6615 | 消息(站内信) | `app/api/v1/message/` 已存在 | 🔧 增强 |
| 17 | `ihui-ai-edu-notification-service` | 6616 | 通知(作业/考试提醒) | `app/api/v1/notification/` 已存在 | 🔧 增强(edu 通知模板) |
| 18 | `ihui-ai-edu-oss-service` | 6617 | 对象存储(课件直传) | `app/utils/minio_util.py` + `app/services/storage_service.py` 已存在 | 🔧 增强(分片上传) |
| 19 | `ihui-ai-edu-search-service` | 6618 | 搜索(走 ES) | `app/api/v1/search/`(走 PG 已存在)+ `storage/edu-assets/elasticsearch-7.17.16/` | 🔧 增强(接入 ES 课程索引) |
| 20 | `ihui-ai-edu-schedule-service` | 6619 | 排课 | `app/tasks/`(APScheduler 已存在)| 🔧 增强(edu 排课 job) |
| 21 | `ihui-ai-edu-visit-tracking-service` | 6620 | 访问埋点 | `app/api/v1/visit/` 已存在 | 🔧 增强(edu 学习路径埋点) |
| 22 | `ihui-ai-edu-order-service` | 6621 | 订单(课程订单) | `app/api/v1/orders.py` 已存在 | 🔧 增强(edu 学习卡订单) |

## 统计

- 🆕 新建:**2 域**(ask + circle-edu)
- 🔧 增强:**21 域**(在现有 Python 模块中增量补)
- 📦 冻结:**1 域**(gateway)

## 移交包(ljd-交接文件)处理

| 项目 | 类型 | 处理 |
|---|---|---|
| `ai-smart-society-java` | Java(RuoYi-Vue-Plus)| 📦 冻结于 `storage/edu-assets/handoff/`,不参与迁移 |
| `ZHS_Server_java` | Java | 📦 冻结,仅 reference |
| `coze_zhs_py` | Python | 📦 冻结(IHUI-AI 已有 `app/api/v1/coze/` 12 文件,远优于该 Python 项目) |
| `service/`(Java 23 服务冻结版)| Java | 📦 冻结,内容与 `edu/service/service` 一致,作为老版本备份 |
| `service_2/`(Java 23 服务冻结版)| Java | 📦 冻结,与 `service/` 几乎一致(同 02-24 快照) |

## 进度跟踪(按服务)

每个服务重写完成后,在表格对应行的"标记"列追加 ` ✅ 完成日期 YYYY-MM-DD`。