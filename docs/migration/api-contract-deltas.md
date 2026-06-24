# api-contract-deltas · 逐服务 API 差异表

> **状态**:阶段 B 完成(2026-06-24,共 **129 endpoints** 注册在 `/api/v1/edu/*`)
> **生成方式**:基于阶段 B 实际生成的 22 个 FastAPI router

## 总览

| 域 | endpoint 数 | 路径前缀 | 来源 Java 服务 |
|---|---:|---|---|
| auth | 8 | /api/v1/edu/auth | ihui-ai-edu-auth-service |
| member | 10 | /api/v1/edu/member | ihui-ai-edu-member-service |
| usercenter | 8 | /api/v1/edu/usercenter | ihui-ai-edu-usercenter-service |
| setting | 7 | /api/v1/edu/setting | ihui-ai-edu-setting-service |
| content | 5 | /api/v1/edu/content | ihui-ai-edu-content-service |
| learn | 19 | /api/v1/edu/learn | ihui-ai-edu-learn-service |
| exam | 13 | /api/v1/edu/exam | ihui-ai-edu-exam-service |
| resource | 5 | /api/v1/edu/resource | ihui-ai-edu-resource-service |
| ask | 13 | /api/v1/edu/ask | ihui-ai-edu-ask-service |
| circle | 13 | /api/v1/edu/circle | ihui-ai-edu-circle-service |
| pay | 3 | /api/v1/edu/pay | ihui-ai-edu-pay-service |
| order | 5 | /api/v1/edu/order | ihui-ai-edu-order-service |
| point | 4 | /api/v1/edu/point | ihui-ai-edu-point-service |
| message | 4 | /api/v1/edu/message | ihui-ai-edu-message-service |
| notification | 3 | /api/v1/edu/notification | ihui-ai-edu-notification-service |
| live | 8 | /api/v1/edu/live | ihui-ai-edu-live-service |
| oss | 5 | /api/v1/edu/oss | ihui-ai-edu-oss-service |
| search | 3 | /api/v1/edu/search | ihui-ai-edu-search-service |
| schedule | 4 | /api/v1/edu/schedule | ihui-ai-edu-schedule-service |
| behavior | 4 | /api/v1/edu/behavior | ihui-ai-edu-behavior-service |
| visit_tracking | 3 | /api/v1/edu/visit-tracking | ihui-ai-edu-visit-tracking-service |
| gateway | 1 | /api/v1/edu/gateway | ihui-ai-edu-gateway-service(冻结) |
| **合计** | **129** | | |

## 命名差异速查(全阶段统一)

| edu Java 命名 | IHUI-AI 命名 | 说明 |
|---|---|---|
| `userId` | `user_id` | snake_case |
| `createTime` (毫秒) | `created_at` (datetime) | 时间格式与字段名 |
| `isDeleted` (0/1) | `is_deleted` (bool) | 类型转换 |
| `pageNum` + `pageSize` | `page` + `size` | 分页字段名 |
| `Long id` | `int`/`bigint` | Python int 自动 |
| `/ask/list` | `/api/v1/edu/ask/questions` | 复数化 |
| `/{domain}/public-api/**` 白名单 | 不需要(本仓用 JWT 校验) | Spring Security 移除 |

## 详细端点(完整 Phase B 交付)

### /api/v1/edu/auth (8 endpoints)
- POST /register — 注册用户
- POST /login — 登录
- GET /me — 当前用户信息
- PUT /me — 更新用户资料
- POST /change-password — 修改密码
- POST /sso/login — SSO 登录(签名 JWT)
- POST /sso/keypair — 生成 SSO KeyPair(管理员)
- POST /third-party/login — 第三方 OAuth 登录(wechat/dingtalk/feishu/wecom/qq)

### /api/v1/edu/member (10)
- POST / — 创建会员档案
- GET /me — 我的会员信息
- PUT /me — 更新我的会员信息
- GET /{member_id} — 按 ID 查询会员
- POST /{user_id}/points/add — 增加积分
- POST /{user_id}/points/deduct — 扣减积分
- GET / — 会员列表
- POST /parents — 绑定家长与学生
- DELETE /parents — 解绑家长
- GET /parents/{parent_user_id}/children — 家长查询学生列表

### /api/v1/edu/usercenter (8)
- GET /profile/me — 我的 profile
- PUT /profile/me — 更新我的 profile
- GET /profile/{user_id} — 按 ID 查询 profile
- POST /addresses — 添加地址
- PUT /addresses/{address_id} — 更新地址
- DELETE /addresses/{address_id} — 删除地址
- GET /addresses/me — 我的地址列表
- GET /addresses/me/default — 我的默认地址

### /api/v1/edu/setting (7)
- GET /dict/{dict_type}/{dict_key} — 单条字典查询
- GET /dict/{dict_type} — 类型字典列表
- POST /dict/batch-get — 批量查询
- POST /dict — 创建字典
- PUT /dict/{dict_id} — 更新字典
- DELETE /dict/{dict_id} — 删除字典
- GET /dict — 字典全列表

