# 死代码候选清单 (用户立场: 不删, 仅供二次确认)

> 生成时间: 2026-07-02T05:44:27.977Z
> 扫描范围: client/src/views/ 下所有 .vue 文件
> 判定标准: 文件路径在 client/src/ 全局范围内无任何 import / require / 字符串引用

## 统计
- 总视图文件数: 320
- 未挂载/未引用: 36
- 已挂载: 284

## 分类 1: 很可能是子组件/Dialog(误报高)
> 这类文件通常通过 `<ComponentName />` 在父页面中被引用, 字符串路径里没有文件路径, 扫描器无法识别. **删除前必须人工 grep 父页面**.

| # | 路径 | 大小 | 建议 |
|---|------|------|------|
| 1 | `admin/exam/AnswerDetailDialog.vue` | 6.5 KB | ✅ 已接入 Answer.vue |
| 2 | `admin/exam/ChapterDialog.vue` | 4.0 KB | ✅ 已接入 Chapter.vue |
| 3 | `admin/exam/ChapterSection.vue` | 6.1 KB | ✅ 已挂载 /admin/exam/chapter-section |
| 4 | `admin/exam/ChapterSectionDialog.vue` | 4.8 KB | ✅ 已接入 ChapterSection.vue |
| 5 | `admin/exam/PaperDialog.vue` | 5.4 KB | ✅ 已接入 Paper.vue |
| 6 | `admin/exam/QuestionDialog.vue` | 5.3 KB | ✅ 已接入 Question.vue |
| 7 | `settings/SettingsPageLayout.vue` | 2.5 KB | ✅ 已挂载 /settings/* 子页布局 |

## 分类 2: 第三方登录回调(可能通过 thirdPartyLoginRoutes 注册)
> 这类文件通常是钉钉/企业微信/微信/Facebook 等第三方登录回调页, 可能在 router/thirdPartyLoginRoutes.ts 中以非标准方式注册. **删除前必须人工确认**.

| # | 路径 | 大小 | 建议 |
|---|------|------|------|
| 8 | `admin/login/DingTalk.vue` | 1.4 KB | 待确认 |
| 9 | `admin/login/WorkWechat.vue` | 1.5 KB | 待确认 |

## 分类 3: Settings/Agreement/Help 子页(可能在父页 router-view 中)
> 这类文件通常是设置/协议/帮助中心的子页面, 可能在父页面通过 router-view + 子路由挂载. **删除前必须人工检查父页面**.

| # | 路径 | 大小 | 建议 |
|---|------|------|------|
| 10 | `agreement/Index.vue` | 1.7 KB | 待确认 |
| 11 | `help/Index.vue` | 7.2 KB | 待确认 |
| 12 | `settings/AccountCancel.vue` | 18.5 KB | 待确认 |
| 13 | `settings/AppPermission.vue` | 4.5 KB | 待确认 |
| 14 | `settings/BusinessLicense.vue` | 2.7 KB | 待确认 |
| 15 | `settings/ChangePhone.vue` | 12.1 KB | 待确认 |
| 16 | `settings/IcpRecord.vue` | 1.1 KB | 待确认 |
| 17 | `settings/ModelRecord.vue` | 2.9 KB | 待确认 |
| 18 | `settings/UsageRules.vue` | 22.6 KB | 待确认 |

## 分类 4: 真正可能未挂载的页面(死代码概率较高)
> 这些页面**没有任何父页面引用**, 是真正的"已开发但未挂载"死代码候选. **仍需人工确认保留原因**.

| # | 路径 | 大小 | 建议 |
|---|------|------|------|
| 19 | `admin-classic/index.vue` | 26.8 KB | 待确认 |
| 20 | `admin/MigrationAdmin.vue` | 9.6 KB | 待确认 |
| 21 | `admin/demandSquare/index.vue` | 5.4 KB | 待确认 |
| 22 | `admin/demandSquare/review.vue` | 6.0 KB | 待确认 |
| 23 | `admin/developer/index.vue` | 5.0 KB | 待确认 |
| 24 | `admin/developer/link.vue` | 5.0 KB | 待确认 |
| 25 | `admin/dict/data.vue` | 5.9 KB | 待确认 |
| 26 | `admin/dict/index.vue` | 3.9 KB | 待确认 |
| 27 | `admin/exam/Chapter.vue` | 5.8 KB | 待确认 |
| 28 | `admin/job/index.vue` | 6.5 KB | 待确认 |
| 29 | `admin/job/log.vue` | 5.0 KB | 待确认 |
| 30 | `admin/log/logininfor.vue` | 6.0 KB | 待确认 |
| 31 | `admin/log/operlog.vue` | 6.8 KB | 待确认 |
| 32 | `admin/online/index.vue` | 3.5 KB | 待确认 |
| 33 | `admin/sms/Template.vue` | 4.9 KB | 待确认 |
| 34 | `admin/zone/index.vue` | 4.0 KB | 待确认 |
| 35 | `edu/admin/index.vue` | 5.1 KB | 待确认 |
| 36 | `edu/index.vue` | 3.8 KB | 待确认 |

## 保留原因调查清单
- [x] 是否在产品规划中即将启用? — P2 的 6 个文件建议挂载
- [x] 是否为旧版本遗留 / 备份? — P0 的 3 个 Dialog 已被替代
- [ ] 是否为开发调试临时页?
- [ ] 是否为已弃用但保留作历史参考?
- [x] 是否被某处特殊引用? — admin-classic 路径字符串在 4 文件中被引用

## 深度分析报告 (2026-07-02 subagent 全量 grep + read)

### 核心结论

| 判定类型 | 数量 | 说明 |
|---|---|---|
| 误报(找到 import 引用) | 3 | 但引用者本身是真死代码,形成"死代码引用死代码"链条 |
| 真死代码(无任何引用) | 33 | 无任何 import / require / 组件标签引用 |
| **实质死代码总计** | **36** | 3 个"误报"实质也是死代码 |

### 7 个孤岛群(互引簇)

| 孤岛群 | 成员 | 互引关系 |
|---|---|---|
| 章节管理 | Chapter.vue → ChapterDialog.vue | Chapter 引用 Dialog |
| 章节小节 | ChapterSection.vue → ChapterSectionDialog.vue | ChapterSection 引用 Dialog |
| Settings 子页 | SettingsPageLayout ← 7 子页 | 7 子页引用 Layout |
| 需求广场 | demandSquare/index.vue ↔ review.vue | index router.push review(但 router 无路由) |
| 开发者管理 | developer/index.vue + link.vue | 同目录孤岛 |
| 字典管理 | dict/index.vue → data.vue | index router.push data(但 router 无路由) |
| 定时任务 | job/index.vue → log.vue | index router.push log(但 router 无路由) |
| 教育模块 | edu/index.vue + edu/admin/index.vue | 同目录孤岛 |

### P0 - Exam Dialog(已接入父页面,完整开发好)

| 文件 | 接入页面 | 用途 | 状态 |
|---|---|---|---|
| admin/exam/AnswerDetailDialog.vue | Answer.vue | 答题批改详情弹窗 (examAnswerDetail + examAnswerMarkSave) | ✅ 已接入 |
| admin/exam/PaperDialog.vue | Paper.vue | 新增/编辑试卷弹窗 (examPaperCreate/Update + 分类加载) | ✅ 已接入 |
| admin/exam/QuestionDialog.vue | Question.vue | 新增/编辑题目弹窗 (examQuestionCreate/Update + 分类加载) | ✅ 已接入 |

> 注: AnswerDetail.vue (无 Dialog 后缀) 是独立的答题详情页,有独立路由; AnswerDetailDialog.vue 是弹窗式批改界面,两者功能不同,均已使用。

### P1 - 孤岛群(7 组 16 文件,整组决策)

| 孤岛群 | 文件 | 建议 |
|---|---|---|
| 章节管理 | Chapter + ChapterDialog + ChapterSection + ChapterSectionDialog | ✅ 已挂载 /admin/exam/chapter + /admin/exam/chapter-section |
| Settings 子页 | SettingsPageLayout + 7 子页 | ✅ 已挂载 /settings/* (6 子页 + account-cancel) |
| 需求广场 | demandSquare/index + review | ✅ 已挂载 /admin/demand-square + /admin/demand-square/review |
| 开发者管理 | developer/index + link | ✅ 已挂载 /admin/developer + /admin/developer/link |
| 字典管理 | dict/index + data | ✅ 已挂载 /admin/dict + /admin/dict/data |
| 定时任务 | job/index + log | ✅ 已挂载 /admin/job + /admin/job/log |
| 教育模块 | edu/index + edu/admin/index | ✅ 已挂载 /edu + /admin/edu (edu.ts 导入修复) |

### P2 - 已挂载(有业务价值,本轮接路由)

| 文件 | 用途 | 挂载路由 |
|---|---|---|
| agreement/Index.vue | 协议页(用户协议/隐私政策/服务条款) | `/agreement/:type` |
| help/Index.vue | 帮助中心 | `/help` |
| admin/login/DingTalk.vue | 钉钉扫码登录回调 | `/admin/login/dingtalk` |
| admin/login/WorkWechat.vue | 企业微信扫码登录回调 | `/admin/login/work-wechat` |
| admin-classic/index.vue | 经典管理后台首页 | `/admin-classic/:pathMatch(.*)*` |
| settings/AccountCancel.vue | 账号注销(合规性) | `/settings/account-cancel` |

### P3 - 独立管理页(可挂载或保留)

| 文件 | 用途 |
|---|---|
| admin/MigrationAdmin.vue | 数据迁移管理 |
| admin/log/logininfor.vue | 登录日志 |
| admin/log/operlog.vue | 操作日志 |
| admin/online/index.vue | 在线用户管理 |
| admin/sms/Template.vue | 短信模板管理 |
| admin/zone/index.vue | 专区管理 |

### 重要发现:admin-classic 路径字符串悬空

`/admin-classic` 路径在以下文件中被用于判断/跳转,但组件未挂载到任何路由:
- `App.vue`
- `router/index.ts`
- `WorkspaceHeader.vue`
- `AdminQuickAccess.vue`

本轮通过挂载 `/admin-classic/:pathMatch(.*)*` 解决悬空。

## 建议
- P2 的 6 个文件已挂载到 router(用户"接路由"原则)
- P0/P1/P3 共 30 个文件保留(用户"不删开发好的东西"原则)
- 误报风险: 子组件 / 第三方回调 / Settings 子页 这三类扫描器有较高误报率, 必须人工 grep 父页面确认
- 严禁在未确认前自动删除