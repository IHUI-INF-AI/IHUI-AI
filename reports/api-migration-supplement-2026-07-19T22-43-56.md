# 架构迁移审计 P2 v2 — 10 个缺失 API 端点补开发报告

- **生成时间**: 2026-07-19T22:43:56+08:00
- **审计依据**: `reports/migration-audit-api-routes-v2-2026-07-19T14-11-11.csv`(realMissing 列表)
- **补开发范围**: 6 个业务模块 / 6 个路由文件 / 10 个真实缺失端点
- **验证命令**: `pnpm --filter @ihui/api typecheck` → **退出码 0 全绿**

---

## 1. 端点清单与路径映射

### 1.1 private-letter(7 端点)— 私信模块

| # | Java 原路径 | IHUI-AI 新路径 | 方法 | 文件 |
|---|------------|----------------|------|------|
| 1 | `/auth-api/private-letter` | `/api/private-letters` | POST | `apps/api/src/routes/private-letters.ts` |
| 2 | `/auth-api/private-letter` | `/api/private-letters` | DELETE | 同上 |
| 3 | `/auth-api/private-letter` | `/api/private-letters` | GET | 同上 |
| 4 | `/auth-api/private-letter/member/list` | `/api/private-letters/members` | GET | 同上 |
| 5 | `/auth-api/private-letter/member` | `/api/private-letters/member` | GET | 同上 |
| 6 | `/auth-api/private-letter/list` | `/api/private-letters/list` | GET | 同上 |
| 7 | `/auth-api/private-letter/new/list` | `/api/private-letters/new` | GET | 同上 |

### 1.2 wrong-question(3 端点)— 错题本

| # | Java 原路径 | IHUI-AI 新路径 | 方法 | 文件 |
|---|------------|----------------|------|------|
| 8 | `/auth-api/wrong-question` | `/api/wrong-questions` | POST | `apps/api/src/routes/wrong-questions.ts` |
| 9 | `/auth-api/wrong-question` | `/api/wrong-questions` | DELETE | 同上 |
| 10 | `/auth-api/wrong-question/list` | `/api/wrong-questions` | GET | 同上 |

### 1.3 check-in(2 主端点 + 2 辅助)— 签到

| # | Java 原路径 | IHUI-AI 新路径 | 方法 | 文件 |
|---|------------|----------------|------|------|
| 11 | `/auth-api/check-in` | `/api/check-in` | POST | `apps/api/src/routes/check-in.ts` |
| 12 | `/public-api/check-in` | `/api/check-in` | GET | 同上 |
| ★ | — | `/api/check-in/rules` | GET | 辅助端点 |
| ★ | — | `/api/check-in/stats` | GET | 辅助端点 |

> 注:与现有 `/api/checkin`(legacy 路由,无连字符)区分。新路径用连字符规范化命名,对齐项目路由命名约定。

### 1.4 mail(2 端点)— 邮件

| # | Java 原路径 | IHUI-AI 新路径 | 方法 | 文件 |
|---|------------|----------------|------|------|
| 13 | `/public-api/mail/send` | `/api/mail/send` | POST | `apps/api/src/routes/mail.ts` |
| 14 | `/public-api/mail/send/html` | `/api/mail/send/html` | POST | 同上 |

### 1.5 auth-code(2 端点)— 验证码

| # | Java 原路径 | IHUI-AI 新路径 | 方法 | 文件 |
|---|------------|----------------|------|------|
| 15 | `/public-api/auth-code` | `/api/auth-codes` | GET | `apps/api/src/routes/auth-codes.ts` |
| 16 | `/public-api/auth-code/check` | `/api/auth-codes/check` | POST | 同上 |

### 1.6 mark/paper(1 端点)— 阅卷评分

| # | Java 原路径 | IHUI-AI 新路径 | 方法 | 文件 |
|---|------------|----------------|------|------|
| 17 | `/auth-api/mark/paper` | `/api/exam-marking` | POST | `apps/api/src/routes/exam-marking.ts` |

---

## 2. 请求 / 响应 Schema 与业务逻辑摘要

### 2.1 private-letter(私信)