### /api/v1/edu/content (5)
- POST /articles — 创建文章
- PUT /articles/{article_id}/publish — 发布文章
- GET /articles/{article_id} — 文章详情(自动 +view)
- POST /articles/{article_id}/like — 点赞
- GET /articles — 文章列表

### /api/v1/edu/learn (19)
- POST /courses — 创建课程
- PUT /courses/{course_id} — 更新课程(教师)
- DELETE /courses/{course_id} — 删除课程(教师)
- GET /courses/{course_id} — 课程详情
- GET /courses — 课程列表
- POST /courses/{course_id}/enroll — 报名(+student_count)
- POST /chapters — 创建章节
- GET /chapters — 章节列表
- DELETE /chapters/{chapter_id} — 删除章节
- POST /sections — 创建小节
- GET /chapters/{chapter_id}/sections — 小节列表
- POST /progress — 更新学习进度
- GET /courses/{course_id}/progress — 我的进度
- GET /courses/{course_id}/completion — 完成度
- POST /homeworks — 创建作业
- POST /homeworks/{homework_id}/submit — 提交作业
- POST /submissions/{submission_id}/grade — 批改(教师)
- POST /certificates/issue — 颁发证书
- GET /certificates/me — 我的证书

### /api/v1/edu/exam (13)
- POST /papers — 创建试卷
- PUT /papers/{paper_id}/publish — 发布试卷
- GET /papers/{paper_id} — 试卷详情
- GET /papers — 试卷列表
- POST /questions — 添加题目
- GET /papers/{paper_id}/questions — 题目列表
- POST /records — 开始考试
- POST /records/{record_id}/submit — 提交(自动批改单选/多选/判断/填空)
- GET /records/{record_id} — 考试记录
- GET /records/me — 我的考试记录
- POST /wrong-book/{question_id} — 加入错题本
- POST /wrong-book/{wrong_book_id}/mastered — 标记掌握
- GET /wrong-book/me — 我的错题本

### /api/v1/edu/resource (5)
- POST /resources — 上传资源
- DELETE /resources/{resource_id} — 删除(上传者)
- GET /resources/{resource_id} — 资源详情
- POST /resources/{resource_id}/download — +download count
- GET /resources — 资源列表

### /api/v1/edu/ask (13)
- POST /questions — 提问
- GET /questions — 问题列表(latest/hot/unresolved)
- GET /questions/hot — 热门问题
- GET /questions/{question_id} — 问题详情(自动 +view)
- PUT /questions/{question_id} — 更新(作者)
- DELETE /questions/{question_id} — 删除(作者)
- GET /questions/{question_id}/stats — 问题统计
- GET /users/{user_id}/stats — 用户统计
- POST /questions/{question_id}/answers — 答题(自动 +answer_count)
- GET /questions/{question_id}/answers — 答案列表(best/latest)
- DELETE /answers/{answer_id} — 删除答案(作者)
- POST /answers/{answer_id}/adopt — 采纳最佳(提问者)
- POST /answers/{answer_id}/like — 点赞

### /api/v1/edu/circle (13)
- POST /circles — 创建圈子
- GET /circles — 圈子列表
- GET /circles/{circle_id} — 圈子详情
- PUT /circles/{circle_id} — 更新(圈主)
- DELETE /circles/{circle_id} — 删除(圈主)
- POST /circles/{circle_id}/join — 加入
- POST /circles/{circle_id}/leave — 退出
- GET /circles/{circle_id}/members — 成员列表
- POST /circles/{circle_id}/posts — 发帖
- GET /circles/{circle_id}/posts — 帖子列表
- DELETE /posts/{post_id} — 删帖(作者/圈主)
- POST /posts/{post_id}/like — 点赞
- GET /users/{user_id}/circles — 我加入的圈子

### /api/v1/edu/pay (3)
- POST /pay-orders — 创建支付订单
- POST /pay-orders/{pay_order_id}/mark-paid — webhook 标记已支付
- GET /pay-orders/me — 我的支付记录

### /api/v1/edu/order (5)
- POST /orders — 创建订单(自动生成 order_no)
- POST /orders/{order_id}/cancel — 取消
- POST /orders/{order_id}/refund — 退款
- GET /orders/{order_id} — 订单详情
- GET /orders/me — 我的订单

### /api/v1/edu/point (4)
- POST /points/earn — 获得积分
- POST /points/spend — 消费积分
- GET /points/me — 我的积分账户
- GET /points/records — 我的积分流水

### /api/v1/edu/message (4)
- POST /messages — 发消息(system/private/group)
- POST /messages/{message_id}/read — 标记已读
- GET /messages/inbox — 收件箱
- GET /messages/unread-count — 未读数

### /api/v1/edu/notification (3)
- POST /notifications — 发送通知(admin)
- POST /notifications/batch — 批量发送(admin)
- GET /notifications/me — 我的通知