**数据表**: `t_private_letter`(legacy 补迁移,字段: `id` bigint / `senderId` varchar(100) / `receiverId` varchar(100) / `content` text / `isRead` boolean / `status` varchar(30) / `createTime` timestamp)
**鉴权**: 模块级 `preHandler` 调用 `authenticate`(对应 Java `/auth-api/*` 全鉴权)

| 端点 | 请求 Schema | 响应 | 业务逻辑 |
|------|------------|------|---------|
| POST `/` | body: `{ receiverId: string, content: string(≤5000) }` | 201 + 私信记录 | 校验 `receiverId !== senderId`,insert `tPrivateLetter`,初始 `isRead=false / status='normal'` |
| DELETE `/` | body: `{ id: number }` | `{ id, deleted: true }` | 仅允许 sender 或 receiver 删除自己持有的私信 |
| GET `/?id=` | query: `{ id: number }` | 私信记录 | 仅允许 sender 或 receiver 查看详情 |
| GET `/members` | query: `{ page, pageSize, memberNameKeyword? }` | `{ list, total, page, pageSize }` | 用 SQL CASE 表达式取 counterpart userId,联表 `users.nickname`,按最新私信时间倒序 |
| GET `/member?memberId=` | query: `{ memberId: string }` | 最新一条私信 | 双向匹配 `(senderId=me AND receiverId=member) OR (senderId=member AND receiverId=me)`,按 createTime desc 取 1 |
| GET `/list?senderId=&id=cursor` | query: `{ page, pageSize, senderId, id=0 }` | `{ list, currentUserId, page, pageSize }` | 双向私信流,`id > 0` 时作为游标 `WHERE id < cursor`,按 id desc |
| GET `/new?senderId=&id=cursor` | query: `{ page, pageSize, senderId?, id=0 }` | `{ list, currentUserId, page, pageSize }` | 当前用户全部最新私信,可选 senderId 过滤某会话 |

### 2.2 wrong-question(错题本)

**数据表**: `exam_wrong_question`(已迁移,UUID 主键,字段: `userId/questionId/paperId/paperTitle/userAnswer/rightAnswer/wrongCount/lastWrongTime/isMastered`)
**鉴权**: 模块级 `preHandler authenticate`
**复用**: `createOrUpdateWrongQuestion`(onConflictDoUpdate 幂等,依赖 `exam_wrong_question_user_question_unique` 唯一约束)/ `findWrongQuestionsByUser`(联表 `exam_questions` 取题目内容)

| 端点 | 请求 Schema | 响应 | 业务逻辑 |
|------|------------|------|---------|
| POST `/` | body: `{ questionId: UUID, paperId: UUID, paperTitle?, userAnswer, rightAnswer }` | 201 + 错题记录 | 复用 `createOrUpdateWrongQuestion`:同题同用户 wrongCount+1 + 取消 isMastered;新题 wrongCount=1 |
| DELETE `/` | body: `{ id: UUID }` | `{ id, deleted: true }` | `WHERE id=? AND userId=me`(仅本人可删) |
| GET `/?paperId=&isMastered=` | query: `{ page, pageSize, paperId?, isMastered? }` | `{ list, total }` | 复用 `findWrongQuestionsByUser`,支持 paperId / isMastered 筛选 |

### 2.3 check-in(签到)

**数据表**: `sign_in_records`(现代版,字段: `userId/signInDate/consecutiveDays/rewardPoints`)+ `sign_in_rules`
**鉴权**: POST 强制鉴权;GET 可选鉴权(未登录返回 null,对齐 Java `getLoginUserId` 失败语义)
**复用**: `calcSignInReward` 算法(连续签到 `10 + (n-1)*5`,7 天封顶 50 分,与 `checkin.ts` 一致)

| 端点 | 请求 Schema | 响应 | 业务逻辑 |
|------|------------|------|---------|
| POST `/` | 无 body | 201 + `{ record, rewardPoints, consecutiveDays }` | 检查今日已签到 → 409;查昨日记录计算 `consecutiveDays = 昨日+1`;计算 `rewardPoints = calcSignInReward(consecutiveDays)`;insert |
| GET `/` | 无 | `{ signedIn, consecutiveDays, todayReward, record }` 或 `null` | 未登录返回 null;登录:查今日记录,signedIn 取记录值,consecutiveDays 已签到取记录 / 未签到查昨日+1 |
| GET `/rules` | 无 | signInRules 列表 | 按 `consecutiveDays` desc 排序 |
| GET `/stats` | 无 | `{ totalCheckins, todayCheckins, activeUsers }` | 全表 count + 今日 count + distinct userId count |