### /api/v1/edu/live (8)
- POST /rooms — 创建直播间
- POST /rooms/{room_id}/start — 开始直播
- POST /rooms/{room_id}/end — 结束直播
- POST /rooms/{room_id}/join — 加入
- POST /rooms/{room_id}/leave — 退出
- GET /rooms/{room_id} — 房间详情
- GET /rooms — 房间列表
- GET /rooms/{room_id}/attendees — 参会者

### /api/v1/edu/oss (5)
- POST /upload/init — 初始化分片上传
- GET /upload/{session_id}/part/{part_number}/url — 获取预签名 URL
- POST /upload/{session_id}/part/{part_number}/uploaded — 标记分片完成
- POST /upload/{session_id}/complete — 完成上传
- POST /upload/{session_id}/abort — 中止上传

### /api/v1/edu/search (3)
- POST /index — 索引实体
- GET /search — 全文搜索
- DELETE /index/{entity_type}/{entity_id} — 删除索引

### /api/v1/edu/schedule (4)
- POST /schedules — 创建排课
- GET /teachers/{teacher_id}/schedule — 教师课表
- POST /check-conflict — 冲突检测
- DELETE /schedules/{schedule_id} — 删除

### /api/v1/edu/behavior (4)
- POST /events — 上报行为事件
- GET /users/{user_id}/metrics — 学习指标
- GET /entities/{entity_type}/{entity_id}/views — 实体浏览数
- GET /events/me — 我的事件

### /api/v1/edu/visit-tracking (3)
- POST /visits — 记录访问
- GET /analytics/daily — 日访问量
- GET /analytics/paths — Top 路径

### /api/v1/edu/gateway (1,信息性)
- GET /routes — Java Spring Cloud Gateway 路由表(replaced by Nginx + FastAPI)

## 列定义

| 列 | 含义 |
|---|---|
| 服务 | edu Java 服务名 |
| edu Path | edu Gateway 转发路径(如 `/learn/list`) |
| edu Method | GET/POST/PUT/DELETE |
| edu Resp | edu 响应结构(简述,1 行)|
| IHUI-AI Path | IHUI-AI FastAPI 路径(如 `/api/v1/learn/courses`)|
| IHUI-AI Method | 同上 |
| IHUI-AI Resp | IHUI-AI 响应结构(简述)|
| 差异 | 行为差异点(字段/类型/默认值)|
| 状态 | ⬜ 未迁 / 🔄 迁移中 / ✅ 完成 |

## 端点差异表(模板,实际填充在阶段 B)

```yaml
ask-service:
  endpoints: []
  # edu 端点示例:
  # - edu_path: /ask/list
  #   edu_method: GET
  #   edu_resp: {code, msg, data: {questions: [{id, title, content, userId, createTime}]}}
  #   ihui_path: /api/v1/edu/ask/questions
  #   ihui_method: GET
  #   ihui_resp: {items: [...], total: int}
  #   diff: 分页字段名 code/page/size 与 edu 不一致;userId→user_id snake_case
  #   status: ⬜
```

## 23 服务端点清单(待填充)

> 此处只列服务,具体端点由阶段 B 各服务 PR 填充。

| # | 服务 | 预计端点数 | 状态 |
|---:|---|---:|:-:|
| 1 | gateway | - | 📦 冻结(网关模型取消) |
| 2 | auth | ~15 | ⬜ |
| 3 | member | ~10 | ⬜ |
| 4 | usercenter | ~12 | ⬜ |
| 5 | setting | ~8 | ⬜ |
| 6 | resource | ~20 | ⬜ |
| 7 | content | ~15 | ⬜ |
| 8 | learn | ~30 | ⬜ |
| 9 | live | ~10 | ⬜ |
| 10 | exam | ~25 | ⬜ |
| 11 | ask | ~8 | ⬜ |
| 12 | circle | ~15 | ⬜ |
| 13 | behavior | ~12 | ⬜ |
| 14 | pay | ~18 | ⬜ |
| 15 | point | ~8 | ⬜ |
| 16 | message | ~12 | ⬜ |
| 17 | notification | ~10 | ⬜ |
| 18 | oss | ~5 | ⬜ |
| 19 | search | ~6 | ⬜ |
| 20 | schedule | ~8 | ⬜ |
| 21 | visit-tracking | ~6 | ⬜ |
| 22 | order | ~15 | ⬜ |
| **合计** | | **~270** | |

## 阶段 B 端点抽取脚本(待开发)

`scripts/migration/extract_edu_endpoints.py` — 解析 Java Controller + OpenAPI 文档,自动生成此表初版。

## 命名差异速查

| edu 命名 | IHUI-AI 命名 | 说明 |
|---|---|---|
| `userId` | `user_id` | snake_case |
| `createTime` (毫秒) | `created_at` (datetime) | 时间格式与字段名 |
| `isDeleted` (0/1) | `is_deleted` (bool) | 类型转换 |
| `pageNum` + `pageSize` | `page` + `size` | 分页字段名 |
| 返回 `{code, msg, data}` | 返回 `{items, total}` 或 `BaseModel` | 包装格式 |
| `Long` id | `int`/`bigint` | 类型映射(Java 显式大数,Python int 自动) |