### 2.4 mail(邮件)

**鉴权**: 公开端点(对齐 Java `/public-api/*` 无鉴权)
**复用**: `email-service.ts sendEmail`(SMTP 配置缺失时自动降级为 stub,返回 `result.stub=true`)

| 端点 | 请求 Schema | 响应 | 业务逻辑 |
|------|------------|------|---------|
| POST `/send` | body: `{ to, cc?, bcc?, subject, text, from?, fromName?, replyTo? }` | 202 + `{ accepted, stub, message }` | 拼接 `to + cc + bcc` 作为完整收件人;`text` 转 HTML(escape + `\n→<br/>`);`from/fromName/replyTo` 记录到日志(email-service 当前忽略,后续扩展);返回 202 Accepted |
| POST `/send/html` | body: `{ to, cc?, bcc?, subject, html, from?, fromName?, replyTo? }` | 202 + `{ accepted, stub, message }` | 同上,但 `html` 直接发送,`text` 由 html 去 tag 生成 |

### 2.5 auth-code(验证码)

**鉴权**: 公开端点(对齐 Java `/public-api/*`)
**复用**: `sms.ts sendSmsCode`(阿里云/代理/console 三级降级)+ `code-store.ts verifyCode`(内存一次性验证码)

| 端点 | 请求 Schema | 响应 | 业务逻辑 |
|------|------------|------|---------|
| GET `/?mobile=` | query: `{ mobile: regex(/^1[3-9]\d{9}$/) }` | `{ mobile, sent: true, message }` | 调 `sendSmsCode(mobile)`,失败/限速返回 429 |
| POST `/check` | body: `{ mobile, code }` | `{ valid: boolean }` | 调 `verifyCode(mobile, code)`,一次性校验(校验后从内存删除) |

### 2.6 exam-marking(阅卷评分)

**数据表**: `exam_records`(状态机:`draft → enrolled → answering → submitted → graded → completed`)
**鉴权**: POST 强制鉴权
**复用**: `getExamRecordStatus`(查记录当前状态)+ `gradeExam`(内部 `checkAndUpdateStatus(recordId, SUBMITTED, GRADED)` + 记录 `score/isPassed`)

| 端点 | 请求 Schema | 响应 | 业务逻辑 |
|------|------------|------|---------|
| POST `/` | body: `{ recordId: UUID, score: number(0-1000), paperId?, memberId?, answer?, referenceAnswer? }` | 200 + 更新后的 examRecord | 1. `getExamRecordStatus(recordId)` 校验存在 → 404;2. 校验 `status === 'submitted'` → 409;3. `gradeExam(recordId, score)`:`submitted → graded` + `score=String(score)` + `isPassed = score >= 60` |

---

## 3. 路由注册

修改文件: `apps/api/src/server.ts`

**import 区块**(244-250 行,紧接 R81 路由 import 之后):

```ts
// 架构迁移审计 P2 v2 补开发：6 个缺失 API 端点模块（private-letter / wrong-question / check-in / mail / auth-code / mark-paper）
import privateLetterRoutes from './routes/private-letters.js'
import wrongQuestionRoutes from './routes/wrong-questions.js'
import checkInRoutes from './routes/check-in.js'
import mailRoutes from './routes/mail.js'
import authCodeRoutes from './routes/auth-codes.js'
import examMarkingRoutes from './routes/exam-marking.js'
```

**registerRoutes 函数尾部**(938-951 行,5 个 redirect 之后,函数 `}` 之前):

```ts
// ===== 架构迁移审计 P2 v2 补开发：6 个缺失 API 端点模块（10 个真实缺失端点）=====
server.register(privateLetterRoutes, { prefix: '/api/private-letters' })
server.register(wrongQuestionRoutes, { prefix: '/api/wrong-questions' })
server.register(checkInRoutes, { prefix: '/api/check-in' })
server.register(mailRoutes, { prefix: '/api/mail' })
server.register(authCodeRoutes, { prefix: '/api/auth-codes' })
server.register(examMarkingRoutes, { prefix: '/api/exam-marking' })
```

---

## 4. 验证结果

### 4.1 typecheck

```bash
pnpm --filter @ihui/api typecheck
```

**输出**:

```
> @ihui/api@0.0.0 typecheck G:\IHUI-AI\apps\api
> tsc --noEmit
```

**退出码**: 0 ✅(全绿,无错误无警告)

### 4.2 typecheck 过程中暴露并修复的问题

首轮 typecheck 报 4 个 TS6133/TS2459 错误,已全部修复:

| # | 文件 | 错误 | 修复 |
|---|------|------|------|
| 1 | `auth-codes.ts:5` | `emptyToUndefined` declared but never read | 从 import 中移除 |
| 2 | `check-in.ts:2` | `z` declared but never read | 删除 `import { z } from 'zod'`(无 Zod schema) |
| 3 | `exam-marking.ts:5` | `findExamRecordByIdExtended` not exported | 改用 `getExamRecordStatus`(exam-extended-queries.ts 第 656 行 export 的等价函数) |
| 4 | `wrong-questions.ts:3` | `desc` declared but never read | 从 `import { eq, and, desc }` 中移除 `desc`(`findWrongQuestionsByUser` 内部已封装排序) |

### 4.3 约束遵守

- ✅ 仅修改 `apps/api/src/routes/*.ts` + `apps/api/src/server.ts`,未触碰 `packages/database/*` 与 `apps/web/*`
- ✅ 全部用 Fastify 5 + Zod + Drizzle ORM + `packages/auth authenticate`
- ✅ 统一响应格式 `{ code, message, data }`(通过 `utils/response.ts` 的 `success/error`)
- ✅ 参考D 盘 Java controller 业务逻辑,TS 重写,未引入 Java 依赖
- ✅ 未执行 `git add` / `git commit` / `git push`(任务禁止 commit)

---

## 5. 受影响文件清单

### 5.1 新建文件(6 个)

```
apps/api/src/routes/private-letters.ts    (253 行,7 端点)
apps/api/src/routes/wrong-questions.ts    (108 行,3 端点)
apps/api/src/routes/check-in.ts           (143 行,2 主端点 + 2 辅助)
apps/api/src/routes/mail.ts               (97 行,2 端点)
apps/api/src/routes/auth-codes.ts         (61 行,2 端点)
apps/api/src/routes/exam-marking.ts       (65 行,1 端点)
```

### 5.2 修改文件(1 个)

```
apps/api/src/server.ts                    (新增 7 行 import + 14 行 register,共 21 行)
```

### 5.3 报告文件(本文件)

```
reports/api-migration-supplement-2026-07-19T22-43-56.md
```

---

## 6. 后续任务(前端页面补开发依赖)

> 以下仅为本任务范围内**端点可用性**对应的前端调用方需求,不在本任务范围内实施。

| 模块 | 前端依赖 | 建议优先级 |
|------|---------|-----------|
| private-letter | `apps/web` 私信会话页面(会员列表 + 内容流 + 游标分页) | P2(用户级功能,非核心) |
| wrong-question | `apps/web` 错题本页面(列表 + paperId 筛选 + 掌握状态切换) | P2(学习辅助功能) |
| check-in | `apps/web` 签到日历组件(每日签到按钮 + 连续天数 + 奖励动画) | P2(运营增强) |
| mail | `apps/web` 管理端邮件群发工具(可选,后台运营用) | P3(管理工具) |
| auth-code | `apps/web` 注册/登录页验证码输入框(已存在,仅需切换 API 路径) | P1(对接现有 UI) |
| exam-marking | `apps/web` 阅卷评分后台(管理端待评分列表 + 评分表单) | P2(管理端功能) |

---

## 7. 一句话总结

完成 6 个路由文件 / 17 个端点(10 个真实缺失 + 7 个辅助/扩展)的补开发,在 `apps/api/src/server.ts` 注册 6 个新路由前缀,typecheck 退出码 0 全绿,严格遵守任务约束边界(仅改 `apps/api` 内文件 + `reports/`,未触碰 `packages/database` 与 `apps/web`)。
