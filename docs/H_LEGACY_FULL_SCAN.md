# 历史项目全量功能清单 (从零扫描)

> 生成时间: 2026-07-07 23:49:42
> 扫描源: D 盘历史项目存档
> 用途: 与 G 盘整合项目交叉验证, 找出遗漏

## 1. edu service (Java 19 微服务) — 后端控制器与端点

### 1.1 服务清单 (22 个 service 模块)

| # | 服务 | Controller 数 | HTTP 端点数 |
|---|------|--------------|------------|
| - | `ihui-ai-edu-ask-service` | 5 | 29 |
| - | `ihui-ai-edu-auth-service` | 5 | 19 |
| - | `ihui-ai-edu-behavior-service` | 6 | 28 |
| - | `ihui-ai-edu-circle-service` | 6 | 35 |
| - | `ihui-ai-edu-content-service` | 5 | 39 |
| - | `ihui-ai-edu-exam-service` | 14 | 81 |
| - | `ihui-ai-edu-gateway-service` | 0 | 0 |
| - | `ihui-ai-edu-learn-service` | 21 | 145 |
| - | `ihui-ai-edu-live-service` | 7 | 30 |
| - | `ihui-ai-edu-member-service` | 10 | 80 |
| - | `ihui-ai-edu-message-service` | 6 | 23 |
| - | `ihui-ai-edu-notification-service` | 3 | 3 |
| - | `ihui-ai-edu-order-service` | 4 | 32 |
| - | `ihui-ai-edu-oss-service` | 2 | 4 |
| - | `ihui-ai-edu-pay-service` | 4 | 5 |
| - | `ihui-ai-edu-point-service` | 6 | 21 |
| - | `ihui-ai-edu-resource-service` | 6 | 42 |
| - | `ihui-ai-edu-schedule-service` | 2 | 1 |
| - | `ihui-ai-edu-search-service` | 4 | 11 |
| - | `ihui-ai-edu-setting-service` | 3 | 6 |
| - | `ihui-ai-edu-usercenter-service` | 10 | 38 |
| - | `ihui-ai-edu-visit-tracking-service` | 2 | 5 |
| **合计** | **22 服务** | **131** | **677** |

### 1.2 全部 Controller 类清单 (类路径 + 文件)

- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/biz/answer/web/AnswerController.java`
- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/biz/category/web/CategoryController.java`
- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/biz/question/web/QuestionController.java`
- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/biz/statistics/web/AskStatisticsController.java`
- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/common/controller/BaseController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/biz/authority/web/AuthorityController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/biz/jwt/web/AuthController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/biz/role/web/RoleController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/biz/sso/web/SsoController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/common/controller/BaseController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/comment/web/CommentController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/favorites/web/FavoriteController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/like/web/LikeController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/sensitiveword/web/WordController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/watch/web/WatchController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/common/controller/BaseController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/category/web/CategoryController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/circle/web/CircleController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/circle/web/CircleMemberController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/dynamic/web/DynamicController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/statistics/web/CircleStatisticsController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/common/controller/BaseController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/biz/article/web/ArticleController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/biz/category/web/CategoryController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/biz/news/web/NewsController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/biz/statistics/web/ContentStatisticsController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/common/controller/BaseController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/category/web/CategoryController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/exam/web/ExamChapterController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/exam/web/ExamChapterSectionController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/exam/web/ExamController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/paper/category/web/PaperCategoryController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/paper/web/PaperController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/paper/web/PaperQuestionController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/questionlib/category/web/QuestionCategoryController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/questionlib/question/web/QuestionController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/record/web/RecordController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/signup/web/SignUpController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/statistics/web/ExamStatisticsController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/wrongquestion/web/WrongQuestionController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/common/controller/BaseController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/access/web/LessonAccessController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/category/web/CategoryController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/certificate/web/CertificateController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/certificate/web/CertificateTemplateController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/exampaper/web/ExamPaperRecordController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/homework/web/HomeworkController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/homework/web/HomeworkRecordController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/learnmap/web/LearnMapController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/lesson/web/LessonChapterController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/lesson/web/LessonChapterSectionController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/lesson/web/LessonController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/order/web/LessonOrderController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/rate/web/RateController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/record/web/RecordController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/report/web/ReportController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/signup/web/SignUpController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/statistics/web/StatisticsController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/task/web/LessonTaskController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/topic/web/TopicController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/topiccategory/web/TopicCategoryController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/common/controller/BaseController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/category/web/CategoryController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/channel/web/ChannelController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/statistics/web/LiveStatisticsController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/subscribe/web/SubscribeController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/tencent/web/TencentCloudLiveNotifyController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/tencent/web/TencentCloudLiveStreamController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/common/controller/BaseController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/base/web/MemberController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/checkin/web/CheckInController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/company/web/MemberCompanyController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/company/web/MemberCompanyTypeController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/follow/web/FollowController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/group/web/MemberGroupController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/level/web/MemberLevelController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/post/web/MemberPostController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/tags/web/MemberTagController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/common/controller/BaseController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/announcement/web/AnnouncementController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/notice/web/NoticeController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/privateletter/web/PrivateLetterController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/statistics/web/MessageStatisticsController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/template/web/TemplateController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/common/controller/BaseController.java`
- `ihui-ai-edu-notification-service/src/main/java/com/yjs/cloud/learning/notification/biz/email/web/MailController.java`
- `ihui-ai-edu-notification-service/src/main/java/com/yjs/cloud/learning/notification/biz/sms/web/SmsController.java`
- `ihui-ai-edu-notification-service/src/main/java/com/yjs/cloud/learning/notification/common/controller/BaseController.java`
- `ihui-ai-edu-order-service/src/main/java/com/yjs/cloud/learning/order/biz/invoice/web/InvoiceApplicationController.java`
- `ihui-ai-edu-order-service/src/main/java/com/yjs/cloud/learning/order/biz/invoice/web/InvoiceTitleController.java`
- `ihui-ai-edu-order-service/src/main/java/com/yjs/cloud/learning/order/biz/order/web/OrderController.java`
- `ihui-ai-edu-order-service/src/main/java/com/yjs/cloud/learning/order/common/controller/BaseController.java`
- `ihui-ai-edu-oss-service/src/main/java/com/yjs/cloud/learning/oss/biz/base/web/OssController.java`
- `ihui-ai-edu-oss-service/src/main/java/com/yjs/cloud/learning/oss/common/controller/BaseController.java`
- `ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/alipay/web/AliPayNotifyController.java`
- `ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/base/web/TradeController.java`
- `ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay/web/WechatpayNotifyController.java`
- `ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/common/controller/BaseController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/channel/web/ChannelController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/point/web/PointChannelRelationController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/point/web/PointController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/record/web/RecordController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/statistics/web/PointStatisticsController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/common/controller/BaseController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/category/web/CategoryController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/product/web/ResourceProductController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/resource/web/ResourceController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/statistics/web/ResourceStatisticsController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/tag/web/ResourceTagController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/common/controller/BaseController.java`
- `ihui-ai-edu-schedule-service/src/main/java/com/yjs/cloud/learning/schedule/biz/watch/web/WatchController.java`
- `ihui-ai-edu-schedule-service/src/main/java/com/yjs/cloud/learning/schedule/common/controller/BaseController.java`
- `ihui-ai-edu-search-service/src/main/java/com/yjs/cloud/learning/search/biz/content/web/ContentController.java`
- `ihui-ai-edu-search-service/src/main/java/com/yjs/cloud/learning/search/biz/hotword/web/HotWordController.java`
- `ihui-ai-edu-search-service/src/main/java/com/yjs/cloud/learning/search/biz/record/web/RecordController.java`
- `ihui-ai-edu-search-service/src/main/java/com/yjs/cloud/learning/search/common/controller/BaseController.java`
- `ihui-ai-edu-setting-service/src/main/java/com/yjs/cloud/learning/setting/biz/agreement/web/AgreementController.java`
- `ihui-ai-edu-setting-service/src/main/java/com/yjs/cloud/learning/setting/biz/carousel/web/CarouselController.java`
- `ihui-ai-edu-setting-service/src/main/java/com/yjs/cloud/learning/setting/common/controller/BaseController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/base/company/web/CompanyController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/base/department/web/DepartmentController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/base/post/web/PostController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/base/user/web/UserController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/dingtalk/web/DingTalkController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/lecturer/web/LecturerController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/statistics/web/UserCenterStatisticsController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat/web/WechatOauthController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat/web/WorkWeChatController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/common/controller/BaseController.java`
- `ihui-ai-edu-visit-tracking-service/src/main/java/com/yjs/cloud/learning/visittracking/biz/visit/web/VisitLogController.java`
- `ihui-ai-edu-visit-tracking-service/src/main/java/com/yjs/cloud/learning/visittracking/common/controller/BaseController.java`

### 1.3 HTTP 端点清单 (类 → 路径 → 方法)

```
### AnswerController  (class-path: <none>)
  L39  Post  /auth-api/answer
  L46  Put  /auth-api/answer
  L52  Delete  /auth-api/answer
  L58  Get  /answer/list
  L64  Get  /public-api/answer/list
  L74  Get  /public-api/answer/list/by-ids
  L99  Get  /public-api/answer
  L105  Get  /auth-api/member/answer/list
  L134  Get  /public-api/answer/member/count

### CategoryController  (class-path: <none>)
  L32  Get  /category/admin/list
  L39  Get  /category/{id}
  L45  Post  /category
  L51  Put  /category
  L60  Delete  /category/{id}
  L66  Post  /category/image
  L75  Delete  /category/image
  L84  Put  /category/is-show
  L96  Put  /category/is-show-index
  L108  Get  /public-api/category/list

### QuestionController  (class-path: <none>)
  L35  Post  /auth-api/question
  L43  Put  /auth-api/question
  L49  Delete  /auth-api/question
  L55  Get  /question/list
  L61  Get  /public-api/question/list
  L71  Get  /public-api/question/list/by-ids
  L79  Get  /public-api/question
  L90  Get  /public-api/question/member/count
  L105  Get  /auth-api/member/question/list

### AskStatisticsController  (class-path: <none>)
  L18  Get  /statistics

### BaseController  (class-path: <none>)

### AuthorityController  (class-path: <none>)
  L34  Get  /authorities
  L48  Get  /authorities/tree

### AuthController  (class-path: <none>)
  L42  Get  /public-api/auth-code
  L59  Post  /public-api/auth-code/check

### RoleController  (class-path: <none>)
  L36  Get  /role/list
  L47  Get  /role/page/list
  L67  Post  /role
  L82  Put  /role
  L105  Delete  /role
  L122  Get  /role/authority/list
  L128  Put  /role/authority/update
  L134  Get  /role/user/list
  L140  Put  /role/user/list

### SsoController  (class-path: /sso)
  L28  Post  /admin/login
  L34  Post  /member/login
  L40  Post  /uuid/login
  L46  Post  /admin/create
  L52  Post  /member/create

### BaseController  (class-path: <none>)

### CommentController  (class-path: <none>)
  L37  Post  /auth-api/comment
  L44  Delete  /auth-api/comment
  L50  Get  /public-api/comment/list
  L56  Get  /public-api/comment/list/by-ids
  L63  Get  /public-api/reply-comment/list/by-ids
  L90  Post  /auth-api/reply/comment
  L97  Delete  /auth-api/reply/comment
  L103  Get  /public-api/comment/count
  L109  Get  /auth-api/current-member/comment/list
  L119  Get  /public-api/comment/type/list

### FavoriteController  (class-path: <none>)
  L29  Post  /auth-api/favorite
  L36  Delete  /auth-api/favorite
  L42  Get  /auth-api/favorite/list
  L52  Get  /public-api/favorite/count
  L58  Get  /auth-api/favorite/member/list
  L65  Get  /public-api/favorite/type/list

### LikeController  (class-path: <none>)
  L28  Post  /auth-api/like
  L35  Put  /auth-api/like
  L44  Get  /auth-api/like/list
  L54  Get  /public-api/like/count

### WordController  (class-path: <none>)
  L24  Get  /sensitive-word/list
  L30  Post  /sensitive-word
  L36  Put  /sensitive-word
  L42  Delete  /sensitive-word

### WatchController  (class-path: <none>)
  L30  Post  /public-api/watch
  L36  Get  /public-api/watch/count
  L42  Get  /auth-api/watch/page/list
  L48  Get  /public-api/watch/count/group-by

### BaseController  (class-path: <none>)

### CategoryController  (class-path: <none>)
  L32  Get  /category/admin/list
  L39  Get  /category/{id}
  L45  Post  /category
  L51  Put  /category
  L60  Delete  /category/{id}
  L66  Post  /category/image
  L75  Delete  /category/image
  L84  Put  /category/is-show
  L96  Put  /category/is-show-index
  L108  Get  /public-api/category/list

### CircleController  (class-path: <none>)
  L30  Post  /auth-api/circle
  L38  Put  /auth-api/circle
  L44  Delete  /auth-api/circle
  L50  Get  /circle/list
  L56  Get  /public-api/circle/list
  L63  Get  /public-api/circle/list/by-ids
  L70  Get  /public-api/circle
  L76  Get  /public-api/circle/hot/list
  L82  Get  /public-api/circle/member/count
  L93  Get  /auth-api/member/circle/list
  L103  Get  /auth-api/member/join/circle/list

### CircleMemberController  (class-path: <none>)
  L24  Post  /auth-api/member
  L31  Delete  /auth-api/member
  L38  Get  /public-api/member
  L50  Get  /public-api/member/count

### DynamicController  (class-path: <none>)
  L27  Post  /auth-api/dynamic
  L34  Put  /auth-api/dynamic
  L40  Delete  /dynamic
  L46  Delete  /auth-api/dynamic
  L52  Get  /dynamic/list
  L58  Get  /public-api/dynamic/list
  L68  Get  /public-api/dynamic/list/by-ids
  L74  Get  /public-api/dynamic
  L80  Get  /public-api/dynamic/count

### CircleStatisticsController  (class-path: <none>)
  L18  Get  /statistics

### BaseController  (class-path: <none>)

### ArticleController  (class-path: <none>)
  L33  Post  /auth-api/article
  L41  Put  /auth-api/article
  L47  Delete  /auth-api/article
  L53  Get  /article/list
  L59  Get  /public-api/article/list
  L66  Get  /public-api/article/list/by-ids
  L74  Get  /public-api/article
  L85  Post  /article/recommend
  L91  Delete  /article/recommend
  L97  Get  /public-api/article/recommend/list
  L103  Post  /article/top
  L109  Delete  /article/top
  L115  Get  /public-api/article/top/list
  L121  Get  /public-api/article/member/count
  L132  Get  /auth-api/member/article/list

### CategoryController  (class-path: <none>)
  L32  Get  /category/admin/list
  L39  Get  /category/{id}
  L45  Post  /category
  L51  Put  /category
  L60  Delete  /category/{id}
  L66  Post  /category/image
  L75  Delete  /category/image
  L84  Put  /category/is-show
  L96  Put  /category/is-show-index
  L108  Get  /public-api/category/list

### NewsController  (class-path: <none>)
  L31  Post  /news
  L39  Put  /news
  L45  Delete  /news
  L51  Get  /news/list
  L57  Get  /public-api/news/list
  L63  Get  /public-api/news/list/by-ids
  L70  Get  /public-api/news
  L81  Post  /news/recommend
  L87  Delete  /news/recommend
  L93  Get  /public-api/news/recommend/list
  L99  Post  /news/top
  L105  Delete  /news/top
  L111  Get  /public-api/news/top/list

### ContentStatisticsController  (class-path: <none>)
  L18  Get  /statistics

### BaseController  (class-path: <none>)

### CategoryController  (class-path: <none>)
  L32  Get  /category/admin/list
  L39  Get  /category/{id}
  L45  Post  /category
  L51  Put  /category
  L60  Delete  /category/{id}
  L66  Post  /category/image
  L75  Delete  /category/image
  L84  Put  /category/is-show
  L96  Put  /category/is-show-index
  L108  Get  /public-api/category/list

### ExamChapterController  (class-path: <none>)
  L26  Post  /exam/chapter
  L32  Put  /exam/chapter
  L38  Delete  /exam/chapter
  L44  Get  /exam/chapter/list
  L53  Get  /public-api/exam/chapter/list
  L62  Put  /exam/chapter/sort-order

### ExamChapterSectionController  (class-path: <none>)
  L28  Post  /exam/chapter-section
  L34  Put  /exam/chapter-section
  L40  Delete  /exam/chapter-section

### ExamController  (class-path: <none>)
  L31  Post  /exam
  L37  Put  /exam
  L43  Get  /exam/list
  L52  Get  /public-api/exam/list
  L62  Get  /exam
  L68  Get  /public-api/exam
  L78  Delete  /exam
  L84  Put  /exam/publish
  L90  Put  /exam/un-publish
  L96  Get  /public-api/recommend
  L103  Get  /public-api/hot
  L109  Get  /public-api/list/by-ids
  L116  Get  /auth-api/member/sign-up/list

### PaperCategoryController  (class-path: <none>)
  L31  Get  /paper/category/admin/list
  L38  Get  /paper/category/{id}
  L44  Post  /paper/category
  L50  Put  /paper/category
  L59  Delete  /paper/category/{id}
  L65  Put  /paper/category/is-show
  L77  Put  /paper/category/is-show-index
  L89  Get  /paper/category/list

### PaperController  (class-path: <none>)
  L26  Get  /paper
  L32  Get  /auth-api/paper
  L38  Post  /paper
  L44  Put  /paper
  L53  Delete  /paper
  L59  Get  /paper/list
  L65  Put  /paper/publish
  L71  Put  /paper/un-publish

### PaperQuestionController  (class-path: <none>)
  L27  Get  /paper/question/by-paper-id

### QuestionCategoryController  (class-path: <none>)
  L31  Get  /question-lib/category/admin/list
  L38  Get  /question-lib/category/{id}
  L44  Post  /question-lib/category
  L50  Put  /question-lib/category
  L59  Delete  /question-lib/category/{id}
  L65  Put  /question-lib/category/is-show
  L77  Put  /question-lib/category/is-show-index
  L89  Get  /question-lib/category/list

### QuestionController  (class-path: <none>)
  L28  Get  /question-lib/question/{id}
  L34  Post  /question-lib/question
  L40  Put  /question-lib/question
  L49  Delete  /question-lib/question
  L55  Get  /question-lib/question

### RecordController  (class-path: <none>)
  L31  Post  /auth-api/record
  L39  Put  /auth-api/record
  L46  Put  /auth-api/record/submit
  L55  Get  /auth-api/record
  L62  Get  /auth-api/member/sign-up/record/list
  L69  Get  /record/mark/paper/list
  L76  Get  /auth-api/paper/record/list
  L83  Put  /record/manual/mark/paper
  L89  Post  /auth-api/mark/paper
  L103  Get  /record/list
  L109  Get  /auth-api/record/check-submitted

### SignUpController  (class-path: <none>)
  L25  Post  /auth-api/sign-up
  L32  Delete  /auth-api/sign-up
  L39  Get  /public-api/sign-up
  L50  Get  /sign-up/list

### ExamStatisticsController  (class-path: <none>)
  L18  Get  /statistics

### WrongQuestionController  (class-path: <none>)
  L23  Post  /auth-api/wrong-question
  L30  Delete  /auth-api/wrong-question
  L36  Get  /auth-api/wrong-question/list

### BaseController  (class-path: <none>)

### LessonAccessController  (class-path: <none>)
  L25  Put  /lesson/access
  L31  Get  /lesson/access/list

### CategoryController  (class-path: <none>)
  L31  Get  /category/admin/list
  L38  Get  /category/{id}
  L44  Post  /category
  L53  Put  /category
  L62  Delete  /category/{id}
  L68  Put  /category/is-show
  L80  Put  /category/is-show-index
  L92  Get  /public-api/category/list

### CertificateController  (class-path: <none>)
  L24  Post  /certificate
  L30  Get  /certificate/list
  L36  Get  /certificate
  L42  Delete  /certificate
  L48  Put  /certificate/valid
  L54  Put  /certificate/suspended
  L60  Put  /certificate/revoked
  L66  Put  /certificate/cancelled
  L72  Put  /certificate/expired
  L78  Get  /auth-api/certificate
  L84  Get  /auth-api/certificate/byLessonId
  L91  Get  /auth-api/certificate/list

### CertificateTemplateController  (class-path: <none>)
  L25  Post  /certificate-template
  L37  Put  /certificate-template
  L47  Get  /certificate-template/list
  L53  Get  /certificate-template
  L59  Delete  /certificate-template
  L65  Put  /certificate-template/active
  L71  Put  /certificate-template/inactive
  L77  Get  /auth-api/certificate-template

### ExamPaperRecordController  (class-path: <none>)
  L30  Post  /auth-api/exampaper/record
  L44  Put  /auth-api/exampaper/record
  L51  Put  /auth-api/exampaper/record/submit
  L60  Get  /auth-api/exampaper/record
  L67  Get  /auth-api/exampaper/record/draft
  L74  Get  /auth-api/member/sign-up/exampaper/record/list
  L81  Get  /exampaper/record/mark/paper/list
  L88  Get  /auth-api/exampaper/record/list
  L95  Put  /exampaper/record/manual/mark/paper
  L101  Get  /exampaper/record/list
  L107  Get  /auth-api/exampaper/record/check-submitted

### HomeworkController  (class-path: <none>)
  L25  Post  /lesson/homework
  L31  Put  /lesson/homework
  L37  Get  /lesson/homework

### HomeworkRecordController  (class-path: <none>)
  L26  Post  auth-api/homework/record
  L33  Put  auth-api/homework/record
  L40  Put  homework/record/approval/pass
  L47  Put  homework/record/approval/reject
  L54  Get  auth-api/homework/record
  L61  Get  homework/record/list

### LearnMapController  (class-path: <none>)
  L26  Post  /learn-map
  L35  Put  /learn-map
  L41  Get  /learn-map/list
  L48  Get  /learn-map
  L54  Delete  /learn-map
  L60  Put  /learn-map/publish
  L66  Put  /learn-map/un-publish
  L72  Get  /public-api/learn-map/recommend
  L79  Get  /public-api/learn-map/hot
  L85  Get  /public-api/learn-map
  L95  Get  /public-api/learn-map/list
  L101  Get  /auth-api/learn-map/favorite/list

### LessonChapterController  (class-path: <none>)
  L26  Post  /lesson/chapter
  L32  Put  /lesson/chapter
  L38  Delete  /lesson/chapter
  L44  Get  /lesson/chapter/list
  L53  Get  /public-api/lesson/chapter/list
  L62  Put  /lesson/chapter/sort-order

### LessonChapterSectionController  (class-path: <none>)
  L28  Post  /lesson/chapter-section
  L34  Put  /lesson/chapter-section
  L40  Delete  /lesson/chapter-section

### LessonController  (class-path: <none>)
  L31  Post  /lesson
  L41  Put  /lesson
  L47  Put  /lesson/certificate
  L53  Put  /lesson/exampaper
  L59  Get  /lesson/list
  L66  Get  /auth-api/lesson/list
  L73  Get  /lesson
  L79  Delete  /lesson
  L85  Put  /lesson/publish
  L91  Put  /lesson/un-publish
  L97  Get  /public-api/lesson/recommend/list
  L106  Get  /public-api/lesson/hottest/list
  L113  Get  /public-api/lesson/newest/list
  L120  Get  /public-api/lesson
  L131  Get  /public-api/lesson/list
  L140  Get  /public-api/lesson/list/by-ids
  L149  Get  /auth-api/lesson/favorite/list
  L156  Get  /auth-api/lesson/member/learn/list
  L163  Get  /public-api/lesson/count/list

### LessonOrderController  (class-path: <none>)
  L32  Post  /auth-api/lesson/order
  L39  Post  /auth-api/lesson/order/payment
  L45  Post  /public-api/order/payment/callback

### RateController  (class-path: <none>)
  L24  Post  /auth-api/lesson/rate
  L32  Get  /lesson/rate/list
  L38  Get  /lesson/rate
  L44  Delete  /lesson/rate
  L50  Get  /auth-api/lesson/rate
  L58  Get  /auth-api/lesson/rate/list

### RecordController  (class-path: <none>)
  L28  Post  /auth-api/record
  L35  Put  /auth-api/record
  L42  Get  /auth-api/record

### ReportController  (class-path: <none>)
  L25  Get  /report/lesson/sign
  L31  Get  /report/lesson/study
  L37  Get  /report/member/study
  L43  Get  /report/company/member/signup

### SignUpController  (class-path: <none>)
  L32  Post  /auth-api/sign-up
  L39  Post  /auth-api/sign-up/batch
  L45  Post  /public-api/sign-up
  L51  Delete  /auth-api/sign-up
  L58  Get  /public-api/sign-up
  L69  Get  /auth-api/sign-up/total-learn-time
  L81  Get  /auth-api/sign-up/today-learn-time
  L93  Get  /auth-api/sign-up/learn-time-rank-percent
  L105  Get  /sign-up/list
  L111  Get  /sign-up/checkAndUpdateStatus

### StatisticsController  (class-path: <none>)
  L19  Get  /statistics

### LessonTaskController  (class-path: <none>)
  L23  Post  /lesson/task
  L29  Put  /lesson/task
  L35  Delete  /lesson/task
  L41  Get  /lesson/task
  L47  Get  /lesson/task/list
  L53  Put  /lesson/task/enable
  L59  Put  /lesson/task/disable
  L65  Get  /auth-api/lesson/task/list/member-progress

### TopicController  (class-path: <none>)
  L27  Post  /topic
  L36  Put  /topic
  L42  Get  /topic/list
  L49  Get  /topic
  L55  Delete  /topic
  L61  Put  /topic/publish
  L67  Put  /topic/un-publish
  L73  Get  /public-api/topic/recommend
  L80  Get  /public-api/topic/hot
  L86  Get  /public-api/topic
  L96  Get  /public-api/topic/list
  L103  Get  /auth-api/topic/favorite/list

### TopicCategoryController  (class-path: <none>)
  L31  Get  /topic/category/admin/list
  L38  Get  /topic/category/{id}
  L44  Post  /topic/category
  L53  Put  /topic/category
  L62  Delete  /topic/category/{id}
  L68  Put  /topic/category/is-show
  L80  Put  /topic/category/is-show-index
  L92  Get  /public-api/topic/category/list

### BaseController  (class-path: <none>)

### CategoryController  (class-path: <none>)
  L32  Get  /category/admin/list
  L39  Get  /category/{id}
  L45  Post  /category
  L51  Put  /category
  L60  Delete  /category/{id}
  L66  Post  /category/image
  L75  Delete  /category/image
  L84  Put  /category/is-show
  L96  Put  /category/is-show-index
  L108  Get  /public-api/category/list

### ChannelController  (class-path: <none>)
  L31  Post  /channel
  L39  Put  /channel
  L45  Get  /channel/list
  L51  Get  /public-api/channel/list
  L61  Get  /public-api/channel/list/by-ids
  L71  Get  /channel/{id}
  L77  Get  /channel/stream-info/{id}
  L83  Get  /public-api/channel
  L94  Delete  /channel

### LiveStatisticsController  (class-path: <none>)
  L18  Get  /statistics

### SubscribeController  (class-path: <none>)
  L25  Post  /auth-api/subscribe
  L32  Delete  /auth-api/subscribe
  L39  Get  /auth-api/subscribe/count
  L45  Get  /auth-api/subscribe/list/by-channel-id
  L51  Get  /auth-api/subscribe//by-channel-id-and-member-id

### TencentCloudLiveNotifyController  (class-path: <none>)
  L30  Post  /public-api/notify/stream/begin
  L41  Post  /public-api/notify/stream/end

### TencentCloudLiveStreamController  (class-path: <none>)
  L28  Get  /tencent/cloud/live/stream
  L34  Get  /tencent/cloud/live/stream/channel-id
  L40  Get  /tencent/cloud/live/callback/templates

### BaseController  (class-path: <none>)

### MemberController  (class-path: <none>)
  L53  Get  /list
  L59  Get  /unaudited/list
  L66  Get  /auth-api/by-mobile
  L75  Post  /auth-api/create
  L105  Put  /auth-api/update/avatar
  L114  Put  /auth-api/update/avatar/v2
  L124  Put  /auth-api/update/idphoto
  L135  Put  /auth-api/update/name
  L144  Put  /auth-api/update/mobile
  L193  Put  /auth-api/update/pwd
  L235  Put  /auth-api/update/email
  L244  Put  /auth-api/update/password
  L257  Post  /create
  L276  Post  /public-api/register
  L295  Post  /public-api/register/mobile
  L316  Post  /public-api/send/auth-code
  L325  Get  /public-api/by-ids
  L334  Get  /auth-api/by-id
  L343  Get  /auth-api/list
  L362  Put  /auth-api/update/level
  L368  Post  /public-api/pwd/send/auth-code
  L377  Post  /public-api/pwd/check/auth-code
  L389  Put  /public-api/pwd/reset
  L410  Put  /pwd/reset
  L419  Put  /seal
  L428  Put  /unseal
  L437  Put  /update
  L446  Delete  /delete
  L455  Put  /auth-api/update/realname
  L462  Put  /auth-api/update/name/v2
  L469  Put  /approved
  L478  Put  /reject
  L487  Post  /auth-api/createbywechatuserinfo
  L495  Post  /import/excel
  L515  Get  /statistics

### CheckInController  (class-path: <none>)
  L31  Post  /auth-api/check-in
  L37  Get  /public-api/check-in

### MemberCompanyController  (class-path: <none>)
  L26  Post  /company
  L32  Put  /company
  L38  Get  /company/list
  L44  Get  /public-api/company/list
  L50  Delete  /company
  L56  Get  /company
  L63  Put  /company/enable
  L69  Put  /company/disable

### MemberCompanyTypeController  (class-path: <none>)
  L26  Post  /company/type
  L32  Put  /company/type
  L38  Delete  /company/type
  L44  Get  /company/type
  L51  Put  /company/type/enable
  L57  Put  /company/type/disable
  L63  Get  /company/type/list

### FollowController  (class-path: <none>)
  L25  Get  /auth-api/follow/list
  L34  Get  /auth-api/follow/fans/list
  L43  Post  /auth-api/follow
  L50  Put  /auth-api/follow
  L57  Delete  /auth-api/follow
  L64  Get  /auth-api/follow
  L75  Get  /public-api/follow/member/count

### MemberGroupController  (class-path: <none>)
  L25  Get  /group/list
  L31  Post  /group
  L37  Put  /group
  L43  Delete  /group
  L49  Put  /group/enable
  L55  Put  /group/disable

### MemberLevelController  (class-path: <none>)
  L25  Get  /level/list
  L31  Get  /level
  L37  Post  /level
  L43  Put  /level
  L49  Delete  /level

### MemberPostController  (class-path: <none>)
  L25  Get  /post/list
  L31  Post  /post
  L37  Put  /post
  L43  Delete  /post
  L49  Put  /post/enable
  L55  Put  /post/disable

### MemberTagController  (class-path: <none>)
  L25  Get  /tag/list
  L31  Post  /tag
  L37  Put  /tag
  L43  Delete  /tag

### BaseController  (class-path: <none>)

### AnnouncementController  (class-path: <none>)
  L28  Post  /announcement
  L34  Put  /announcement
  L40  Delete  /announcement
  L46  Get  /announcement
  L52  Get  /announcement/list
  L58  Get  /public-api/announcement/list
  L69  Get  /public-api/announcement
  L75  Post  /public-api/announcement/read

### NoticeController  (class-path: <none>)
  L26  Post  /notice
  L32  Delete  /notice
  L38  Get  /notice/list
  L44  Get  /auth-api/notice/list
  L52  Put  /public-api/notice/read

### PrivateLetterController  (class-path: <none>)
  L26  Post  /auth-api/private-letter
  L33  Delete  /auth-api/private-letter
  L39  Get  /auth-api/private-letter
  L45  Get  /auth-api/private-letter/member/list
  L52  Get  /auth-api/private-letter/member
  L59  Get  /auth-api/private-letter/list
  L68  Get  /auth-api/private-letter/new/list

### MessageStatisticsController  (class-path: <none>)
  L18  Get  /statistics

### TemplateController  (class-path: <none>)
  L29  Get  /template/list
  L35  Put  /template

### BaseController  (class-path: <none>)

### MailController  (class-path: <none>)
  L26  Post  /public-api/mail/send
  L32  Post  /public-api/mail/send/html

### SmsController  (class-path: <none>)
  L27  Post  /public-api/sms/send

### BaseController  (class-path: <none>)

### InvoiceApplicationController  (class-path: <none>)
  L24  Post  /auth-api/invoice/application
  L31  Post  /invoice/application
  L37  Put  /auth-api/invoice/application
  L44  Put  /invoice/application
  L50  Get  /auth-api/invoice/application
  L57  Get  /invoice/application/list
  L63  Get  /auth-api/invoice/application/list
  L70  Delete  /auth-api/invoice/application
  L77  Delete  /invoice/application
  L83  Post  /invoice/application/approved
  L89  Post  /invoice/application/rejected
  L95  Post  /invoice/application/invoicing
  L101  Post  /invoice/application/invoiced
  L107  Post  /invoice/application/canceled

### InvoiceTitleController  (class-path: <none>)
  L24  Post  /auth-api/invoice/title
  L33  Post  /invoice/title
  L45  Put  /auth-api/invoice/title
  L52  Put  /invoice/title
  L58  Get  /auth-api/invoice/title
  L65  Get  /invoice/title/list
  L71  Get  /auth-api/invoice/title/list
  L78  Delete  /auth-api/invoice/title
  L85  Delete  /invoice/title

### OrderController  (class-path: <none>)
  L26  Post  /auth-api/order
  L35  Post  /auth-api/order/cancel
  L42  Get  /auth-api/order
  L51  Get  /order/list
  L57  Get  /auth-api/order/list
  L64  Post  /public-api/order/update/status
  L70  Post  /auth-api/order/pre-get-order-amount
  L76  Post  /auth-api/order/get-order-amount
  L83  Post  /auth-api/order/payment

### BaseController  (class-path: <none>)

### OssController  (class-path: <none>)
  L49  Post  /auth-api/{service}/{module}/{fileType}
  L71  Delete  /file
  L84  Post  /auth-api/base64/{service}/{module}/{fileType}
  L105  Get  /to-base64

### BaseController  (class-path: <none>)

### AliPayNotifyController  (class-path: <none>)
  L41  Post  /public-api/alipay/notify

### TradeController  (class-path: <none>)
  L30  Post  /auth-api/trade/payment
  L37  Post  /trade/refund

### WechatpayNotifyController  (class-path: <none>)
  L30  Post  /public-api/wechatpay/notify
  L65  Post  /public-api/wechatpay/notify/v3

### BaseController  (class-path: <none>)

### ChannelController  (class-path: <none>)
  L32  Get  /channel/list
  L38  Get  /channel/all
  L49  Get  /channel
  L55  Post  /channel
  L62  Put  /channel
  L71  Delete  /channel

### PointChannelRelationController  (class-path: <none>)
  L30  Put  /point/channel/relation
  L36  Get  /point/channel/relation/list

### PointController  (class-path: <none>)
  L25  Post  /point
  L32  Put  /point
  L38  Delete  /point
  L44  Get  /point/list
  L50  Get  /point

### RecordController  (class-path: <none>)
  L26  Post  /record/increase
  L34  Post  /record/decrease
  L42  Post  /record/fallback
  L50  Post  /record/recycle
  L58  Get  /record/list
  L64  Get  /auth-api/record/list
  L71  Get  /public-api/member/point

### PointStatisticsController  (class-path: <none>)
  L18  Get  /statistics

### BaseController  (class-path: <none>)

### CategoryController  (class-path: <none>)
  L32  Get  /category/admin/list
  L39  Get  /category/{id}
  L45  Post  /category
  L51  Put  /category
  L60  Delete  /category/{id}
  L66  Post  /category/image
  L75  Delete  /category/image
  L84  Put  /category/is-show
  L96  Put  /category/is-show-index
  L108  Get  /public-api/category/list

### ResourceProductController  (class-path: <none>)
  L29  Post  /resource/product
  L35  Put  /resource/product
  L41  Delete  /resource/product
  L47  Get  /resource/product/page/list
  L53  Get  /resource/product/list
  L59  Get  /public-api/resource/product/list
  L66  Get  /public-api/resource/product
  L72  Put  /resource/product/update-status

### ResourceController  (class-path: <none>)
  L50  Post  /auth-api/resource
  L58  Put  /auth-api/resource
  L64  Delete  /auth-api/resource
  L70  Get  /resource/list
  L76  Get  /public-api/resource/list
  L87  Get  /auth-api/resource/list
  L98  Get  /public-api/resource/list/by-ids
  L104  Get  /public-api/resource
  L114  Post  /auth-api/resource/download
  L163  Get  /public-api/resource/type/list
  L169  Put  /public-api/resource/published
  L175  Get  /auth-api/member/resource/list
  L184  Get  /auth-api/member/download/resource/list
  L191  Get  /auth-api/member/last-search-record
  L203  Get  /public-api/resource/recommend-list

### ResourceStatisticsController  (class-path: <none>)
  L18  Get  /statistics

### ResourceTagController  (class-path: <none>)
  L30  Post  /resource/tag
  L36  Put  /resource/tag
  L42  Delete  /resource/tag
  L48  Get  /resource/tag/page/list
  L54  Get  /resource/tag/list
  L60  Get  /public-api/resource/tag/list
  L68  Get  /public-api/resource/tag
  L74  Put  /resource/tag/update-status

### BaseController  (class-path: <none>)

### WatchController  (class-path: <none>)
  L25  Get  /watch

### BaseController  (class-path: <none>)

### ContentController  (class-path: <none>)
  L31  Post  /public-api/content
  L37  Put  /public-api/content
  L43  Delete  /public-api/content
  L49  Get  /public-api/content
  L60  Get  /public-api/content/type

### HotWordController  (class-path: <none>)
  L24  Get  /hot-word/list
  L30  Get  /public-api/hot-word/list
  L36  Post  /hot-word
  L42  Put  /hot-word
  L48  Delete  /hot-word

### RecordController  (class-path: <none>)
  L24  Get  /record/list

### BaseController  (class-path: <none>)

### AgreementController  (class-path: <none>)
  L24  Post  agreement
  L30  Put  agreement
  L36  Get  public-api/agreement
  L42  Get  agreement/page

### CarouselController  (class-path: <none>)
  L31  Get  /public-api/carousel
  L40  Post  /carousel

### BaseController  (class-path: <none>)

### CompanyController  (class-path: <none>)
  L27  Post  /company
  L33  Put  /company
  L39  Get  /company/list

### DepartmentController  (class-path: <none>)
  L30  Get  /department/list
  L45  Post  /department
  L54  Get  /department
  L63  Put  /department
  L69  Delete  /department
  L79  Get  /department/by-user-id

### PostController  (class-path: <none>)
  L24  Post  /posts
  L35  Delete  /posts/{id}
  L46  Put  /posts
  L56  Get  /posts
  L66  Get  /posts/{id}

### UserController  (class-path: <none>)
  L27  Get  /auth-api/by-mobile
  L33  Get  /auth-api/by-id
  L39  Post  /auth-api/create
  L64  Get  /list
  L79  Post  /user
  L86  Put  /user
  L92  Put  /user/info
  L98  Put  /user/pwd
  L104  Delete  /user
  L114  Put  /user/reset/pwd

### DingTalkController  (class-path: <none>)
  L37  Get  /public-api/ding-talk/config
  L46  Get  /public-api/ding-talk/user/by-code

### LecturerController  (class-path: <none>)
  L24  Post  /lecturer
  L30  Put  /lecturer
  L36  Delete  /lecturer
  L42  Get  /lecturer/list
  L48  Get  /lecturer
  L54  Get  /public-api/lecturer

### UserCenterStatisticsController  (class-path: <none>)
  L18  Get  /statistics

### WechatOauthController  (class-path: <none>)
  L29  Get  /public-api/wechat/oauth-config
  L35  Get  /public-api/wechat/oauth-config/userinfo-bycode

### WorkWeChatController  (class-path: <none>)
  L39  Get  /work-we-chat/token
  L45  Get  /public-api/work-we-chat/config
  L55  Get  /public-api/work-we-chat/user/by-code

### BaseController  (class-path: <none>)

### VisitLogController  (class-path: <none>)
  L36  Post  /public-api/visit-log
  L51  Get  /visit-log/summary
  L57  Get  /visit-log/day/pv/list
  L63  Get  /visit-log/day/uv/list
  L69  Get  /visit-log/ip-city/summary/list

### BaseController  (class-path: <none>)

```

## 2. edu client/service (Java 微服务源码副本)

- Controller 数: 132
- HTTP 端点数: 678

### Controller 清单
- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/biz/answer/web/AnswerController.java`
- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/biz/category/web/CategoryController.java`
- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/biz/question/web/QuestionController.java`
- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/biz/statistics/web/AskStatisticsController.java`
- `ihui-ai-edu-ask-service/src/main/java/com/yjs/cloud/learning/ask/common/controller/BaseController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/biz/authority/web/AuthorityController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/biz/jwt/web/AuthController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/biz/jwt/web/KeyPairController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/biz/role/web/RoleController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/biz/sso/web/SsoController.java`
- `ihui-ai-edu-auth-service/src/main/java/com/yjs/cloud/learning/auth/common/controller/BaseController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/comment/web/CommentController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/favorites/web/FavoriteController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/like/web/LikeController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/sensitiveword/web/WordController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/biz/watch/web/WatchController.java`
- `ihui-ai-edu-behavior-service/src/main/java/com/yjs/cloud/learning/behavior/common/controller/BaseController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/category/web/CategoryController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/circle/web/CircleController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/circle/web/CircleMemberController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/dynamic/web/DynamicController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/biz/statistics/web/CircleStatisticsController.java`
- `ihui-ai-edu-circle-service/src/main/java/com/yjs/cloud/learning/circle/common/controller/BaseController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/biz/article/web/ArticleController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/biz/category/web/CategoryController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/biz/news/web/NewsController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/biz/statistics/web/ContentStatisticsController.java`
- `ihui-ai-edu-content-service/src/main/java/com/yjs/cloud/learning/content/common/controller/BaseController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/category/web/CategoryController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/exam/web/ExamChapterController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/exam/web/ExamChapterSectionController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/exam/web/ExamController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/paper/category/web/PaperCategoryController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/paper/web/PaperController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/paper/web/PaperQuestionController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/questionlib/category/web/QuestionCategoryController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/questionlib/question/web/QuestionController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/record/web/RecordController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/signup/web/SignUpController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/statistics/web/ExamStatisticsController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/biz/wrongquestion/web/WrongQuestionController.java`
- `ihui-ai-edu-exam-service/src/main/java/com/yjs/cloud/learning/exam/common/controller/BaseController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/access/web/LessonAccessController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/category/web/CategoryController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/certificate/web/CertificateController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/certificate/web/CertificateTemplateController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/exampaper/web/ExamPaperRecordController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/homework/web/HomeworkController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/homework/web/HomeworkRecordController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/learnmap/web/LearnMapController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/lesson/web/LessonChapterController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/lesson/web/LessonChapterSectionController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/lesson/web/LessonController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/order/web/LessonOrderController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/rate/web/RateController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/record/web/RecordController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/report/web/ReportController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/signup/web/SignUpController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/statistics/web/StatisticsController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/task/web/LessonTaskController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/topic/web/TopicController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/biz/topiccategory/web/TopicCategoryController.java`
- `ihui-ai-edu-learn-service/src/main/java/com/yjs/cloud/learning/learn/common/controller/BaseController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/category/web/CategoryController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/channel/web/ChannelController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/statistics/web/LiveStatisticsController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/subscribe/web/SubscribeController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/tencent/web/TencentCloudLiveNotifyController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/biz/tencent/web/TencentCloudLiveStreamController.java`
- `ihui-ai-edu-live-service/src/main/java/com/yjs/cloud/learning/live/common/controller/BaseController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/base/web/MemberController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/checkin/web/CheckInController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/company/web/MemberCompanyController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/company/web/MemberCompanyTypeController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/follow/web/FollowController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/group/web/MemberGroupController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/level/web/MemberLevelController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/post/web/MemberPostController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/biz/tags/web/MemberTagController.java`
- `ihui-ai-edu-member-service/src/main/java/com/yjs/cloud/learning/member/common/controller/BaseController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/announcement/web/AnnouncementController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/notice/web/NoticeController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/privateletter/web/PrivateLetterController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/statistics/web/MessageStatisticsController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/biz/template/web/TemplateController.java`
- `ihui-ai-edu-message-service/src/main/java/com/yjs/cloud/learning/message/common/controller/BaseController.java`
- `ihui-ai-edu-notification-service/src/main/java/com/yjs/cloud/learning/notification/biz/email/web/MailController.java`
- `ihui-ai-edu-notification-service/src/main/java/com/yjs/cloud/learning/notification/biz/sms/web/SmsController.java`
- `ihui-ai-edu-notification-service/src/main/java/com/yjs/cloud/learning/notification/common/controller/BaseController.java`
- `ihui-ai-edu-order-service/src/main/java/com/yjs/cloud/learning/order/biz/invoice/web/InvoiceApplicationController.java`
- `ihui-ai-edu-order-service/src/main/java/com/yjs/cloud/learning/order/biz/invoice/web/InvoiceTitleController.java`
- `ihui-ai-edu-order-service/src/main/java/com/yjs/cloud/learning/order/biz/order/web/OrderController.java`
- `ihui-ai-edu-order-service/src/main/java/com/yjs/cloud/learning/order/common/controller/BaseController.java`
- `ihui-ai-edu-oss-service/src/main/java/com/yjs/cloud/learning/oss/biz/base/web/OssController.java`
- `ihui-ai-edu-oss-service/src/main/java/com/yjs/cloud/learning/oss/common/controller/BaseController.java`
- `ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/alipay/web/AliPayNotifyController.java`
- `ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/base/web/TradeController.java`
- `ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay/web/WechatpayNotifyController.java`
- `ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/common/controller/BaseController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/channel/web/ChannelController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/point/web/PointChannelRelationController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/point/web/PointController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/record/web/RecordController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/biz/statistics/web/PointStatisticsController.java`
- `ihui-ai-edu-point-service/src/main/java/com/yjs/cloud/learning/point/common/controller/BaseController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/category/web/CategoryController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/product/web/ResourceProductController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/resource/web/ResourceController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/statistics/web/ResourceStatisticsController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/biz/tag/web/ResourceTagController.java`
- `ihui-ai-edu-resource-service/src/main/java/com/yjs/cloud/learning/resource/common/controller/BaseController.java`
- `ihui-ai-edu-schedule-service/src/main/java/com/yjs/cloud/learning/schedule/biz/watch/web/WatchController.java`
- `ihui-ai-edu-schedule-service/src/main/java/com/yjs/cloud/learning/schedule/common/controller/BaseController.java`
- `ihui-ai-edu-search-service/src/main/java/com/yjs/cloud/learning/search/biz/content/web/ContentController.java`
- `ihui-ai-edu-search-service/src/main/java/com/yjs/cloud/learning/search/biz/hotword/web/HotWordController.java`
- `ihui-ai-edu-search-service/src/main/java/com/yjs/cloud/learning/search/biz/record/web/RecordController.java`
- `ihui-ai-edu-search-service/src/main/java/com/yjs/cloud/learning/search/common/controller/BaseController.java`
- `ihui-ai-edu-setting-service/src/main/java/com/yjs/cloud/learning/setting/biz/agreement/web/AgreementController.java`
- `ihui-ai-edu-setting-service/src/main/java/com/yjs/cloud/learning/setting/biz/carousel/web/CarouselController.java`
- `ihui-ai-edu-setting-service/src/main/java/com/yjs/cloud/learning/setting/common/controller/BaseController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/base/company/web/CompanyController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/base/department/web/DepartmentController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/base/post/web/PostController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/base/user/web/UserController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/dingtalk/web/DingTalkController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/lecturer/web/LecturerController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/statistics/web/UserCenterStatisticsController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat/web/WechatOauthController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat/web/WorkWeChatController.java`
- `ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/common/controller/BaseController.java`
- `ihui-ai-edu-visit-tracking-service/src/main/java/com/yjs/cloud/learning/visittracking/biz/visit/web/VisitLogController.java`
- `ihui-ai-edu-visit-tracking-service/src/main/java/com/yjs/cloud/learning/visittracking/common/controller/BaseController.java`

## 3. edu client/web (Vue 3 学习端 PC 前端)

### 3.1 路由文件
- `/d/历史项目存档/edu client/web/web/src/components/RouterGuard/routerGuardLoadScript.js`
- `/d/历史项目存档/edu client/web/web/src/router`

### 3.2 views 页面清单
- `src/views/about/index.vue`
- `src/views/agreement/index.vue`
- `src/views/announcement/components/oneannouncement/index.vue`
- `src/views/announcement/detail/index.vue`
- `src/views/announcement/index.vue`
- `src/views/article/detail.vue`
- `src/views/article/edit.vue`
- `src/views/article/hotArticle.vue`
- `src/views/article/index.vue`
- `src/views/ask/edit.vue`
- `src/views/ask/index.vue`
- `src/views/ask/question/index.vue`
- `src/views/circle/detail.vue`
- `src/views/circle/edit.vue`
- `src/views/circle/index.vue`
- `src/views/comment/drawer/commentDrawer.vue`
- `src/views/comment/edit.vue`
- `src/views/comment/list.vue`
- `src/views/exam/detail/index.vue`
- `src/views/exam/index.vue`
- `src/views/exam/list/index.vue`
- `src/views/exam/paper/detail/index.vue`
- `src/views/exam/paper/index.vue`
- `src/views/feedback/index.vue`
- `src/views/help/index.vue`
- `src/views/index/article.vue`
- `src/views/index/circle.vue`
- `src/views/index/content.vue`
- `src/views/index/exam.vue`
- `src/views/index/index.vue`
- `src/views/index/question.vue`
- `src/views/index/resource.vue`
- `src/views/learn/buyconfirm/index.vue`
- `src/views/learn/certificate/download/index.vue`
- `src/views/learn/certificate/index.vue`
- `src/views/learn/detail/index.vue`
- `src/views/learn/homework/index.vue`
- `src/views/learn/index.vue`
- `src/views/learn/list/index.vue`
- `src/views/learn/map/index.vue`
- `src/views/learn/navMenu.vue`
- `src/views/learn/payment/confirm/index.vue`
- `src/views/learn/payment/index.vue`
- `src/views/learn/rate/index.vue`
- `src/views/learn/topic/detail/index.vue`
- `src/views/learn/topic/index.vue`
- `src/views/live/detail/index.vue`
- `src/views/live/detail/play.vue`
- `src/views/live/list/index.vue`
- `src/views/member/article/index.vue`
- `src/views/member/ask/index.vue`
- `src/views/member/certificate/index.vue`
- `src/views/member/circle/index.vue`
- `src/views/member/comment/commentItem.vue`
- `src/views/member/comment/index.vue`
- `src/views/member/detail/index.vue`
- `src/views/member/exam/record/index.vue`
- `src/views/member/exam/sign-up/index.vue`
- `src/views/member/exam/wrong/index.vue`
- `src/views/member/fans/index.vue`
- `src/views/member/favorites/index.vue`
- `src/views/member/follow/index.vue`
- `src/views/member/learn-record/index.vue`
- `src/views/member/menu/index.vue`
- `src/views/member/personal/index.vue`
- `src/views/member/point/index.vue`
- `src/views/member/resource/index.vue`
- `src/views/member/setting/index.vue`
- `src/views/message/comment.vue`
- `src/views/message/fans.vue`
- `src/views/message/favorite.vue`
- `src/views/message/index.vue`
- `src/views/message/like.vue`
- `src/views/message/notice.vue`
- `src/views/message/privateLetter.vue`
- `src/views/module/banner.vue`
- `src/views/module/bigRowTabs.vue`
- `src/views/module/component/bigRectangle.vue`
- `src/views/module/component/bigRowTabsContent.vue`
- `src/views/module/component/middleRectangle.vue`
- `src/views/module/component/rectangle.vue`
- `src/views/module/component/rowTabsContent.vue`
- `src/views/module/component/tabsBar.vue`
- `src/views/module/hot.vue`
- `src/views/module/rowTabs.vue`
- `src/views/news/detail.vue`
- `src/views/news/hotNews.vue`
- `src/views/news/index.vue`
- `src/views/resource/detail.vue`
- `src/views/resource/edit.vue`
- `src/views/resource/list/index.vue`
- `src/views/resource/resourceItem.vue`
- `src/views/resource/right-module/index.vue`
- `src/views/search/index.vue`

### 3.3 components 组件清单 (前 200)
- `src/components/Breadcrumb/index.vue`
- `src/components/Footer.vue`
- `src/components/ForgetPwd.vue`
- `src/components/Hamburger/index.vue`
- `src/components/Header.vue`
- `src/components/Layout.vue`
- `src/components/Login/index.vue`
- `src/components/NavMenu.vue`
- `src/components/Page/index.vue`
- `src/components/SvgIcon.vue`
- `src/components/Tinymce/components/EditorImage.vue`
- `src/components/Tinymce/index.vue`
- `src/components/Uplaod/index.vue`
- `src/components/Video/index.vue`
- `src/components/WangEditor/index.vue`
- `src/components/WangEditor/show.vue`
- `src/components/cascader/index.vue`
- `src/components/editor/index.vue`

### 3.4 API 调用清单
- `src/api`

## 4. edu client/admin (Vue 3 Admin 前端)

### 4.1 views 页面清单
- `src/views/account/index.vue`
- `src/views/account/security/index.vue`
- `src/views/article/category/edit.vue`
- `src/views/article/category/index.vue`
- `src/views/article/category/tree.vue`
- `src/views/article/content/index.vue`
- `src/views/article/index.vue`
- `src/views/ask/category/edit.vue`
- `src/views/ask/category/index.vue`
- `src/views/ask/category/tree.vue`
- `src/views/ask/index.vue`
- `src/views/ask/question/index.vue`
- `src/views/auth/authority/index.vue`
- `src/views/auth/index.vue`
- `src/views/auth/role/edit.vue`
- `src/views/auth/role/index.vue`
- `src/views/certificate/index.vue`
- `src/views/certificate/preview/index.vue`
- `src/views/certificate/template/edit/index.vue`
- `src/views/certificate/template/index.vue`
- `src/views/circle/category/edit.vue`
- `src/views/circle/category/index.vue`
- `src/views/circle/category/tree.vue`
- `src/views/circle/dynamic/index.vue`
- `src/views/circle/index.vue`
- `src/views/circle/list/index.vue`
- `src/views/comment/commentDrawer.vue`
- `src/views/comment/commentItem.vue`
- `src/views/comment/index.vue`
- `src/views/comment/list.vue`
- `src/views/comment/list/index.vue`
- `src/views/comment/sensitive-word/index.vue`
- `src/views/error/Unauthorized.vue`
- `src/views/exam/answer/detail/index.vue`
- `src/views/exam/answer/list/index.vue`
- `src/views/exam/answer/mark/index.vue`
- `src/views/exam/category/edit.vue`
- `src/views/exam/category/index.vue`
- `src/views/exam/category/tree.vue`
- `src/views/exam/index.vue`
- `src/views/exam/list/edit.vue`
- `src/views/exam/list/index.vue`
- `src/views/exam/paper/category/edit.vue`
- `src/views/exam/paper/category/index.vue`
- `src/views/exam/paper/category/tree.vue`
- `src/views/exam/paper/index.vue`
- `src/views/exam/paper/mock/index.vue`
- `src/views/exam/paper/normal/index.vue`
- `src/views/exam/paper/random/index.vue`
- `src/views/exam/question-lib/category/edit.vue`
- `src/views/exam/question-lib/category/index.vue`
- `src/views/exam/question-lib/category/tree.vue`
- `src/views/exam/question-lib/fill-blank/index.vue`
- `src/views/exam/question-lib/index.vue`
- `src/views/exam/question-lib/judgment/index.vue`
- `src/views/exam/question-lib/multi-choice/index.vue`
- `src/views/exam/question-lib/single-choice/index.vue`
- `src/views/exam/question-lib/subjective/index.vue`
- `src/views/home/Index.vue`
- `src/views/learn/category/edit/index.vue`
- `src/views/learn/category/index.vue`
- `src/views/learn/category/tree/index.vue`
- `src/views/learn/index.vue`
- `src/views/learn/lesson/edit/index.vue`
- `src/views/learn/lesson/index.vue`
- `src/views/learn/lesson/trash/index.vue`
- `src/views/learn/map/edit/index.vue`
- `src/views/learn/map/index.vue`
- `src/views/learn/order/index.vue`
- `src/views/learn/order/invoice/application/index.vue`
- `src/views/learn/order/invoice/title/index.vue`
- `src/views/learn/report/companystudy/index.vue`
- `src/views/learn/report/lessonstudy/index.vue`
- `src/views/learn/report/memberstudy/index.vue`
- `src/views/learn/report/signup/index.vue`
- `src/views/learn/signup/batch/index.vue`
- `src/views/learn/signup/batchlesson/index.vue`
- `src/views/learn/signup/record/index.vue`
- `src/views/learn/topic/category/edit/index.vue`
- `src/views/learn/topic/category/index.vue`
- `src/views/learn/topic/category/tree/index.vue`
- `src/views/learn/topic/edit/index.vue`
- `src/views/learn/topic/index.vue`
- `src/views/live/category/edit.vue`
- `src/views/live/category/index.vue`
- `src/views/live/category/tree.vue`
- `src/views/live/channel/edit.vue`
- `src/views/live/channel/index.vue`
- `src/views/live/index.vue`
- `src/views/live/lecturer/edit.vue`
- `src/views/live/lecturer/index.vue`
- `src/views/login/Index.vue`
- `src/views/login/Login.vue`
- `src/views/login/dingTalk.vue`
- `src/views/login/workWeChat.vue`
- `src/views/member/company/index.vue`
- `src/views/member/company/type/index.vue`
- `src/views/member/group/index.vue`
- `src/views/member/index.vue`
- `src/views/member/level/index.vue`
- `src/views/member/list/index.vue`
- `src/views/member/list/index1.vue`
- `src/views/member/post/index.vue`
- `src/views/member/tag/index.vue`
- `src/views/member/unaudited/index.vue`
- `src/views/message/announcement/index.vue`
- `src/views/message/index.vue`
- `src/views/news/content/edit.vue`
- `src/views/news/content/index.vue`
- `src/views/news/index.vue`
- `src/views/organizational/department/edit.vue`
- `src/views/organizational/department/index.vue`
- `src/views/organizational/department/tree.vue`
- `src/views/organizational/index.vue`
- `src/views/organizational/user/edit.vue`
- `src/views/organizational/user/index.vue`
- `src/views/organizational/user/tree.vue`
- `src/views/point/channel/index.vue`
- `src/views/point/index.vue`
- `src/views/point/list/index.vue`
- `src/views/point/record/index.vue`
- `src/views/resource/category/edit.vue`
- `src/views/resource/category/index.vue`
- `src/views/resource/category/tree.vue`
- `src/views/resource/index.vue`
- `src/views/resource/list/index.vue`
- `src/views/resource/product/edit.vue`
- `src/views/resource/product/index.vue`
- `src/views/resource/product/tree.vue`
- `src/views/resource/tag/edit.vue`
- `src/views/resource/tag/index.vue`
- `src/views/resource/tag/tree.vue`
- `src/views/search/hot-word/index.vue`
- `src/views/search/index.vue`
- `src/views/setting/agreement/index.vue`
- `src/views/setting/carousel/choiceImage.vue`
- `src/views/setting/carousel/choiceLink.vue`
- `src/views/setting/carousel/index.vue`
- `src/views/setting/index.vue`

### 4.2 components 组件清单
- `src/components/Aside.vue`
- `src/components/Breadcrumb/index.vue`
- `src/components/Footer.vue`
- `src/components/Hamburger/index.vue`
- `src/components/Header.vue`
- `src/components/Layout.vue`
- `src/components/LayoutEmpty.vue`
- `src/components/LayoutHeader.vue`
- `src/components/LayoutNotAside.vue`
- `src/components/Page/index.vue`
- `src/components/SvgIcon.vue`
- `src/components/Tinymce/components/EditorImage.vue`
- `src/components/Tinymce/index.vue`
- `src/components/Uplaod/index.vue`
- `src/components/Video/index.vue`
- `src/components/WangEditor/index.vue`
- `src/components/WangEditor/show.vue`

## 5. ihui-ai-admin-frontend (RuoYi 3.6.5 管理端)


## 6. Ai-WXMiniVue (uniapp 多端: 微信小程序 + H5 + App)

### 6.1 pages 页面清单
- `src/pages/distribution/EarningsStatisticsCard/index.vue`
- `src/pages/distribution/FunctionBlockColumn/index.vue`
- `src/pages/distribution/PersonalInformationCard/index.vue`
- `src/pages/distribution/index.vue`
- `src/pages/distribution_order_list/index.vue`
- `src/pages/distribution_personnel_list/detail.vue`
- `src/pages/distribution_personnel_list/index.vue`
- `src/pages/income/components/EarningsStatisticsCard/index.vue`
- `src/pages/income/components/accumulation/index.vue`
- `src/pages/income/components/datas.vue`
- `src/pages/income/components/select/index.vue`
- `src/pages/income/index.vue`
- `src/pages/income/withdraw/index.vue`
- `src/pages/learn/learn.vue`
- `src/pages/login-app-other/changePhone.vue`
- `src/pages/login-app-other/changePwd.vue`
- `src/pages/login-app-other/register.vue`
- `src/pages/login-app/changePhone.vue`
- `src/pages/login-app/login.vue`
- `src/pages/login-app/register.vue`
- `src/pages/login/index.vue`
- `src/pages/member/index.vue`
- `src/pages/table/aiIndex/ai_index.vue`
- `src/pages/table/settings/index.vue`
- `src/pages/table/settings/privacy-policy.vue`
- `src/pages/table/share/components/Interest-track-modal.vue`
- `src/pages/table/share/components/center-item/index.vue`
- `src/pages/table/share/components/information-item/index.vue`
- `src/pages/table/share/components/new-title/index.vue`
- `src/pages/table/share/components/title-switch/index.vue`
- `src/pages/table/share/index.vue`
- `src/pages/table/square/index.vue`
- `src/pages/table/tools/category-detail.vue`
- `src/pages/table/tools/components/Ai-list_b.vue`
- `src/pages/table/tools/components/Intelligent-assistant.vue`
- `src/pages/table/tools/components/MyAgents.vue`
- `src/pages/table/tools/components/RecentAgents.vue`
- `src/pages/table/tools/index.vue`
- `src/pages/table/user/UserInfoCard/UserInfoCard.vue`
- `src/pages/table/user/UserInfoCard/UserInfoCardOld.vue`
- `src/pages/table/user/components/user_cards.vue`
- `src/pages/table/user/index.vue`
- `src/pages/table/user/loginPopUp/index.vue`
- `src/pages/table/user/loginPopUp/indexOld.vue`
- `src/pages/table/user/window.vue`
- `src/pages/tools/ai_assistant.vue`
- `src/pages/tools/ai_assistant_n8n.vue`
- `src/pages/tools/ai_group/ai_group_card.vue`
- `src/pages/tools/ai_group/drawer_left.vue`
- `src/pages/tools/ai_group/index.vue`
- `src/pages/tools/ai_index2 copy.vue`
- `src/pages/tools/ai_index2.vue`
- `src/pages/tools/ai_index3.vue`
- `src/pages/tools/aigc/components/video.vue`
- `src/pages/tools/aigc/cover.vue`
- `src/pages/tools/aigc/index.vue`
- `src/pages/tools/aigc/publish.vue`
- `src/pages/tools/components/Ai-list.vue`
- `src/pages/tools/components/AiModelCard/index.vue`
- `src/pages/tools/components/Carousel/index.vue`
- `src/pages/tools/components/CommissionFloatingIcon/index.vue`
- `src/pages/tools/components/DrawerComponent.vue`
- `src/pages/tools/components/ModelList.vue`
- `src/pages/tools/components/navigation-bars/indexc.vue`
- `src/pages/tools/model-plaza/index.vue`
- `src/pages/tools/ranking-detail.vue`
- `src/pages/tools/token_value.vue`
- `src/pages/tools/top-bars/index.vue`
- `src/pages/tools/top-bars/search.vue`
- `src/pages/tools/top-bars/tabbar.vue`
- `src/pages/user_order_list/index.vue`
- `src/pages/user_order_list/indexOld.vue`

### 6.2 pages.json (路由配置)
- `src/pages.json` (存在)

### 6.3 api 调用清单
- `src/api/payment.js`

## 7. share-h5 (分享 H5)

### 7.1 页面清单
- `src/App.vue`
- `src/pages/ErrorPage.vue`
- `src/pages/SharePage.vue`

## 8. ljd-交接文件/ZHS_Server_java (Spring Boot 单体)

- Controller 数: 39

### 8.1 Controller 清单
- `src/main/java/com/ai/manager/app/controller/AuthorizationManagementController.java`
- `src/main/java/com/ai/manager/app/controller/PayManagementController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsCategoryDictionaryController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsCourseController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsCoursePayLogController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsCoursePlatformLogController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsCourseVideoController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsEducationPlatformController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsUserCommentLogController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsUserPlatformController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsUserVideoCommentController.java`
- `src/main/java/com/ai/manager/course/controller/ZhsUserVideoLogController.java`
- `src/main/java/com/ai/manager/mcp/controller/AliAIController.java`
- `src/main/java/com/ai/manager/mcp/controller/Gemini3ProPreviewController.java`
- `src/main/java/com/ai/manager/mcp/controller/KlingAIController.java`
- `src/main/java/com/ai/manager/mcp/controller/McpResourceController.java`
- `src/main/java/com/ai/manager/mcp/controller/Sora2Controller.java`
- `src/main/java/com/ai/manager/mcp/controller/SunoController.java`
- `src/main/java/com/ai/manager/mcp/controller/TBoxController.java`
- `src/main/java/com/ai/manager/mcp/controller/ZhsAgentController.java`
- `src/main/java/com/ai/manager/small/controller/AgentUploadController.java`
- `src/main/java/com/ai/manager/small/controller/AiBotSitesController.java`
- `src/main/java/com/ai/manager/small/controller/AiUserFeedbackController.java`
- `src/main/java/com/ai/manager/small/controller/AppVersionController.java`
- `src/main/java/com/ai/manager/small/controller/DistributionController.java`
- `src/main/java/com/ai/manager/small/controller/DistributionNowController.java`
- `src/main/java/com/ai/manager/small/controller/LoginController.java`
- `src/main/java/com/ai/manager/small/controller/RemoteDeviceByTaskController.java`
- `src/main/java/com/ai/manager/small/controller/ResourceController.java`
- `src/main/java/com/ai/manager/small/controller/ResourceNowController.java`
- `src/main/java/com/ai/manager/small/controller/UsersController.java`
- `src/main/java/com/ai/manager/small/controller/WXPayNowController.java`
- `src/main/java/com/ai/manager/small/controller/ZhsActivityController.java`
- `src/main/java/com/ai/manager/small/controller/ZhsAgentBuyController.java`
- `src/main/java/com/ai/manager/small/controller/ZhsAgentExamineController.java`
- `src/main/java/com/ai/manager/small/controller/ZhsCommissionFlowController.java`
- `src/main/java/com/ai/manager/small/controller/ZhsInformationController.java`
- `src/main/java/com/ai/manager/small/controller/ZhsProductIdentityController.java`
- `src/main/java/com/ai/manager/small/controller/ZhsWithdrawalController.java`

### 8.2 HTTP 端点
### AuthorizationManagementController
  L21  Get  /get/{uuid}
  L27  Post  /remove
### PayManagementController
  L20  Post  /wx/android
### ZhsCategoryDictionaryController
  L33  Get  /list
  L40  Get  /get/parent
### ZhsCourseController
  L41  Get  /list
  L60  Get  /{id}
  L95  Delete  /{ids}
  L104  Post  /delist/{ids}
### ZhsCoursePayLogController
  L30  Get  /list
### ZhsCoursePlatformLogController
  L31  Get  /list
  L42  Get  /{id}
  L70  Delete  /{ids}
### ZhsCourseVideoController
  L39  Get  /list
  L58  Get  /list/login
  L83  Get  /{id}
  L104  Post  /batch
  L125  Delete  /{ids}
  L132  Get  /move/{videoId}/{type}
  L141  Post  /issue/{ids}
### ZhsEducationPlatformController
  L31  Get  /list
  L42  Get  /{sort}
  L70  Delete  /{sorts}
### ZhsUserCommentLogController
  L32  Get  /list
  L43  Get  /{id}
  L72  Delete  /{ids}
### ZhsUserPlatformController
  L31  Get  /{userId}
### ZhsUserVideoCommentController
  L33  Get  /list
  L58  Delete  /{ids}
  L68  Get  /list/up
### ZhsUserVideoLogController
  L37  Get  /list
  L53  Get  /operate/{videoId}/{type}
  L69  Delete  /{ids}
### AliAIController
  L37  Post  /generate/timbre
  L53  Get  /audio/sys
  L70  Post  /video/to/digital
  L116  Get  /get/digital/{type}
### Gemini3ProPreviewController
  L39  Post  /3/generate
### KlingAIController
  L26  Post  /generate/video
  L37  Get  /video/info/{id}
### McpResourceController
  L22  Get  /video/to/audio
### Sora2Controller
  L26  Post  /sora2/generate/video
  L37  Get  /sora2/video/info/{id}
  L38  Post  /sora2/video/info
### SunoController
  L39  Post  /generate/music
### TBoxController
  L35  Post  /agent/channel/deploy
### ZhsAgentController
  L64  Get  /rule/search
  L107  Get  /rule/search/bylink
  L146  Get  /rule/list
  L156  Post  /query/personality
  L182  Get  /use/history
  L199  Post  /creation/my/{type}
  L209  Post  /creation/share
  L240  Get  /creation/operate/{gcId}/{type}
  L249  Get  /creation/share/third/{code}
  L260  Post  /creation/share/code
  L298  Post  /creation/image
### AgentUploadController
  L22  Post  /upload
  L27  Get  /select
  L36  Post  /process
### AiBotSitesController
  L22  Get  /kind
### AiUserFeedbackController
  L32  Get  /list
  L45  Get  /{id}
  L77  Delete  /{ids}
### AppVersionController
  L33  Get  /list
  L45  Get  /{id}
  L76  Delete  /{ids}
  L84  Get  /{appId}/{version}
### DistributionController
  L29  Get  /getSubordinates
  L46  Post  /getUserAndChildrenOrders
  L60  Get  /getOperatorDataCardData
  L73  Get  /getUserInviteeOrderStats
  L85  Get  /getUserCommissionDetail
### DistributionNowController
### LoginController
  L43  Post  /getOpenId
  L67  Post  /getPhoneNumber
  L89  Post  /editWxOpenId
  L108  Get  /getWxCode
  L145  Post  /login
  L174  Post  /bind
  L197  Post  /uploadBusinessCard
  L230  Get  /getMinioFile
  L253  Get  /get/url/link
  L260  Delete  /cancel
### RemoteDeviceByTaskController
  L26  Post  /need/task/add
  L33  Post  /need/task
  L42  Get  /need/task/{id}
### ResourceController
  L29  Get  /homeResource
  L42  Get  /plantInformation
  L56  Get  /recharge
  L69  Get  /selectsGoods
  L77  Get  /getCoursePlanet
  L84  Get  /getKnowledgePlanet
  L91  Post  /addUserAgentFreeTime
  L106  Get  /getUserAgentFreeTime
  L116  Get  /getHomePageResources
  L126  Get  /banner
  L133  Post  /addSharePlanetPublic
  L140  Get  /getCoursePlanetCategorized
  L150  Post  /postPopularCourses
  L160  Post  /postHomeInformation
  L167  Get  /getKnowledgePlanetCategorizedInfo
### ResourceNowController
  L70  Post  /getTokenCount
  L102  Post  /getTokenReturn
  L125  Get  /getAccessToken
  L137  Get  /getAgentList
  L148  Get  /getAgent
  L190  Get  /getAgent2
  L219  Post  /saveUserContext
  L243  Get  /getUserContext
  L253  Get  /getUserContext/field
  L263  Post  /remove/context/field
  L286  Post  /fileUpload
  L300  Get  /developer/price
  L307  Post  /fileUploadNetworkPath
  L320  Get  /first/share
  L328  Get  /first/share/show
  L361  Get  /download/watermark
### UsersController
  L28  Get  /info/{uuid}
### WXPayNowController
  L49  Post  /initiatePay
  L73  Post  /app/initiatePay
  L99  Post  /updateStatus
  L115  Post  /queryOrderById
  L125  Post  /notify
  L146  Post  /queryOrderByOutTradeNo
  L157  Post  /closeOrder
  L174  Post  /refunds
  L186  Post  /transferNotify
  L208  Post  /course/notify
  L227  Get  /consecutively/product
### ZhsActivityController
  L33  Get  /get
  L44  Get  /{id}
### ZhsAgentBuyController
  L30  Get  /list
  L44  Get  /{id}
  L114  Delete  /{ids}
  L142  Get  /user/{bugUuid}/agent/{agentId}
  L157  Get  /order/{orderNo}
  L171  Get  /unsettled
  L185  Get  /expired
  L199  Put  /{id}/expire
  L227  Put  /{id}/settle
### ZhsAgentExamineController
  L31  Get  /list
  L49  Get  /{id}
  L78  Delete  /{ids}
  L88  Put  /pass
  L103  Put  /reject
### ZhsCommissionFlowController
  L39  Get  /orderList
  L49  Get  /list
  L64  Get  /getStatistics
  L74  Get  /getTraderTeam
  L94  Get  /getTraderTeamByCenter
### ZhsInformationController
  L45  Get  /dictionary
  L96  Get  /list
### ZhsProductIdentityController
  L30  Get  /list
  L41  Get  /getInfo
### ZhsWithdrawalController

## 9. ljd-交接文件/ai-smart-society-java (RuoYi Cloud 微服务)

### 9.1 模块清单
- `ruoyi-api`
- `ruoyi-auth`
- `ruoyi-common`
- `ruoyi-gateway`
- `ruoyi-modules`
- `ruoyi-visual`

- Controller 数: 114

### 9.2 Controller 清单
- `ruoyi-auth/src/main/java/com/ruoyi/auth/controller/TokenController.java`
- `ruoyi-common/ruoyi-common-core/src/main/java/com/ruoyi/common/core/web/controller/BaseController.java`
- `ruoyi-modules/ai-google-program/src/main/java/com/general/system/controller/GoogleAuthenticationController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/SmsTempController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserAuthInfoController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserFundInfoController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserLoginLogsController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserMarginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserThirdPartyAccountsController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserTokensController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserVipController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UsersController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/VerificationCodesController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/VipLevelController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/ali/AuthIdentityController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/fund/FundAliPayController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/fund/FundController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/fund/RemoteDeviceByTaskController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/fund/RemoteDeviceController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/AliLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/EnterpriseWeChatLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/FeishuLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/GoogleLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/PwdLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/WechatLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCategoryDictionaryController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseAuditController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCoursePayController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCoursePayLogController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCoursePlatformLogController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseTempController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseVideoController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseVideoTempController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsEducationPlatformController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsIdentityController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsOrganizationController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserCommentLogController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserPlatformController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserSysLinkController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserVideoCommentController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserVideoLogController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/master/controller/WxPCLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/master/controller/WxProgramController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentCategoryController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentCategoryLinkController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentNeedTaskController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentRuleController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentRuleParamController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentTaskDeveloperController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentsController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AiUserFeedbackController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AppVersionController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/PowerPurchaseRuleController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsActivityController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAdvertiseController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentBuyController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentCategoryController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentExamineController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentSettlementController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentUsedetailController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentWithdrawalDetailController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsBannerCarouselController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsCommissionFlowController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsDeveloperController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsDeveloperFundLogsController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsDeveloperLinkController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsDictionaryController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsIdentityProportionController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsInformationController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsOperateTokenFlowController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsOrderController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsPopularCoursesController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsProductController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsProductIdentityController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserAgentAudioController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserAgentContextController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserAgentImageController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserVipController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsVipLevelController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsWithdrawalDetailController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsWithdrawalFlowController.java`
- `ruoyi-modules/coze-api-zhs/src/main/java/com/ruoyi/coze/controller/AgentsController.java`
- `ruoyi-modules/coze-api-zhs/src/main/java/com/ruoyi/coze/controller/CozeBotController.java`
- `ruoyi-modules/coze-api-zhs/src/main/java/com/ruoyi/coze/controller/CozeChatController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/AiGcController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/AuthorizationManagementController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/RankingController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/RemoteThirdController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/VideoBreakpointController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/VideoPreloadController.java`
- `ruoyi-modules/ruoyi-file/src/main/java/com/ruoyi/file/controller/SysFileController.java`
- `ruoyi-modules/ruoyi-gen/src/main/java/com/ruoyi/gen/controller/GenController.java`
- `ruoyi-modules/ruoyi-job/src/main/java/com/ruoyi/job/controller/SysJobController.java`
- `ruoyi-modules/ruoyi-job/src/main/java/com/ruoyi/job/controller/SysJobLogController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/AiAboutUsController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/AiContactController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/AiFileStorageController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/AiNewsController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysConfigController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysDeptController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysDictDataController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysDictTypeController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysLogininforController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysMenuController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysNoticeController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysOperlogController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysPostController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysProfileController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysRoleController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysUserController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysUserOnlineController.java`

## 10. ljd-交接文件/coze_zhs_py (FastAPI Python)

### 10.1 Python 源文件
- `api/__init__.py`
- `api/agent_buy.py`
- `api/agent_category.py`
- `api/agent_category_cache_api.py`
- `api/agent_developer.py`
- `api/agent_examine.py`
- `api/agent_settlement.py`
- `api/agent_withdrawal_detail.py`
- `api/agents.py`
- `api/agents_db.py`
- `api/ai_model_info.py`
- `api/ai_model_info_old.py`
- `api/apps.py`
- `api/audio.py`
- `api/auth.py`
- `api/bailian_app_ws.py`
- `api/bots.py`
- `api/category_sync_api.py`
- `api/chat.py`
- `api/chat_audio.py`
- `api/chat_room_socket.py`
- `api/conversations.py`
- `api/coze_chat.py`
- `api/coze_compat.py`
- `api/coze_workflow.py`
- `api/dashscope_audio.py`
- `api/dashscope_image.py`
- `api/dashscope_image_edit.py`
- `api/dashscope_image_to_image.py`
- `api/dashscope_video_synthesis.py`
- `api/dashscope_vision.py`
- `api/datasets.py`
- `api/doubao_image_edit_proxy.py`
- `api/doubao_image_proxy.py`
- `api/doubao_socket_handler.py`
- `api/doubao_video_proxy.py`
- `api/favicon.py`
- `api/file_upload.py`
- `api/files.py`
- `api/jimeng4_image_proxy.py`
- `api/kling_proxy.py`
- `api/kling_video_synthesis.py`
- `api/langchain_api.py`
- `api/langchain_api_mini.py`
- `api/luyala_proxy.py`
- `api/message_handler.py`
- `api/n8n_proxy.py`
- `api/oauth_apps.py`
- `api/oauth_auth.py`
- `api/openrouter_proxy.py`
- `api/outbound.py`
- `api/public_socket.py`
- `api/public_socket_old.py`
- `api/review.py`
- `api/sms_proxy.py`
- `api/socketio_chat.py`
- `api/stock_analyse.py`
- `api/templates.py`
- `api/tencent_hunyuan_3d.py`
- `api/token_utils.py`
- `api/tools.py`
- `api/user_agent_context.py`
- `api/user_model_chat.py`
- `api/user_sk.py`
- `api/users.py`
- `api/utils.py`
- `api/variables.py`
- `api/volcengine_image_proxy.py`
- `api/volcengine_jimeng31_proxy.py`
- `api/volcengine_visual_proxy.py`
- `api/websocket.py`
- `api/websocket_audio.py`
- `api/websocket_deepseek_stream.py`
- `api/websocket_doubao_proxy.py`
- `api/websocket_doubao_stream_simplified.py`
- `api/websocket_qwen_stream.py`
- `api/websocket_qwen_stream_omni.py`
- `api/websocket_zhipu_stream.py`
- `api/workflows.py`
- `api/workflows_async.py`
- `api/workspaces.py`
- `card_converter.py`
- `card_converter_final.py`
- `card_converter_new.py`
- `config.py`
- `database.py`
- `database2.py`
- `database_utils.py`
- `examples/api_integration_example.py`
- `examples/chat_service_example.py`
- `examples/socket_message_examples.py`
- `main.py`
- `models/__init__.py`
- `models/activity_models.py`
- `models/agent_models.py`
- `models/agent_settlement.py`
- `models/agent_withdrawal_detail.py`
- `models/oauth_models.py`
- `models/simple_bot_config.py`
- `models/token_flow_models.py`
- `models/user_sk_models.py`
- `models/video_task_models.py`
- `schemas/agent_settlement.py`
- `schemas/agent_withdrawal_detail.py`
- `schemas/user_sk.py`
- `services/agent_category_dict_cache.py`
- `services/agents_cache_service.py`
- `services/avatar_sync_service.py`
- `services/cached_expiration_monitor.py`
- `services/expiration_monitor.py`
- `services/heat_stats_service.py`
- `services/monitor_startup.py`
- `temp_code.py`
- `utils/__init__.py`
- `utils/agent_permission_checker.py`
- `utils/agent_type_calculator.py`
- `utils/category_converter.py`
- `utils/category_sync_tool.py`
- `utils/context_manager.py`
- `utils/context_manager_clean.py`
- `utils/coze_auth_utils.py`
- `utils/expiration_calculator.py`
- `utils/optimized_agent_type_calculator.py`
- `utils/order_generator.py`
- `utils/response_builder.py`
- `utils/settlement_helper.py`
- `utils/sync_agents.py`
- `utils/tencent_signature.py`
- `utils/token_flow_utils.py`
- `websocket_auto_recovery.py`

### 10.2 路由 (router 装饰器)
- `api/agents.py:203`  @router.post("/clear-cache", summary="清理智能体缓存")
- `api/agents.py:1884`  @router.get("/health")
- `api/agents.py:1894`  @router.get("/callback/health")
- `api/agents.py:1911`  @router.post("/callback/test")
- `api/agents.py:1921`  @router.get("/callback/test")
- `api/agents.py:1932`  @router.get("/test/auth-config")
- `api/agents.py:1998`  @router.post("/test/fetch-details")
- `api/agents.py:2373`  @router.get("/manage", response_class=HTMLResponse)
- `api/agents.py:2387`  @router.post("/create", response_model=AgentResponse)
- `api/agents.py:2434`  @router.get("/list")
- `api/agents.py:2886`  @router.get("/Alllist")
- `api/agents.py:3417`  @router.get("/billings", response_model=Dict[str, Any])
- `api/agents.py:3473`  @router.get("/billings/{billing_id}", response_model=BillingResponse)
- `api/agents.py:3499`  @router.get("/{agent_id}")
- `api/agents.py:3509`  @router.put("/{agent_id}")
- `api/agents.py:3547`  @router.delete("/{agent_id}")
- `api/agents.py:3561`  @router.post("/{agent_id}/fetch-details")
- `api/agents.py:3631`  @router.get("/{agent_id}/details")
- `api/agents.py:3695`  @router.post("/callback/coze", response_model=CozeAuditResponse)
- `api/agents.py:5009`  @router.get("/callbacks")
- `api/agents.py:5177`  @router.post("/config/webhook-secret")
- `api/agents.py:5195`  @router.get("/config/webhook-secret")
- `api/agents.py:5207`  @router.post("/test/coze-subscription")
- `api/agents.py:5283`  @router.post("/test/signature-verification")
- `api/agents.py:5898`  @router.get("/token/balance/{user_uuid}", response_model=UserTokenBalance)
- `api/agents.py:5950`  @router.put("/token/balance/{user_uuid}", response_model=UserTokenBalance)
- `api/agents.py:6018`  @router.post("/thumbs")
- `api/agents.py:6145`  @router.post("/collect")
- `api/agents.py:6272`  @router.post("/use")
- `api/agents.py:6409`  @router.post("/user/billing", response_model=UserBillingResponse)
- `api/agents.py:6564`  @router.post("/unpublish", response_model=AgentUnpublishResponse)
- `api/agents_db.py:225`  @router.post("/update_review_result", response_model=UpdateReviewResultResponse)
- `api/agents_db.py:267`  @router.get("/review/status/{review_id}")
- `api/agents_db.py:465`  @router.get("/list", summary="获取已发布的智能体列表")
- `api/agent_buy.py:86`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_buy.py:213`  @router.get("/list", response_model=AgentBuyListResponse)
- `api/agent_buy.py:303`  @router.get("/{record_id}", response_model=Dict[str, Any])
- `api/agent_buy.py:337`  @router.put("/{record_id}", response_model=Dict[str, Any])
- `api/agent_buy.py:396`  @router.delete("/{record_id}", response_model=Dict[str, Any])
- `api/agent_buy.py:434`  @router.get("/stats/summary", response_model=Dict[str, Any])
- `api/agent_buy.py:519`  @router.get("/order/generate", response_model=Dict[str, Any])
- `api/agent_buy.py:550`  @router.post("/order/validate", response_model=Dict[str, Any])
- `api/agent_buy.py:588`  @router.post("/{record_id}/recalculate-expiration", response_model=Dict[str, Any])
- `api/agent_category.py:121`  @router.post("/create", response_model=AgentCategoryCreateResponse)
- `api/agent_category.py:365`  @router.get("/list", response_model=AgentCategoryListResponse)
- `api/agent_category.py:528`  @router.post("/batch-query", response_model=AgentCategoryBatchQueryResponse)
- `api/agent_category.py:594`  @router.get("/ids/{id_list}")
- `api/agent_category.py:651`  @router.get("/stats/summary", response_model=AgentCategoryStatsResponse)
- `api/agent_category.py:801`  @router.get("/{category_id}")
- `api/agent_category.py:842`  @router.put("/{category_id}")
- `api/agent_category.py:956`  @router.delete("/{category_id}")
- `api/agent_category.py:1015`  @router.get("/agent/{agent_id}")
- `api/agent_category.py:1055`  @router.post("/{category_id}/enable")
- `api/agent_category.py:1119`  @router.post("/{category_id}/disable")
- `api/agent_category_cache_api.py:20`  @router.get("/info", summary="获取缓存信息")
- `api/agent_category_cache_api.py:41`  @router.post("/reload", summary="重新加载缓存")
- `api/agent_category_cache_api.py:67`  @router.get("/convert", summary="ID转名称")
- `api/agent_category_cache_api.py:100`  @router.get("/categories", summary="获取分类数据")
- `api/agent_category_cache_api.py:189`  @router.get("/agent/{agent_id}", summary="根据智能体ID获取分类数据")
- `api/agent_category_cache_api.py:221`  @router.get("/category/{category_id}", summary="根据分类ID获取分类数据")
- `api/agent_category_cache_api.py:253`  @router.get("/all", summary="获取所有缓存数据")
- `api/agent_category_cache_api.py:299`  @router.delete("/clear", summary="清空缓存")
- `api/agent_category_cache_api.py:321`  @router.get("/search", summary="搜索分类数据")
- `api/agent_developer.py:71`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_developer.py:131`  @router.get("/list", response_model=AgentDeveloperListResponse)
- `api/agent_developer.py:226`  @router.get("/{record_id}", response_model=Dict[str, Any])
- `api/agent_developer.py:260`  @router.get("/order/{order_no}", response_model=Dict[str, Any])
- `api/agent_developer.py:298`  @router.post("/generate-order-no", response_model=Dict[str, Any])
- `api/agent_examine.py:112`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_examine.py:171`  @router.get("/list", response_model=AgentExamineListResponse)
- `api/agent_examine.py:343`  @router.get("/stats/summary", response_model=AgentExamineStatsResponse)
- `api/agent_examine.py:448`  @router.get("/{record_id}", response_model=Dict[str, Any])
- `api/agent_examine.py:482`  @router.put("/{record_id}", response_model=Dict[str, Any])
- `api/agent_examine.py:535`  @router.delete("/{record_id}", response_model=Dict[str, Any])
- `api/agent_examine.py:573`  @router.post("/{record_id}/approve", response_model=Dict[str, Any])
- `api/agent_examine.py:634`  @router.post("/{record_id}/reject", response_model=Dict[str, Any])
- `api/agent_examine.py:695`  @router.get("/stats/summary", response_model=Dict[str, Any])
- `api/agent_examine.py:758`  @router.post("/sync-avatar/{agent_id}", response_model=Dict[str, Any])
- `api/agent_examine.py:838`  @router.post("/batch-sync-avatar", response_model=Dict[str, Any])
- `api/agent_settlement.py:141`  @router.get("/list", response_model=Dict[str, Any])
- `api/agent_settlement.py:414`  @router.get("/{record_id}", response_model=Dict[str, Any])
- `api/agent_settlement.py:441`  @router.put("/{record_id}", response_model=Dict[str, Any])
- `api/agent_settlement.py:483`  @router.get("/order/{order_no}/summary", response_model=Dict[str, Any])
- `api/agent_settlement.py:503`  @router.post("/sync-existing", response_model=Dict[str, Any])
- `api/agent_settlement.py:526`  @router.post("/sync-single/{buy_record_id}", response_model=Dict[str, Any])
- `api/agent_settlement.py:561`  @router.get("/stats/overview", response_model=Dict[str, Any])
- `api/agent_settlement.py:606`  @router.get("/cache/info", response_model=Dict[str, Any])
- `api/agent_settlement.py:626`  @router.post("/cache/force-check", response_model=Dict[str, Any])
- `api/agent_settlement.py:646`  @router.post("/cache/force-refresh", response_model=Dict[str, Any])
- `api/agent_settlement.py:666`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_settlement.py:719`  @router.delete("/{record_id}", response_model=Dict[str, Any])
- `api/agent_settlement.py:755`  @router.post("/batch-delete", response_model=Dict[str, Any])
- `api/agent_settlement.py:801`  @router.get("/stats/income-overview", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:41`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:126`  @router.get("/list", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:270`  @router.get("/{withdrawal_id}", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:308`  @router.put("/{withdrawal_id}", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:358`  @router.delete("/{withdrawal_id}", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:410`  @router.post("/{withdrawal_id}/review", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:470`  @router.post("/{withdrawal_id}/process", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:540`  @router.get("/stats/overview", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:638`  @router.post("/batch-delete", response_model=Dict[str, Any])
- `api/ai_model_info.py:12`  @router.get("/list", summary="查询模型信息列表")
- `api/ai_model_info.py:111`  @router.post("/add", summary="新增模型信息")
- `api/ai_model_info.py:132`  @router.post("/update", summary="修改模型信息")
- `api/ai_model_info.py:166`  @router.get("/delete", summary="删除模型信息（逻辑删除）")
- `api/ai_model_info_old.py:9`  @router.get("/list", summary="查询模型信息列表")
- `api/ai_model_info_old.py:81`  @router.post("/add", summary="新增模型信息")
- `api/ai_model_info_old.py:102`  @router.post("/update", summary="修改模型信息")
- `api/ai_model_info_old.py:136`  @router.get("/delete", summary="删除模型信息（逻辑删除）")
- `api/apps.py:34`  @router.get("", response_model=List[Dict[str, Any]])
- `api/apps.py:68`  @router.get("/api", response_model=List[Dict[str, Any]])
- `api/apps.py:113`  @router.post("/api/events", response_model=Dict[str, Any])
- `api/audio.py:49`  @router.get("/voices")
- `api/audio.py:63`  @router.post("/speech")
- `api/audio.py:106`  @router.post("/chat-audio")
- `api/audio.py:168`  @router.get("/download")
- `api/audio.py:188`  @router.get("/voiceprint-groups")
- `api/audio.py:202`  @router.post("/voiceprint-groups")
- `api/audio.py:222`  @router.put("/voiceprint-groups/{group_id}")
- `api/audio.py:247`  @router.delete("/voiceprint-groups/{group_id}")
- `api/audio.py:264`  @router.get("/voiceprint-groups/{group_id}/features")
- `api/audio.py:280`  @router.post("/voiceprint-groups/{group_id}/features")
- `api/audio.py:320`  @router.put("/voiceprint-groups/{group_id}/features/{feature_id}")
- `api/audio.py:350`  @router.delete("/voiceprint-groups/{group_id}/features/{feature_id}")
- `api/audio.py:371`  @router.post("/voiceprint-groups/{group_id}/identify")
- `api/auth.py:53`  @router.post("/pat", response_model=TokenResponse)
- `api/auth.py:71`  @router.post("/pat/async", response_model=TokenResponse)
- `api/auth.py:95`  @router.get("/sms-login", response_class=HTMLResponse)
- `api/bots.py:30`  @router.get("")
- `api/bots.py:46`  @router.post("")
- `api/bots.py:83`  @router.get("/{bot_id}")
- `api/bots.py:99`  @router.put("/{bot_id}")
- `api/bots.py:137`  @router.post("/{bot_id}/publish")
- `api/category_sync_api.py:18`  @router.get("/status", summary="检查同步状态")
- `api/category_sync_api.py:39`  @router.post("/all", summary="同步所有分类数据")
- `api/category_sync_api.py:64`  @router.post("/agent/{agent_id}", summary="同步单个智能体分类数据")
- `api/category_sync_api.py:95`  @router.get("/performance-test", summary="性能测试对比")
- `api/category_sync_api.py:160`  @router.get("/validate", summary="验证数据一致性")
- `api/chat.py:57`  @router.post("")
- `api/chat.py:209`  @router.post("/stream")
- `api/chat_audio.py:52`  @router.post("/simple")
- `api/chat_audio.py:179`  @router.post("/one-to-one")
- `api/chat_audio.py:204`  @router.post("/plugin")
- `api/chat_room_socket.py:1046`  @router.get("/rooms/{room_id}/users")
- `api/chat_room_socket.py:1066`  @router.get("/users/{user_uuid}/rooms")
- `api/chat_room_socket.py:1238`  @router.get("/history")
- `api/chat_room_socket.py:1363`  @router.delete("/messages/{message_id}")
- `api/chat_room_socket.py:1440`  @router.post("/send")
- `api/chat_room_socket.py:1509`  @router.put("/messages/mark-read")
- `api/chat_room_socket.py:1562`  @router.put("/rooms/rename")
- `api/chat_room_socket.py:1602`  @router.delete("/users/{user_uuid}/rooms/{room_id}")
- `api/conversations.py:45`  @router.post("", response_model=Dict[str, Any])
- `api/conversations.py:93`  @router.post("/messages", response_model=Dict[str, Any])
- `api/conversations.py:139`  @router.post("/messages/feedback", response_model=Dict[str, Any])
- `api/conversations.py:175`  @router.post("/retrieve", response_model=Dict[str, Any])
- `api/coze_chat.py:68`  @router.post("/chat", response_model=CozeChatResponse)
- `api/coze_workflow.py:131`  @router.post("/workflow/run", response_model=WorkflowResponse, summary="运行Coze工作流")
- `api/dashscope_audio.py:202`  @router.post("/audio/recognize", response_model=AudioRecognitionResponse)
- `api/dashscope_audio.py:499`  @router.get("/audio/models")
- `api/dashscope_audio.py:517`  @router.get("/audio/health")
- `api/dashscope_image.py:43`  @router.post("/image/generate/{model}")
- `api/dashscope_image.py:212`  @router.get("/image/task/{task_id}", response_model=ImageGenerationResponse)
- `api/dashscope_image_edit.py:253`  @router.get("/health")
- `api/dashscope_image_edit.py:264`  @router.post("/image/edit", response_model=ImageEditResponse)
- `api/dashscope_image_edit.py:312`  @router.post("/image/edit/simple")
- `api/dashscope_image_edit.py:442`  @router.post("/image/edit/batch")
- `api/dashscope_image_to_image.py:82`  @router.post("/image-to-image", response_model=ImageToImageResponse)
- `api/dashscope_vision.py:68`  @router.post("/vision/chat", response_model=VisionChatResponse)
- `api/datasets.py:47`  @router.post("", response_model=Dict[str, Any])
- `api/datasets.py:87`  @router.post("/list", response_model=Dict[str, Any])
- `api/datasets.py:123`  @router.post("/documents/upload")
- `api/datasets.py:176`  @router.post("/documents/list", response_model=Dict[str, Any])
- `api/datasets.py:213`  @router.post("/images/upload")
- `api/datasets.py:266`  @router.post("/images/list", response_model=Dict[str, Any])
- `api/doubao_image_edit_proxy.py:60`  @router.post("/doubao-image-edit")
- `api/doubao_image_proxy.py:138`  @router.post("/doubao-image-generation")
- `api/doubao_image_proxy.py:301`  @router.post("/doubao-seedream-generation")
- `api/doubao_video_proxy.py:68`  @router.post("/video-generation")
- `api/favicon.py:15`  @router.get("/favicon.ico")
- `api/files.py:22`  @router.post("")
- `api/file_upload.py:23`  @router.post("/upload/base64", response_model=UploadResponse)
- `api/file_upload.py:86`  @router.post("/upload/form", response_model=UploadResponse)
- `api/file_upload.py:111`  @router.post("/upload/octet", response_model=UploadResponse)
- `api/jimeng4_image_proxy.py:31`  @router.get("/ping")
- `api/jimeng4_image_proxy.py:76`  @router.post("/image")
- `api/kling_proxy.py:70`  @router.post("/video/identify")
- `api/kling_proxy.py:126`  @router.post("/video/create")
- `api/kling_proxy.py:425`  @router.post("/videoTolip/create")
- `api/kling_video_synthesis.py:196`  @router.post("/generate/o1")
- `api/langchain_api.py:60`  # @router.get("/models-unify", summary="查询统一大模型信息列表")
- `api/langchain_api.py:1774`  # @router.post("/chat", summary="HTTP 非流式（仅 url 模式）")
- `api/langchain_api_mini.py:65`  @router.get("/models-unify", summary="查询统一大模型信息列表")
- `api/langchain_api_mini.py:2051`  @router.post("/chat", summary="HTTP 非流式（仅 url 模式）")
- `api/luyala_proxy.py:57`  @router.post("/chat/completions", response_model=ProxyResponse)
- `api/luyala_proxy.py:263`  @router.post("/video/create")
- `api/n8n_proxy.py:48`  @router.post("/workflows")
- `api/n8n_proxy.py:89`  @router.post("/addAgent")
- `api/oauth_apps.py:33`  @router.get("/manage", response_class=HTMLResponse)
- `api/oauth_apps.py:50`  @router.post("/create", response_model=OAuthAppResponse)
- `api/oauth_apps.py:92`  @router.get("/list")
- `api/oauth_apps.py:111`  @router.get("/{client_id}")
- `api/oauth_apps.py:134`  @router.delete("/{client_id}")
- `api/oauth_auth.py:40`  @router.post("/device")
- `api/oauth_auth.py:63`  @router.post("/device/token", response_model=OAuthToken)
- `api/oauth_auth.py:87`  @router.post("/device/refresh", response_model=OAuthToken)
- `api/oauth_auth.py:110`  @router.post("/web/authorize")
- `api/oauth_auth.py:138`  @router.post("/web/token", response_model=OAuthToken)
- `api/oauth_auth.py:160`  @router.post("/web/refresh", response_model=OAuthToken)
- `api/oauth_auth.py:183`  @router.post("/pkce/authorize")
- `api/oauth_auth.py:212`  @router.post("/pkce/token", response_model=OAuthToken)
- `api/oauth_auth.py:234`  @router.post("/pkce/refresh", response_model=OAuthToken)
- `api/oauth_auth.py:258`  @router.post("/jwt/token", response_model=OAuthToken)
- `api/oauth_auth.py:280`  @router.get("/authorize")
- `api/oauth_auth.py:347`  @router.post("/authorize/confirm")
- `api/oauth_auth.py:440`  @router.post("/token")
- `api/oauth_auth.py:585`  @router.post("/access_token")
- `api/oauth_auth.py:592`  @router.post("/token/exchange")
- `api/oauth_auth.py:599`  @router.get("/token/test")
- `api/oauth_auth.py:609`  @router.post("/debug/callback")
- `api/oauth_auth.py:713`  @router.get("/sms-config")
- `api/oauth_auth.py:747`  @router.post("/debug/create-test-session")
- `api/oauth_auth.py:782`  @router.get("/sms-login", response_class=HTMLResponse)
- `api/openrouter_proxy.py:27`  @router.post("/openrouter/chat/completions")
- `api/outbound.py:43`  @router.post("/callback", summary="外呼回调接口")
- `api/public_socket.py:344`  @router.post("/send-message/{user_uuid}/{model_id}")
- `api/public_socket_old.py:520`  @router.get("/stats")
- `api/public_socket_old.py:529`  @router.get("/connections")
- `api/public_socket_old.py:538`  @router.get("/connections/user/{user_uuid}")
- `api/public_socket_old.py:547`  @router.get("/connections/model/{model_id}")
- `api/public_socket_old.py:557`  @router.post("/send-message/{user_uuid}/{model_id}")
- `api/public_socket_old.py:579`  @router.post("/broadcast/user/{user_uuid}")
- `api/public_socket_old.py:600`  @router.post("/broadcast/model/{model_id}")
- `api/review.py:215`  @router.post("/update_review_result", response_model=UpdateReviewResultResponse)
- `api/review.py:266`  @router.get("/status")
- `api/sms_proxy.py:47`  @router.post("/send")
- `api/sms_proxy.py:148`  @router.post("/verify")
- `api/sms_proxy.py:262`  @router.post("/register")
- `api/sms_proxy.py:467`  @router.get("/config")
- `api/socketio_chat.py:379`  @router.post("/broadcast")
- `api/socketio_chat.py:398`  @router.post("/send/{client_id}")
- `api/socketio_chat.py:425`  @router.get("/connections")
- `api/socketio_chat.py:448`  @router.get("/queue/status")
- `api/socketio_chat.py:470`  @router.get("/health")
- `api/stock_analyse.py:932`  @router.post("/analyse")
- `api/templates.py:44`  @router.post("/list", response_model=Dict[str, Any])
- `api/templates.py:89`  @router.post("/duplicate", response_model=Dict[str, Any])
- `api/tencent_hunyuan_3d.py:689`  @router.post("/submit", response_model=SubmitHunyuan3DResponse, summary="提交混元3D任务")
- `api/tencent_hunyuan_3d.py:803`  @router.post("/query", response_model=QueryHunyuan3DResponse, summary="查询混元3D任务状态")
- `api/tencent_hunyuan_3d.py:868`  @router.get("/job/{job_id}", response_model=QueryHunyuan3DResponse, summary="通过路径参数查询任务状态")
- `api/tencent_hunyuan_3d.py:882`  @router.post("/admin/clear-cache", summary="清除文件缓存")
- `api/tencent_hunyuan_3d.py:906`  @router.get("/admin/active-jobs", summary="查看当前活跃任务")
- `api/tools.py:63`  @router.post("/timeout", response_model=Dict[str, Any])
- `api/tools.py:120`  @router.post("/exception", response_model=Dict[str, Any])
- `api/tools.py:199`  @router.post("/log", response_model=Dict[str, Any])
- `api/users.py:72`  @router.get("/me", response_model=CozeUserInfo)
- `api/users.py:114`  @router.get("/me/coze")
- `api/user_agent_context.py:30`  @router.post("/query", summary="查询用户智能体上下文")
- `api/user_agent_context.py:122`  # @router.post("/delete", summary="删除指定用户和模型的所有会话记录")
- `api/user_agent_context.py:141`  @router.get("/sample", summary="获取表中的示例数据")
- `api/user_agent_context.py:162`  @router.post("/history", summary="查询用户使用历史记录")
- `api/user_model_chat.py:59`  @router.post("/create", response_model=ApiResponse[ChatRead], summary="创建新的对话记录")
- `api/user_model_chat.py:70`  @router.post("/query", response_model=ApiResponse[List[ChatRead]], summary="根据用户和模型查询对话记录")
- `api/user_model_chat.py:115`  @router.post("/update/mark", response_model=ApiResponse[ChatRead], summary="更新对话简况")
- `api/user_model_chat.py:127`  @router.delete("/{chat_id}", summary="删除对话记录")
- `api/user_sk.py:71`  @router.post("/create", response_model=UserSKResponse)
- `api/user_sk.py:143`  @router.delete("/delete/{sk_id}", response_model=UserSKDeleteResponse)
- `api/user_sk.py:187`  @router.get("/list", response_model=UserSKListResponse)
- `api/user_sk.py:261`  @router.put("/update/{sk_id}", response_model=UserSKResponse)
- `api/variables.py:43`  @router.post("/retrieve", response_model=Dict[str, Any])
- `api/variables.py:82`  @router.post("/list", response_model=Dict[str, Any])
- `api/variables.py:128`  @router.post("/update", response_model=Dict[str, Any])
- `api/variables.py:168`  @router.post("", response_model=Dict[str, Any])
- `api/variables.py:207`  @router.delete("", response_model=Dict[str, Any])
- `api/volcengine_image_proxy.py:29`  @router.post("/image")
- `api/volcengine_jimeng31_proxy.py:26`  @router.post("/generate", response_model=Jimeng31Response)
- `api/volcengine_visual_proxy.py:121`  @router.post("/jimeng4/process")
- `api/volcengine_visual_proxy.py:173`  @router.post("/visual/{req_key}")
- `api/volcengine_visual_proxy.py:403`  @router.post("/visual/images/{req_key}")
- `api/websocket.py:1443`  @router.get("/websocket/stats")
- `api/websocket.py:1461`  @router.get("/websocket/health")
- `api/websocket.py:1518`  @router.post("/websocket/cleanup")
- `api/websocket.py:1545`  @router.post("/websocket/disconnect/{client_id}")
- `api/websocket.py:2549`  @router.get("/stats")
- `api/websocket.py:2568`  @router.get("/connections")
- `api/websocket.py:2590`  @router.get("/queue")
- `api/websocket.py:2609`  @router.post("/websocket/emergency-cleanup")
- `api/websocket.py:2643`  @router.get("/websocket/system-status")
- `api/websocket.py:3162`  @router.get("/stats")
- `api/websocket.py:3180`  @router.get("/connections")
- `api/websocket.py:3201`  @router.get("/queue")
- `api/websocket.py:3219`  @router.post("/websocket/emergency-cleanup")
- `api/websocket.py:3252`  @router.get("/websocket/system-status")
- `api/websocket_qwen_stream_omni.py:1023`  @router.get("/stats")
- `api/websocket_qwen_stream_omni.py:1032`  @router.get("/health")
- `api/websocket_qwen_stream_omni.py:1057`  @router.post("/test-save-conversation")
- `api/websocket_qwen_stream_omni.py:1099`  @router.get("/test-history")
- `api/websocket_zhipu_stream.py:711`  @router.get("/health")
- `api/websocket_zhipu_stream.py:732`  @router.get("/models")
- `api/workflows.py:37`  @router.post("/runs")
- `api/workflows.py:75`  @router.post("/runs/stream")
- `api/workflows.py:91`  @router.post("/runs/resume")
- `api/workflows.py:117`  @router.post("/runs/history")
- `api/workflows.py:137`  @router.post("/runs/execute-nodes")
- `api/workflows_async.py:79`  @router.post("", response_model=Dict[str, Any])
- `api/workflows_async.py:172`  @router.post("/stream")
- `api/workflows_async.py:241`  @router.post("/chat/stream")
- `api/workflows_async.py:315`  @router.post("/chat/multimode/stream")
- `api/workspaces.py:26`  @router.get("")
- `api/workspaces.py:50`  @router.post("/members")
- `api/workspaces.py:82`  @router.delete("/members")
- `examples/api_integration_example.py:40`  @router.post("/send", response_model=MessageResponse)
- `examples/api_integration_example.py:152`  @router.post("/end")
- `examples/api_integration_example.py:200`  @router.get("/list")
- `main.py:2878`  @app.get("/cozeZhsApi/ws/stats")
- `main.py:2888`  @app.get("/api/config/client-mode")
- `main.py:2902`  @app.post("/api/config/client-mode")
- `main.py:2931`  @app.get("/config")
- `main.py:3188`  @app.get("/", include_in_schema=False)
- `main.py:3192`  @app.get("/system/health")
- `main.py:3251`  @app.get("/system/websocket/status")
- `main.py:3355`  @app.post("/system/websocket/restart")
- `main.py:3375`  @app.get("/system/auto-recovery/status")
- `main.py:3403`  @app.get("/system/health")
- `main.py:3480`  @app.get("/docs", include_in_schema=False)
- `main.py:3512`  @app.get("/cozeZhsApi/heat/stats")
- `main.py:3533`  @app.post("/cozeZhsApi/heat/generate")
- `main.py:3553`  @app.get("/cozeZhsApi/ws/status")
- `main.py:3585`  @app.post("/cozeZhsApi/ws/recovery/trigger")
- `main.py:3609`  @app.post("/cozeZhsApi/admin/reload-agents")

## 11. SQL 建表脚本汇总

### edu service
- `ihui-ai-edu-ask-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-ask-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-auth-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-auth-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-behavior-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-behavior-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-circle-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-circle-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-content-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-content-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-exam-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-exam-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-learn-service/db-migration.sql`
- `ihui-ai-edu-learn-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-learn-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-live-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-live-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-member-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-member-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-message-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-message-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-notification-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-notification-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-order-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-order-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-oss-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-oss-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-pay-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-pay-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-point-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-point-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-resource-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-resource-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-schedule-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-schedule-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-search-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-search-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-setting-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-setting-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-usercenter-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-usercenter-service/target/classes/db/sql/change.sql`
- `ihui-ai-edu-visit-tracking-service/src/main/resources/db/sql/change.sql`
- `ihui-ai-edu-visit-tracking-service/target/classes/db/sql/change.sql`
- `init_database.sql`
- `insert_signup_data.sql`
- `mock_signup_data.sql`

### edu client

## 9. ljd-交接文件/ai-smart-society-java (RuoYi Cloud 微服务)

### 9.1 模块清单
- `ruoyi-api`
- `ruoyi-auth`
- `ruoyi-common`
- `ruoyi-gateway`
- `ruoyi-modules`
- `ruoyi-visual`

- Controller 数: 114

### 9.2 Controller 清单
- `ruoyi-auth/src/main/java/com/ruoyi/auth/controller/TokenController.java`
- `ruoyi-common/ruoyi-common-core/src/main/java/com/ruoyi/common/core/web/controller/BaseController.java`
- `ruoyi-modules/ai-google-program/src/main/java/com/general/system/controller/GoogleAuthenticationController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/SmsTempController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserAuthInfoController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserFundInfoController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserLoginLogsController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserMarginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserThirdPartyAccountsController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserTokensController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UserVipController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/UsersController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/VerificationCodesController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/VipLevelController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/ali/AuthIdentityController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/fund/FundAliPayController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/fund/FundController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/fund/RemoteDeviceByTaskController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/fund/RemoteDeviceController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/AliLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/EnterpriseWeChatLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/FeishuLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/GoogleLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/PwdLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/auth/controller/login/WechatLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCategoryDictionaryController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseAuditController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCoursePayController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCoursePayLogController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCoursePlatformLogController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseTempController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseVideoController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsCourseVideoTempController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsEducationPlatformController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsIdentityController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsOrganizationController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserCommentLogController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserPlatformController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserSysLinkController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserVideoCommentController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/course/controller/ZhsUserVideoLogController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/master/controller/WxPCLoginController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/master/controller/WxProgramController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentCategoryController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentCategoryLinkController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentNeedTaskController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentRuleController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentRuleParamController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentTaskDeveloperController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AgentsController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AiUserFeedbackController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/AppVersionController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/PowerPurchaseRuleController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsActivityController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAdvertiseController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentBuyController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentCategoryController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentExamineController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentSettlementController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentUsedetailController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsAgentWithdrawalDetailController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsBannerCarouselController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsCommissionFlowController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsDeveloperController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsDeveloperFundLogsController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsDeveloperLinkController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsDictionaryController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsIdentityProportionController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsInformationController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsOperateTokenFlowController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsOrderController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsPopularCoursesController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsProductController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsProductIdentityController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserAgentAudioController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserAgentContextController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserAgentImageController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsUserVipController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsVipLevelController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsWithdrawalDetailController.java`
- `ruoyi-modules/ai-program/src/main/java/com/ai/system/slave/controller/ZhsWithdrawalFlowController.java`
- `ruoyi-modules/coze-api-zhs/src/main/java/com/ruoyi/coze/controller/AgentsController.java`
- `ruoyi-modules/coze-api-zhs/src/main/java/com/ruoyi/coze/controller/CozeBotController.java`
- `ruoyi-modules/coze-api-zhs/src/main/java/com/ruoyi/coze/controller/CozeChatController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/AiGcController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/AuthorizationManagementController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/RankingController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/RemoteThirdController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/VideoBreakpointController.java`
- `ruoyi-modules/general-program/src/main/java/com/general/system/controller/VideoPreloadController.java`
- `ruoyi-modules/ruoyi-file/src/main/java/com/ruoyi/file/controller/SysFileController.java`
- `ruoyi-modules/ruoyi-gen/src/main/java/com/ruoyi/gen/controller/GenController.java`
- `ruoyi-modules/ruoyi-job/src/main/java/com/ruoyi/job/controller/SysJobController.java`
- `ruoyi-modules/ruoyi-job/src/main/java/com/ruoyi/job/controller/SysJobLogController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/AiAboutUsController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/AiContactController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/AiFileStorageController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/AiNewsController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysConfigController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysDeptController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysDictDataController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysDictTypeController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysLogininforController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysMenuController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysNoticeController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysOperlogController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysPostController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysProfileController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysRoleController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysUserController.java`
- `ruoyi-modules/ruoyi-system/src/main/java/com/ruoyi/system/controller/SysUserOnlineController.java`

### 9.3 HTTP 端点
  - TokenController (4 endpoints)
  - BaseController (0 endpoints)
  - GoogleAuthenticationController (2 endpoints)
  - SmsTempController (4 endpoints)
  - UserAuthInfoController (4 endpoints)
  - UserFundInfoController (4 endpoints)
  - UserLoginLogsController (4 endpoints)
  - UserMarginController (4 endpoints)
  - UserThirdPartyAccountsController (5 endpoints)
  - UserTokensController (4 endpoints)
  - UserVipController (4 endpoints)
  - UsersController (8 endpoints)
  - VerificationCodesController (4 endpoints)
  - VipLevelController (4 endpoints)
  - AuthIdentityController (1 endpoints)
  - FundAliPayController (6 endpoints)
  - FundController (9 endpoints)
  - RemoteDeviceByTaskController (4 endpoints)
  - RemoteDeviceController (11 endpoints)
  - AliLoginController (3 endpoints)
  - EnterpriseWeChatLoginController (3 endpoints)
  - FeishuLoginController (3 endpoints)
  - GoogleLoginController (2 endpoints)
  - PwdLoginController (12 endpoints)
  - WechatLoginController (3 endpoints)
  - ZhsCategoryDictionaryController (4 endpoints)
  - ZhsCourseAuditController (5 endpoints)
  - ZhsCourseController (4 endpoints)
  - ZhsCoursePayController (4 endpoints)
  - ZhsCoursePayLogController (4 endpoints)
  - ZhsCoursePlatformLogController (4 endpoints)
  - ZhsCourseTempController (4 endpoints)
  - ZhsCourseVideoController (4 endpoints)
  - ZhsCourseVideoTempController (4 endpoints)
  - ZhsEducationPlatformController (4 endpoints)
  - ZhsIdentityController (4 endpoints)
  - ZhsOrganizationController (4 endpoints)
  - ZhsUserCommentLogController (4 endpoints)
  - ZhsUserPlatformController (4 endpoints)
  - ZhsUserSysLinkController (4 endpoints)
  - ZhsUserVideoCommentController (4 endpoints)
  - ZhsUserVideoLogController (4 endpoints)
  - WxPCLoginController (2 endpoints)
  - WxProgramController (0 endpoints)
  - AgentCategoryController (4 endpoints)
  - AgentCategoryLinkController (4 endpoints)
  - AgentNeedTaskController (6 endpoints)
  - AgentRuleController (4 endpoints)
  - AgentRuleParamController (4 endpoints)
  - AgentTaskDeveloperController (4 endpoints)
  - AgentsController (6 endpoints)
  - AiUserFeedbackController (4 endpoints)
  - AppVersionController (4 endpoints)
  - PowerPurchaseRuleController (4 endpoints)
  - ZhsActivityController (5 endpoints)
  - ZhsAdvertiseController (4 endpoints)
  - ZhsAgentBuyController (4 endpoints)
  - ZhsAgentCategoryController (4 endpoints)
  - ZhsAgentController (5 endpoints)
  - ZhsAgentExamineController (6 endpoints)
  - ZhsAgentSettlementController (4 endpoints)
  - ZhsAgentUsedetailController (4 endpoints)
  - ZhsAgentWithdrawalDetailController (7 endpoints)
  - ZhsBannerCarouselController (4 endpoints)
  - ZhsCommissionFlowController (5 endpoints)
  - ZhsDeveloperController (4 endpoints)
  - ZhsDeveloperFundLogsController (4 endpoints)
  - ZhsDeveloperLinkController (5 endpoints)
  - ZhsDictionaryController (5 endpoints)
  - ZhsIdentityProportionController (4 endpoints)
  - ZhsInformationController (4 endpoints)
  - ZhsOperateTokenFlowController (4 endpoints)
  - ZhsOrderController (7 endpoints)
  - ZhsPopularCoursesController (4 endpoints)
  - ZhsProductController (4 endpoints)
  - ZhsProductIdentityController (4 endpoints)
  - ZhsUserAgentAudioController (4 endpoints)
  - ZhsUserAgentContextController (4 endpoints)
  - ZhsUserAgentImageController (4 endpoints)
  - ZhsUserController (4 endpoints)
  - ZhsUserVipController (4 endpoints)
  - ZhsVipLevelController (4 endpoints)
  - ZhsWithdrawalDetailController (4 endpoints)
  - ZhsWithdrawalFlowController (5 endpoints)
  - AgentsController (5 endpoints)
  - CozeBotController (10 endpoints)
  - CozeChatController (4 endpoints)
  - AiGcController (4 endpoints)
  - AuthorizationManagementController (2 endpoints)
  - RankingController (4 endpoints)
  - RemoteThirdController (1 endpoints)
  - VideoBreakpointController (2 endpoints)
  - VideoPreloadController (1 endpoints)
  - SysFileController (9 endpoints)
  - GenController (11 endpoints)
  - SysJobController (6 endpoints)
  - SysJobLogController (5 endpoints)
  - AiAboutUsController (4 endpoints)
  - AiContactController (4 endpoints)
  - AiFileStorageController (5 endpoints)
  - AiNewsController (4 endpoints)
  - SysConfigController (6 endpoints)
  - SysDeptController (4 endpoints)
  - SysDictDataController (5 endpoints)
  - SysDictTypeController (6 endpoints)
  - SysLogininforController (5 endpoints)
  - SysMenuController (6 endpoints)
  - SysNoticeController (3 endpoints)
  - SysOperlogController (4 endpoints)
  - SysPostController (5 endpoints)
  - SysProfileController (2 endpoints)
  - SysRoleController (13 endpoints)
  - SysUserController (15 endpoints)
  - SysUserOnlineController (2 endpoints)

- `create_invoice_title.sql`
- `data/init_lesson_data.sql`
- `elasticsearch-7.17.16/jdk/legal/java.sql`
- `fix_lecturer_table.sql`
- `scripts/fix_exam_chapter_table.sql`
- `scripts/fix_user_id1.sql`
- `scripts/sync_category_type.sql`
- `scripts/update_certificate_template_images.sql`
- `scripts/update_live_categories.sql`
- `scripts/update_question_stats.sql`
- `service/service/ihui-ai-edu-ask-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-ask-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-auth-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-auth-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-behavior-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-behavior-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-circle-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-circle-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-content-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-content-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-exam-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-exam-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-learn-service/db-migration.sql`
- `service/service/ihui-ai-edu-learn-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-learn-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-live-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-live-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-member-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-member-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-message-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-message-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-notification-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-notification-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-order-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-order-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-oss-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-oss-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-pay-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-pay-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-point-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-point-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-resource-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-resource-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-schedule-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-schedule-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-search-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-search-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-setting-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-setting-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-usercenter-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-usercenter-service/target/classes/db/sql/change.sql`
- `service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/db/sql/change.sql`
- `service/service/ihui-ai-edu-visit-tracking-service/target/classes/db/sql/change.sql`
- `service/service/init_database.sql`
- `service/service/insert_signup_data.sql`
- `service/service/mock_signup_data.sql`

### ljd
- `ai-smart-society-java/sql/quartz.sql`
- `ai-smart-society-java/sql/ry_20250425.sql`
- `ai-smart-society-java/sql/ry_config_20250224.sql`
- `ai-smart-society-java/sql/ry_seata_20210128.sql`
- `coze_zhs_py/sql/agent_buy_scheduled_tasks.sql`
- `coze_zhs_py/sql/agent_heat_stats.sql`
- `coze_zhs_py/sql/insert_settlement_test_data.sql`
- `coze_zhs_py/sql/insert_test_withdrawal_data.sql`
- `coze_zhs_py/sql/migrations/add_category_fields_to_agents.sql`
- `coze_zhs_py/sql/migrations/add_issue_no_to_settlement.sql`
- `coze_zhs_py/sql/migrations/add_order_no_to_zhs_agent_developer.sql`
- `coze_zhs_py/sql/migrations/ensure_settlement_table_exists.sql`
- `coze_zhs_py/sql/zhs_agent_buy.sql`
- `coze_zhs_py/sql/zhs_agent_category.sql`
- `coze_zhs_py/sql/zhs_agent_developer.sql`
- `coze_zhs_py/sql/zhs_agent_examine.sql`
- `coze_zhs_py/sql/zhs_agent_settlement.sql`
- `coze_zhs_py/sql/zhs_agent_withdrawal_detail.sql`
- `coze_zhs_py/sql/zhs_developer_link.sql`
- `service/__MACOSX/cloud-learning-ask-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-auth-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-behavior-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-circle-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-content-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-exam-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-learn-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-live-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-member-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-message-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-notification-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-order-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-oss-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-pay-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-point-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-resource-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-schedule-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-search-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-setting-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-usercenter-service/src/main/resources/db/sql/._change.sql`
- `service/__MACOSX/cloud-learning-visit-tracking-service/src/main/resources/db/sql/._change.sql`
- `service/ihui-ai-edu-ask-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-ask-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-auth-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-auth-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-behavior-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-behavior-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-circle-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-circle-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-content-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-content-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-exam-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-exam-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-learn-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-learn-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-live-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-live-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-member-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-member-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-message-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-message-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-notification-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-notification-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-order-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-order-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-oss-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-oss-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-pay-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-pay-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-point-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-point-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-resource-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-resource-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-schedule-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-schedule-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-search-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-search-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-setting-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-setting-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-usercenter-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-usercenter-service/target/classes/db/sql/change.sql`
- `service/ihui-ai-edu-visit-tracking-service/src/main/resources/db/sql/change.sql`
- `service/ihui-ai-edu-visit-tracking-service/target/classes/db/sql/change.sql`
- `service/init_database.sql`
- `service_2/ihui-ai-edu-ask-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-ask-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-auth-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-auth-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-behavior-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-behavior-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-circle-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-circle-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-content-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-content-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-exam-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-exam-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-learn-service/db-migration.sql`
- `service_2/ihui-ai-edu-learn-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-learn-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-live-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-live-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-member-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-member-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-message-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-message-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-notification-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-notification-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-order-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-order-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-oss-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-oss-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-pay-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-pay-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-point-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-point-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-resource-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-resource-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-schedule-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-schedule-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-search-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-search-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-setting-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-setting-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-usercenter-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-usercenter-service/target/classes/db/sql/change.sql`
- `service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/db/sql/change.sql`
- `service_2/ihui-ai-edu-visit-tracking-service/target/classes/db/sql/change.sql`
- `service_2/init_database.sql`
- `service_2/insert_signup_data.sql`
- `service_2/mock_signup_data.sql`

### Ai-WXMiniVue

## 12. CREATE TABLE 表名清单 (跨所有历史项目)

```

## 10. ljd-交接文件/coze_zhs_py (FastAPI Python)

### 10.1 Python 源文件
- `api/__init__.py`
- `api/agent_buy.py`
- `api/agent_category.py`
- `api/agent_category_cache_api.py`
- `api/agent_developer.py`
- `api/agent_examine.py`
- `api/agent_settlement.py`
- `api/agent_withdrawal_detail.py`
- `api/agents.py`
- `api/agents_db.py`
- `api/ai_model_info.py`
- `api/ai_model_info_old.py`
- `api/apps.py`
- `api/audio.py`
- `api/auth.py`
- `api/bailian_app_ws.py`
- `api/bots.py`
- `api/category_sync_api.py`
- `api/chat.py`
- `api/chat_audio.py`
- `api/chat_room_socket.py`
- `api/conversations.py`
- `api/coze_chat.py`
- `api/coze_compat.py`
- `api/coze_workflow.py`
- `api/dashscope_audio.py`
- `api/dashscope_image.py`
- `api/dashscope_image_edit.py`
- `api/dashscope_image_to_image.py`
- `api/dashscope_video_synthesis.py`
- `api/dashscope_vision.py`
- `api/datasets.py`
- `api/doubao_image_edit_proxy.py`
- `api/doubao_image_proxy.py`
- `api/doubao_socket_handler.py`
- `api/doubao_video_proxy.py`
- `api/favicon.py`
- `api/file_upload.py`
- `api/files.py`
- `api/jimeng4_image_proxy.py`
- `api/kling_proxy.py`
- `api/kling_video_synthesis.py`
- `api/langchain_api.py`
- `api/langchain_api_mini.py`
- `api/luyala_proxy.py`
- `api/message_handler.py`
- `api/n8n_proxy.py`
- `api/oauth_apps.py`
- `api/oauth_auth.py`
- `api/openrouter_proxy.py`
- `api/outbound.py`
- `api/public_socket.py`
- `api/public_socket_old.py`
- `api/review.py`
- `api/sms_proxy.py`
- `api/socketio_chat.py`
- `api/stock_analyse.py`
- `api/templates.py`
- `api/tencent_hunyuan_3d.py`
- `api/token_utils.py`
- `api/tools.py`
- `api/user_agent_context.py`
- `api/user_model_chat.py`
- `api/user_sk.py`
- `api/users.py`
- `api/utils.py`
- `api/variables.py`
- `api/volcengine_image_proxy.py`
- `api/volcengine_jimeng31_proxy.py`
- `api/volcengine_visual_proxy.py`
- `api/websocket.py`
- `api/websocket_audio.py`
- `api/websocket_deepseek_stream.py`
- `api/websocket_doubao_proxy.py`
- `api/websocket_doubao_stream_simplified.py`
- `api/websocket_qwen_stream.py`
- `api/websocket_qwen_stream_omni.py`
- `api/websocket_zhipu_stream.py`
- `api/workflows.py`
- `api/workflows_async.py`
- `api/workspaces.py`
- `card_converter.py`
- `card_converter_final.py`
- `card_converter_new.py`
- `config.py`
- `database.py`
- `database2.py`
- `database_utils.py`
- `examples/api_integration_example.py`
- `examples/chat_service_example.py`
- `examples/socket_message_examples.py`
- `main.py`
- `models/__init__.py`
- `models/activity_models.py`
- `models/agent_models.py`
- `models/agent_settlement.py`
- `models/agent_withdrawal_detail.py`
- `models/oauth_models.py`
- `models/simple_bot_config.py`
- `models/token_flow_models.py`
- `models/user_sk_models.py`
- `models/video_task_models.py`
- `schemas/agent_settlement.py`
- `schemas/agent_withdrawal_detail.py`
- `schemas/user_sk.py`
- `services/agent_category_dict_cache.py`
- `services/agents_cache_service.py`
- `services/avatar_sync_service.py`
- `services/cached_expiration_monitor.py`
- `services/expiration_monitor.py`
- `services/heat_stats_service.py`
- `services/monitor_startup.py`
- `temp_code.py`
- `utils/__init__.py`
- `utils/agent_permission_checker.py`
- `utils/agent_type_calculator.py`
- `utils/category_converter.py`
- `utils/category_sync_tool.py`
- `utils/context_manager.py`
- `utils/context_manager_clean.py`
- `utils/coze_auth_utils.py`
- `utils/expiration_calculator.py`
- `utils/optimized_agent_type_calculator.py`
- `utils/order_generator.py`
- `utils/response_builder.py`
- `utils/settlement_helper.py`
- `utils/sync_agents.py`
- `utils/tencent_signature.py`
- `utils/token_flow_utils.py`
- `websocket_auto_recovery.py`

### 10.2 路由 (router/app 装饰器)
- `api/agents.py:203`  @router.post("/clear-cache", summary="清理智能体缓存")
- `api/agents.py:1884`  @router.get("/health")
- `api/agents.py:1894`  @router.get("/callback/health")
- `api/agents.py:1911`  @router.post("/callback/test")
- `api/agents.py:1921`  @router.get("/callback/test")
- `api/agents.py:1932`  @router.get("/test/auth-config")
- `api/agents.py:1998`  @router.post("/test/fetch-details")
- `api/agents.py:2373`  @router.get("/manage", response_class=HTMLResponse)
- `api/agents.py:2387`  @router.post("/create", response_model=AgentResponse)
- `api/agents.py:2434`  @router.get("/list")
- `api/agents.py:2886`  @router.get("/Alllist")
- `api/agents.py:3417`  @router.get("/billings", response_model=Dict[str, Any])
- `api/agents.py:3473`  @router.get("/billings/{billing_id}", response_model=BillingResponse)
- `api/agents.py:3499`  @router.get("/{agent_id}")
- `api/agents.py:3509`  @router.put("/{agent_id}")
- `api/agents.py:3547`  @router.delete("/{agent_id}")
- `api/agents.py:3561`  @router.post("/{agent_id}/fetch-details")
- `api/agents.py:3631`  @router.get("/{agent_id}/details")
- `api/agents.py:3695`  @router.post("/callback/coze", response_model=CozeAuditResponse)
- `api/agents.py:5009`  @router.get("/callbacks")
- `api/agents.py:5177`  @router.post("/config/webhook-secret")
- `api/agents.py:5195`  @router.get("/config/webhook-secret")
- `api/agents.py:5207`  @router.post("/test/coze-subscription")
- `api/agents.py:5283`  @router.post("/test/signature-verification")
- `api/agents.py:5898`  @router.get("/token/balance/{user_uuid}", response_model=UserTokenBalance)
- `api/agents.py:5950`  @router.put("/token/balance/{user_uuid}", response_model=UserTokenBalance)
- `api/agents.py:6018`  @router.post("/thumbs")
- `api/agents.py:6145`  @router.post("/collect")
- `api/agents.py:6272`  @router.post("/use")
- `api/agents.py:6409`  @router.post("/user/billing", response_model=UserBillingResponse)
- `api/agents.py:6564`  @router.post("/unpublish", response_model=AgentUnpublishResponse)
- `api/agents_db.py:225`  @router.post("/update_review_result", response_model=UpdateReviewResultResponse)
- `api/agents_db.py:267`  @router.get("/review/status/{review_id}")
- `api/agents_db.py:465`  @router.get("/list", summary="获取已发布的智能体列表")
- `api/agent_buy.py:86`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_buy.py:213`  @router.get("/list", response_model=AgentBuyListResponse)
- `api/agent_buy.py:303`  @router.get("/{record_id}", response_model=Dict[str, Any])
- `api/agent_buy.py:337`  @router.put("/{record_id}", response_model=Dict[str, Any])
- `api/agent_buy.py:396`  @router.delete("/{record_id}", response_model=Dict[str, Any])
- `api/agent_buy.py:434`  @router.get("/stats/summary", response_model=Dict[str, Any])
- `api/agent_buy.py:519`  @router.get("/order/generate", response_model=Dict[str, Any])
- `api/agent_buy.py:550`  @router.post("/order/validate", response_model=Dict[str, Any])
- `api/agent_buy.py:588`  @router.post("/{record_id}/recalculate-expiration", response_model=Dict[str, Any])
- `api/agent_category.py:121`  @router.post("/create", response_model=AgentCategoryCreateResponse)
- `api/agent_category.py:365`  @router.get("/list", response_model=AgentCategoryListResponse)
- `api/agent_category.py:528`  @router.post("/batch-query", response_model=AgentCategoryBatchQueryResponse)
- `api/agent_category.py:594`  @router.get("/ids/{id_list}")
- `api/agent_category.py:651`  @router.get("/stats/summary", response_model=AgentCategoryStatsResponse)
- `api/agent_category.py:801`  @router.get("/{category_id}")
- `api/agent_category.py:842`  @router.put("/{category_id}")
- `api/agent_category.py:956`  @router.delete("/{category_id}")
- `api/agent_category.py:1015`  @router.get("/agent/{agent_id}")
- `api/agent_category.py:1055`  @router.post("/{category_id}/enable")
- `api/agent_category.py:1119`  @router.post("/{category_id}/disable")
- `api/agent_category_cache_api.py:20`  @router.get("/info", summary="获取缓存信息")
- `api/agent_category_cache_api.py:41`  @router.post("/reload", summary="重新加载缓存")
- `api/agent_category_cache_api.py:67`  @router.get("/convert", summary="ID转名称")
- `api/agent_category_cache_api.py:100`  @router.get("/categories", summary="获取分类数据")
- `api/agent_category_cache_api.py:189`  @router.get("/agent/{agent_id}", summary="根据智能体ID获取分类数据")
- `api/agent_category_cache_api.py:221`  @router.get("/category/{category_id}", summary="根据分类ID获取分类数据")
- `api/agent_category_cache_api.py:253`  @router.get("/all", summary="获取所有缓存数据")
- `api/agent_category_cache_api.py:299`  @router.delete("/clear", summary="清空缓存")
- `api/agent_category_cache_api.py:321`  @router.get("/search", summary="搜索分类数据")
- `api/agent_developer.py:71`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_developer.py:131`  @router.get("/list", response_model=AgentDeveloperListResponse)
- `api/agent_developer.py:226`  @router.get("/{record_id}", response_model=Dict[str, Any])
- `api/agent_developer.py:260`  @router.get("/order/{order_no}", response_model=Dict[str, Any])
- `api/agent_developer.py:298`  @router.post("/generate-order-no", response_model=Dict[str, Any])
- `api/agent_examine.py:112`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_examine.py:171`  @router.get("/list", response_model=AgentExamineListResponse)
- `api/agent_examine.py:343`  @router.get("/stats/summary", response_model=AgentExamineStatsResponse)
- `api/agent_examine.py:448`  @router.get("/{record_id}", response_model=Dict[str, Any])
- `api/agent_examine.py:482`  @router.put("/{record_id}", response_model=Dict[str, Any])
- `api/agent_examine.py:535`  @router.delete("/{record_id}", response_model=Dict[str, Any])
- `api/agent_examine.py:573`  @router.post("/{record_id}/approve", response_model=Dict[str, Any])
- `api/agent_examine.py:634`  @router.post("/{record_id}/reject", response_model=Dict[str, Any])
- `api/agent_examine.py:695`  @router.get("/stats/summary", response_model=Dict[str, Any])
- `api/agent_examine.py:758`  @router.post("/sync-avatar/{agent_id}", response_model=Dict[str, Any])
- `api/agent_examine.py:838`  @router.post("/batch-sync-avatar", response_model=Dict[str, Any])
- `api/agent_settlement.py:141`  @router.get("/list", response_model=Dict[str, Any])
- `api/agent_settlement.py:414`  @router.get("/{record_id}", response_model=Dict[str, Any])
- `api/agent_settlement.py:441`  @router.put("/{record_id}", response_model=Dict[str, Any])
- `api/agent_settlement.py:483`  @router.get("/order/{order_no}/summary", response_model=Dict[str, Any])
- `api/agent_settlement.py:503`  @router.post("/sync-existing", response_model=Dict[str, Any])
- `api/agent_settlement.py:526`  @router.post("/sync-single/{buy_record_id}", response_model=Dict[str, Any])
- `api/agent_settlement.py:561`  @router.get("/stats/overview", response_model=Dict[str, Any])
- `api/agent_settlement.py:606`  @router.get("/cache/info", response_model=Dict[str, Any])
- `api/agent_settlement.py:626`  @router.post("/cache/force-check", response_model=Dict[str, Any])
- `api/agent_settlement.py:646`  @router.post("/cache/force-refresh", response_model=Dict[str, Any])
- `api/agent_settlement.py:666`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_settlement.py:719`  @router.delete("/{record_id}", response_model=Dict[str, Any])
- `api/agent_settlement.py:755`  @router.post("/batch-delete", response_model=Dict[str, Any])
- `api/agent_settlement.py:801`  @router.get("/stats/income-overview", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:41`  @router.post("/create", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:126`  @router.get("/list", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:270`  @router.get("/{withdrawal_id}", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:308`  @router.put("/{withdrawal_id}", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:358`  @router.delete("/{withdrawal_id}", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:410`  @router.post("/{withdrawal_id}/review", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:470`  @router.post("/{withdrawal_id}/process", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:540`  @router.get("/stats/overview", response_model=Dict[str, Any])
- `api/agent_withdrawal_detail.py:638`  @router.post("/batch-delete", response_model=Dict[str, Any])
- `api/ai_model_info.py:12`  @router.get("/list", summary="查询模型信息列表")
- `api/ai_model_info.py:111`  @router.post("/add", summary="新增模型信息")
- `api/ai_model_info.py:132`  @router.post("/update", summary="修改模型信息")
- `api/ai_model_info.py:166`  @router.get("/delete", summary="删除模型信息（逻辑删除）")
- `api/ai_model_info_old.py:9`  @router.get("/list", summary="查询模型信息列表")
- `api/ai_model_info_old.py:81`  @router.post("/add", summary="新增模型信息")
- `api/ai_model_info_old.py:102`  @router.post("/update", summary="修改模型信息")
- `api/ai_model_info_old.py:136`  @router.get("/delete", summary="删除模型信息（逻辑删除）")
- `api/apps.py:34`  @router.get("", response_model=List[Dict[str, Any]])
- `api/apps.py:68`  @router.get("/api", response_model=List[Dict[str, Any]])
- `api/apps.py:113`  @router.post("/api/events", response_model=Dict[str, Any])
- `api/audio.py:49`  @router.get("/voices")
- `api/audio.py:63`  @router.post("/speech")
- `api/audio.py:106`  @router.post("/chat-audio")
- `api/audio.py:168`  @router.get("/download")
- `api/audio.py:188`  @router.get("/voiceprint-groups")
- `api/audio.py:202`  @router.post("/voiceprint-groups")
- `api/audio.py:222`  @router.put("/voiceprint-groups/{group_id}")
- `api/audio.py:247`  @router.delete("/voiceprint-groups/{group_id}")
- `api/audio.py:264`  @router.get("/voiceprint-groups/{group_id}/features")
- `api/audio.py:280`  @router.post("/voiceprint-groups/{group_id}/features")
- `api/audio.py:320`  @router.put("/voiceprint-groups/{group_id}/features/{feature_id}")
- `api/audio.py:350`  @router.delete("/voiceprint-groups/{group_id}/features/{feature_id}")
- `api/audio.py:371`  @router.post("/voiceprint-groups/{group_id}/identify")
- `api/auth.py:53`  @router.post("/pat", response_model=TokenResponse)
- `api/auth.py:71`  @router.post("/pat/async", response_model=TokenResponse)
- `api/auth.py:95`  @router.get("/sms-login", response_class=HTMLResponse)
- `api/bots.py:30`  @router.get("")
- `api/bots.py:46`  @router.post("")
- `api/bots.py:83`  @router.get("/{bot_id}")
- `api/bots.py:99`  @router.put("/{bot_id}")
- `api/bots.py:137`  @router.post("/{bot_id}/publish")
- `api/category_sync_api.py:18`  @router.get("/status", summary="检查同步状态")
- `api/category_sync_api.py:39`  @router.post("/all", summary="同步所有分类数据")
- `api/category_sync_api.py:64`  @router.post("/agent/{agent_id}", summary="同步单个智能体分类数据")
- `api/category_sync_api.py:95`  @router.get("/performance-test", summary="性能测试对比")
- `api/category_sync_api.py:160`  @router.get("/validate", summary="验证数据一致性")
- `api/chat.py:57`  @router.post("")
- `api/chat.py:209`  @router.post("/stream")
- `api/chat_audio.py:52`  @router.post("/simple")
- `api/chat_audio.py:179`  @router.post("/one-to-one")
- `api/chat_audio.py:204`  @router.post("/plugin")
- `api/chat_room_socket.py:1046`  @router.get("/rooms/{room_id}/users")
- `api/chat_room_socket.py:1066`  @router.get("/users/{user_uuid}/rooms")
- `api/chat_room_socket.py:1238`  @router.get("/history")
- `api/chat_room_socket.py:1363`  @router.delete("/messages/{message_id}")
- `api/chat_room_socket.py:1440`  @router.post("/send")
- `api/chat_room_socket.py:1509`  @router.put("/messages/mark-read")
- `api/chat_room_socket.py:1562`  @router.put("/rooms/rename")
- `api/chat_room_socket.py:1602`  @router.delete("/users/{user_uuid}/rooms/{room_id}")
- `api/conversations.py:45`  @router.post("", response_model=Dict[str, Any])
- `api/conversations.py:93`  @router.post("/messages", response_model=Dict[str, Any])
- `api/conversations.py:139`  @router.post("/messages/feedback", response_model=Dict[str, Any])
- `api/conversations.py:175`  @router.post("/retrieve", response_model=Dict[str, Any])
- `api/coze_chat.py:68`  @router.post("/chat", response_model=CozeChatResponse)
- `api/coze_workflow.py:131`  @router.post("/workflow/run", response_model=WorkflowResponse, summary="运行Coze工作流")
- `api/dashscope_audio.py:202`  @router.post("/audio/recognize", response_model=AudioRecognitionResponse)
- `api/dashscope_audio.py:499`  @router.get("/audio/models")
- `api/dashscope_audio.py:517`  @router.get("/audio/health")
- `api/dashscope_image.py:43`  @router.post("/image/generate/{model}")
- `api/dashscope_image.py:212`  @router.get("/image/task/{task_id}", response_model=ImageGenerationResponse)
- `api/dashscope_image_edit.py:253`  @router.get("/health")
- `api/dashscope_image_edit.py:264`  @router.post("/image/edit", response_model=ImageEditResponse)
- `api/dashscope_image_edit.py:312`  @router.post("/image/edit/simple")
- `api/dashscope_image_edit.py:442`  @router.post("/image/edit/batch")
- `api/dashscope_image_to_image.py:82`  @router.post("/image-to-image", response_model=ImageToImageResponse)
- `api/dashscope_vision.py:68`  @router.post("/vision/chat", response_model=VisionChatResponse)
- `api/datasets.py:47`  @router.post("", response_model=Dict[str, Any])
- `api/datasets.py:87`  @router.post("/list", response_model=Dict[str, Any])
- `api/datasets.py:123`  @router.post("/documents/upload")
- `api/datasets.py:176`  @router.post("/documents/list", response_model=Dict[str, Any])
- `api/datasets.py:213`  @router.post("/images/upload")
- `api/datasets.py:266`  @router.post("/images/list", response_model=Dict[str, Any])
- `api/doubao_image_edit_proxy.py:60`  @router.post("/doubao-image-edit")
- `api/doubao_image_proxy.py:138`  @router.post("/doubao-image-generation")
- `api/doubao_image_proxy.py:301`  @router.post("/doubao-seedream-generation")
- `api/doubao_video_proxy.py:68`  @router.post("/video-generation")
- `api/favicon.py:15`  @router.get("/favicon.ico")
- `api/files.py:22`  @router.post("")
- `api/file_upload.py:23`  @router.post("/upload/base64", response_model=UploadResponse)
- `api/file_upload.py:86`  @router.post("/upload/form", response_model=UploadResponse)
- `api/file_upload.py:111`  @router.post("/upload/octet", response_model=UploadResponse)
- `api/jimeng4_image_proxy.py:31`  @router.get("/ping")
- `api/jimeng4_image_proxy.py:76`  @router.post("/image")
- `api/kling_proxy.py:70`  @router.post("/video/identify")
- `api/kling_proxy.py:126`  @router.post("/video/create")
- `api/kling_proxy.py:425`  @router.post("/videoTolip/create")
- `api/kling_video_synthesis.py:196`  @router.post("/generate/o1")
- `api/langchain_api.py:60`  # @router.get("/models-unify", summary="查询统一大模型信息列表")
- `api/langchain_api.py:1774`  # @router.post("/chat", summary="HTTP 非流式（仅 url 模式）")
- `api/langchain_api_mini.py:65`  @router.get("/models-unify", summary="查询统一大模型信息列表")
- `api/langchain_api_mini.py:2051`  @router.post("/chat", summary="HTTP 非流式（仅 url 模式）")
- `api/luyala_proxy.py:57`  @router.post("/chat/completions", response_model=ProxyResponse)
- `api/luyala_proxy.py:263`  @router.post("/video/create")
- `api/n8n_proxy.py:48`  @router.post("/workflows")
- `api/n8n_proxy.py:89`  @router.post("/addAgent")
- `api/oauth_apps.py:33`  @router.get("/manage", response_class=HTMLResponse)
- `api/oauth_apps.py:50`  @router.post("/create", response_model=OAuthAppResponse)
- `api/oauth_apps.py:92`  @router.get("/list")
- `api/oauth_apps.py:111`  @router.get("/{client_id}")
- `api/oauth_apps.py:134`  @router.delete("/{client_id}")
- `api/oauth_auth.py:40`  @router.post("/device")
- `api/oauth_auth.py:63`  @router.post("/device/token", response_model=OAuthToken)
- `api/oauth_auth.py:87`  @router.post("/device/refresh", response_model=OAuthToken)
- `api/oauth_auth.py:110`  @router.post("/web/authorize")
- `api/oauth_auth.py:138`  @router.post("/web/token", response_model=OAuthToken)
- `api/oauth_auth.py:160`  @router.post("/web/refresh", response_model=OAuthToken)
- `api/oauth_auth.py:183`  @router.post("/pkce/authorize")
- `api/oauth_auth.py:212`  @router.post("/pkce/token", response_model=OAuthToken)
- `api/oauth_auth.py:234`  @router.post("/pkce/refresh", response_model=OAuthToken)
- `api/oauth_auth.py:258`  @router.post("/jwt/token", response_model=OAuthToken)
- `api/oauth_auth.py:280`  @router.get("/authorize")
- `api/oauth_auth.py:347`  @router.post("/authorize/confirm")
- `api/oauth_auth.py:440`  @router.post("/token")
- `api/oauth_auth.py:585`  @router.post("/access_token")
- `api/oauth_auth.py:592`  @router.post("/token/exchange")
- `api/oauth_auth.py:599`  @router.get("/token/test")
- `api/oauth_auth.py:609`  @router.post("/debug/callback")
- `api/oauth_auth.py:713`  @router.get("/sms-config")
- `api/oauth_auth.py:747`  @router.post("/debug/create-test-session")
- `api/oauth_auth.py:782`  @router.get("/sms-login", response_class=HTMLResponse)
- `api/openrouter_proxy.py:27`  @router.post("/openrouter/chat/completions")
- `api/outbound.py:43`  @router.post("/callback", summary="外呼回调接口")
- `api/public_socket.py:344`  @router.post("/send-message/{user_uuid}/{model_id}")
- `api/public_socket_old.py:520`  @router.get("/stats")
- `api/public_socket_old.py:529`  @router.get("/connections")
- `api/public_socket_old.py:538`  @router.get("/connections/user/{user_uuid}")
- `api/public_socket_old.py:547`  @router.get("/connections/model/{model_id}")
- `api/public_socket_old.py:557`  @router.post("/send-message/{user_uuid}/{model_id}")
- `api/public_socket_old.py:579`  @router.post("/broadcast/user/{user_uuid}")
- `api/public_socket_old.py:600`  @router.post("/broadcast/model/{model_id}")
- `api/review.py:215`  @router.post("/update_review_result", response_model=UpdateReviewResultResponse)
- `api/review.py:266`  @router.get("/status")
- `api/sms_proxy.py:47`  @router.post("/send")
- `api/sms_proxy.py:148`  @router.post("/verify")
- `api/sms_proxy.py:262`  @router.post("/register")
- `api/sms_proxy.py:467`  @router.get("/config")
- `api/socketio_chat.py:379`  @router.post("/broadcast")
- `api/socketio_chat.py:398`  @router.post("/send/{client_id}")
- `api/socketio_chat.py:425`  @router.get("/connections")
- `api/socketio_chat.py:448`  @router.get("/queue/status")
- `api/socketio_chat.py:470`  @router.get("/health")
- `api/stock_analyse.py:932`  @router.post("/analyse")
- `api/templates.py:44`  @router.post("/list", response_model=Dict[str, Any])
- `api/templates.py:89`  @router.post("/duplicate", response_model=Dict[str, Any])
- `api/tencent_hunyuan_3d.py:689`  @router.post("/submit", response_model=SubmitHunyuan3DResponse, summary="提交混元3D任务")
- `api/tencent_hunyuan_3d.py:803`  @router.post("/query", response_model=QueryHunyuan3DResponse, summary="查询混元3D任务状态")
- `api/tencent_hunyuan_3d.py:868`  @router.get("/job/{job_id}", response_model=QueryHunyuan3DResponse, summary="通过路径参数查询任务状态")
- `api/tencent_hunyuan_3d.py:882`  @router.post("/admin/clear-cache", summary="清除文件缓存")
- `api/tencent_hunyuan_3d.py:906`  @router.get("/admin/active-jobs", summary="查看当前活跃任务")
- `api/tools.py:63`  @router.post("/timeout", response_model=Dict[str, Any])
- `api/tools.py:120`  @router.post("/exception", response_model=Dict[str, Any])
- `api/tools.py:199`  @router.post("/log", response_model=Dict[str, Any])
- `api/users.py:72`  @router.get("/me", response_model=CozeUserInfo)
- `api/users.py:114`  @router.get("/me/coze")
- `api/user_agent_context.py:30`  @router.post("/query", summary="查询用户智能体上下文")
- `api/user_agent_context.py:122`  # @router.post("/delete", summary="删除指定用户和模型的所有会话记录")
- `api/user_agent_context.py:141`  @router.get("/sample", summary="获取表中的示例数据")
- `api/user_agent_context.py:162`  @router.post("/history", summary="查询用户使用历史记录")
- `api/user_model_chat.py:59`  @router.post("/create", response_model=ApiResponse[ChatRead], summary="创建新的对话记录")
- `api/user_model_chat.py:70`  @router.post("/query", response_model=ApiResponse[List[ChatRead]], summary="根据用户和模型查询对话记录")
- `api/user_model_chat.py:115`  @router.post("/update/mark", response_model=ApiResponse[ChatRead], summary="更新对话简况")
- `api/user_model_chat.py:127`  @router.delete("/{chat_id}", summary="删除对话记录")
- `api/user_sk.py:71`  @router.post("/create", response_model=UserSKResponse)
- `api/user_sk.py:143`  @router.delete("/delete/{sk_id}", response_model=UserSKDeleteResponse)
- `api/user_sk.py:187`  @router.get("/list", response_model=UserSKListResponse)
- `api/user_sk.py:261`  @router.put("/update/{sk_id}", response_model=UserSKResponse)
- `api/variables.py:43`  @router.post("/retrieve", response_model=Dict[str, Any])
- `api/variables.py:82`  @router.post("/list", response_model=Dict[str, Any])
- `api/variables.py:128`  @router.post("/update", response_model=Dict[str, Any])
- `api/variables.py:168`  @router.post("", response_model=Dict[str, Any])
- `api/variables.py:207`  @router.delete("", response_model=Dict[str, Any])
- `api/volcengine_image_proxy.py:29`  @router.post("/image")
- `api/volcengine_jimeng31_proxy.py:26`  @router.post("/generate", response_model=Jimeng31Response)
- `api/volcengine_visual_proxy.py:121`  @router.post("/jimeng4/process")
- `api/volcengine_visual_proxy.py:173`  @router.post("/visual/{req_key}")
- `api/volcengine_visual_proxy.py:403`  @router.post("/visual/images/{req_key}")
- `api/websocket.py:1443`  @router.get("/websocket/stats")
- `api/websocket.py:1461`  @router.get("/websocket/health")
- `api/websocket.py:1518`  @router.post("/websocket/cleanup")
- `api/websocket.py:1545`  @router.post("/websocket/disconnect/{client_id}")
- `api/websocket.py:2549`  @router.get("/stats")
- `api/websocket.py:2568`  @router.get("/connections")
- `api/websocket.py:2590`  @router.get("/queue")
- `api/websocket.py:2609`  @router.post("/websocket/emergency-cleanup")
- `api/websocket.py:2643`  @router.get("/websocket/system-status")
- `api/websocket.py:3162`  @router.get("/stats")
- `api/websocket.py:3180`  @router.get("/connections")
- `api/websocket.py:3201`  @router.get("/queue")
- `api/websocket.py:3219`  @router.post("/websocket/emergency-cleanup")
- `api/websocket.py:3252`  @router.get("/websocket/system-status")
- `api/websocket_qwen_stream_omni.py:1023`  @router.get("/stats")
- `api/websocket_qwen_stream_omni.py:1032`  @router.get("/health")
- `api/websocket_qwen_stream_omni.py:1057`  @router.post("/test-save-conversation")
- `api/websocket_qwen_stream_omni.py:1099`  @router.get("/test-history")
- `api/websocket_zhipu_stream.py:711`  @router.get("/health")
- `api/websocket_zhipu_stream.py:732`  @router.get("/models")
- `api/workflows.py:37`  @router.post("/runs")
- `api/workflows.py:75`  @router.post("/runs/stream")
- `api/workflows.py:91`  @router.post("/runs/resume")
- `api/workflows.py:117`  @router.post("/runs/history")
- `api/workflows.py:137`  @router.post("/runs/execute-nodes")
- `api/workflows_async.py:79`  @router.post("", response_model=Dict[str, Any])
- `api/workflows_async.py:172`  @router.post("/stream")
- `api/workflows_async.py:241`  @router.post("/chat/stream")
- `api/workflows_async.py:315`  @router.post("/chat/multimode/stream")
- `api/workspaces.py:26`  @router.get("")
- `api/workspaces.py:50`  @router.post("/members")
- `api/workspaces.py:82`  @router.delete("/members")
- `examples/api_integration_example.py:40`  @router.post("/send", response_model=MessageResponse)
- `examples/api_integration_example.py:152`  @router.post("/end")
- `examples/api_integration_example.py:200`  @router.get("/list")
- `main.py:2878`  @app.get("/cozeZhsApi/ws/stats")
- `main.py:2888`  @app.get("/api/config/client-mode")
- `main.py:2902`  @app.post("/api/config/client-mode")
- `main.py:2931`  @app.get("/config")
- `main.py:3188`  @app.get("/", include_in_schema=False)
- `main.py:3192`  @app.get("/system/health")
- `main.py:3251`  @app.get("/system/websocket/status")
- `main.py:3355`  @app.post("/system/websocket/restart")
- `main.py:3375`  @app.get("/system/auto-recovery/status")
- `main.py:3403`  @app.get("/system/health")
- `main.py:3480`  @app.get("/docs", include_in_schema=False)
- `main.py:3512`  @app.get("/cozeZhsApi/heat/stats")
- `main.py:3533`  @app.post("/cozeZhsApi/heat/generate")
- `main.py:3553`  @app.get("/cozeZhsApi/ws/status")
- `main.py:3585`  @app.post("/cozeZhsApi/ws/recovery/trigger")
- `main.py:3609`  @app.post("/cozeZhsApi/admin/reload-agents")


## 6. Ai-WXMiniVue (uniapp 多端: 微信小程序 + H5 + App)

### 6.1 pages 页面清单
- `src/pages/distribution/EarningsStatisticsCard/index.vue`
- `src/pages/distribution/FunctionBlockColumn/index.vue`
- `src/pages/distribution/PersonalInformationCard/index.vue`
- `src/pages/distribution/index.vue`
- `src/pages/distribution_order_list/index.vue`
- `src/pages/distribution_personnel_list/detail.vue`
- `src/pages/distribution_personnel_list/index.vue`
- `src/pages/income/components/EarningsStatisticsCard/index.vue`
- `src/pages/income/components/accumulation/index.vue`
- `src/pages/income/components/datas.vue`
- `src/pages/income/components/select/index.vue`
- `src/pages/income/index.vue`
- `src/pages/income/withdraw/index.vue`
- `src/pages/learn/learn.vue`
- `src/pages/login-app-other/changePhone.vue`
- `src/pages/login-app-other/changePwd.vue`
- `src/pages/login-app-other/register.vue`
- `src/pages/login-app/changePhone.vue`
- `src/pages/login-app/login.vue`
- `src/pages/login-app/register.vue`
- `src/pages/login/index.vue`
- `src/pages/member/index.vue`
- `src/pages/table/aiIndex/ai_index.vue`
- `src/pages/table/settings/index.vue`
- `src/pages/table/settings/privacy-policy.vue`
- `src/pages/table/share/components/Interest-track-modal.vue`
- `src/pages/table/share/components/center-item/index.vue`
- `src/pages/table/share/components/information-item/index.vue`
- `src/pages/table/share/components/new-title/index.vue`
- `src/pages/table/share/components/title-switch/index.vue`
- `src/pages/table/share/index.vue`
- `src/pages/table/square/index.vue`
- `src/pages/table/tools/category-detail.vue`
- `src/pages/table/tools/components/Ai-list_b.vue`
- `src/pages/table/tools/components/Intelligent-assistant.vue`
- `src/pages/table/tools/components/MyAgents.vue`
- `src/pages/table/tools/components/RecentAgents.vue`
- `src/pages/table/tools/index.vue`
- `src/pages/table/user/UserInfoCard/UserInfoCard.vue`
- `src/pages/table/user/UserInfoCard/UserInfoCardOld.vue`
- `src/pages/table/user/components/user_cards.vue`
- `src/pages/table/user/index.vue`
- `src/pages/table/user/loginPopUp/index.vue`
- `src/pages/table/user/loginPopUp/indexOld.vue`
- `src/pages/table/user/window.vue`
- `src/pages/tools/ai_assistant.vue`
- `src/pages/tools/ai_assistant_n8n.vue`
- `src/pages/tools/ai_group/ai_group_card.vue`
- `src/pages/tools/ai_group/drawer_left.vue`
- `src/pages/tools/ai_group/index.vue`
- `src/pages/tools/ai_index2 copy.vue`
- `src/pages/tools/ai_index2.vue`
- `src/pages/tools/ai_index3.vue`
- `src/pages/tools/aigc/components/video.vue`
- `src/pages/tools/aigc/cover.vue`
- `src/pages/tools/aigc/index.vue`
- `src/pages/tools/aigc/publish.vue`
- `src/pages/tools/components/Ai-list.vue`
- `src/pages/tools/components/AiModelCard/index.vue`
- `src/pages/tools/components/Carousel/index.vue`
- `src/pages/tools/components/CommissionFloatingIcon/index.vue`
- `src/pages/tools/components/DrawerComponent.vue`
- `src/pages/tools/components/ModelList.vue`
- `src/pages/tools/components/navigation-bars/indexc.vue`
- `src/pages/tools/model-plaza/index.vue`
- `src/pages/tools/ranking-detail.vue`
- `src/pages/tools/token_value.vue`
- `src/pages/tools/top-bars/index.vue`
- `src/pages/tools/top-bars/search.vue`
- `src/pages/tools/top-bars/tabbar.vue`
- `src/pages/user_order_list/index.vue`
- `src/pages/user_order_list/indexOld.vue`

### 6.2 路由配置
- `src/pages.json` (存在, 638 行)

### 6.3 api 调用清单
- `src/api/payment.js`

### 6.4 components 组件清单
- `src/components/AgentList.vue`
- `src/components/AiModelCard/index.vue`
- `src/components/BottomActionBar.vue`
- `src/components/BottomFigure/index.vue`
- `src/components/CardWithList.vue`
- `src/components/Carousel/index.vue`
- `src/components/CommissionFloatingIcon/index.vue`
- `src/components/ConfirmPurchasePopUp/index.vue`
- `src/components/CourseCarousel/UpToDate.vue`
- `src/components/CourseCarousel/index.vue`
- `src/components/CourseCarousel/list.vue`
- `src/components/DrawerComponent.vue`
- `src/components/DrawerComponentall.vue`
- `src/components/EarningsStatisticsCard/index.vue`
- `src/components/FloatBox.vue`
- `src/components/FullRankingList.vue`
- `src/components/FunctionBlockColumn/index.vue`
- `src/components/InputArea.vue`
- `src/components/KnowledgePlanet/index.vue`
- `src/components/MaterialList.vue`
- `src/components/Menu/index.vue`
- `src/components/ModelConfigDialog/index.vue`
- `src/components/ModelConfigDialog/indexa.vue`
- `src/components/ModelConfigDialog/selecter.vue`
- `src/components/ModelList.vue`
- `src/components/MoreTitles/index.vue`
- `src/components/PersonalInformationCard/index.vue`
- `src/components/PopularCourses/PopularCoursesList1.vue`
- `src/components/PopularCourses/PopularCoursesList2.vue`
- `src/components/PopularCourses/index.vue`
- `src/components/PurchaseNoticePopUp/index.vue`
- `src/components/PushNotification/index.vue`
- `src/components/SearchInput/index.vue`
- `src/components/ToggleButtonGroup.vue`
- `src/components/Toolbar/index.vue`
- `src/components/UserInfoCard/UserInfoCard.vue`
- `src/components/UserInfoCard/UserInfoCardOld.vue`
- `src/components/UserMembershipBenefits/UserMembershipBenefits.vue`
- `src/components/VoiceInput/index.vue`
- `src/components/bottom-pops/index.vue`
- `src/components/colorful_loader.vue`
- `src/components/common/Default.vue`
- `src/components/common/Empty.vue`
- `src/components/common/Loading.vue`
- `src/components/common/NavBar.vue`
- `src/components/customTabBar/index.vue`
- `src/components/hand-plate-pups/index.vue`
- `src/components/introduce-popup/index.vue`
- `src/components/introduce-popup/indexs.vue`
- `src/components/introduce-popup/levelIndex.vue`
- `src/components/introduce-popup/privateAdvisory.vue`
- `src/components/loading/index.vue`
- `src/components/loginPopUp/index.vue`
- `src/components/loginPopUp/indexOld.vue`
- `src/components/nav-bar.vue`
- `src/components/navigation-bars/index.vue`
- `src/components/navigation-bars/indexa.vue`
- `src/components/navigation-bars/indexb.vue`
- `src/components/navigation-bars/indexc.vue`
- `src/components/pay_btn.vue`
- `src/components/ranking/rankings.vue`
- `src/components/study/bar.vue`
- `src/components/title-switch/overlap_large.vue`
- `src/components/title-switch/scroll_picker.vue`
- `src/components/title-switch/scroll_title.vue`
- `src/components/title-switch/type_bar.vue`
- `src/components/type-bar/single.vue`
- `src/components/type-bar/tab.vue`
- `src/components/verify-code-modal/index.vue`

## 7. share-h5 (分享 H5)

### 7.1 页面清单
- `src/App.vue`
- `src/pages/ErrorPage.vue`
- `src/pages/SharePage.vue`

### 7.2 路由配置
- `src/router`

## 5. ihui-ai-admin-frontend (RuoYi 3.6.5 管理端) — 补充



## 13. 配置 / 凭证 / 证书清单

### application*.yml / application*.properties
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/target/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/target/application.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `code/ljd-交接文件/ZHS_Server_java/src/main/resources/application.yml`
- `code/ljd-交接文件/ZHS_Server_java/target/classes/application.yml`
- `code/ljd-交接文件/ai-smart-society-java/docker/nacos/conf/application.properties`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-gateway/src/main/resources/application-ssl.yml`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-gateway/target/classes/application-ssl.yml`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-modules/ai-program/src/main/resources/application.properties`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-modules/ai-program/target/classes/application.properties`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-modules/coze-api-zhs/src/main/resources/application.properties`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-modules/coze-api-zhs/target/classes/application.properties`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-content-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-live-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-member-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/target/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/target/application.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-order-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-point-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-search-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `ljd-交接文件/ZHS_Server_java/src/main/resources/application.yml`
- `ljd-交接文件/ZHS_Server_java/target/classes/application.yml`
- `ljd-交接文件/ai-smart-society-java/docker/nacos/conf/application.properties`
- `ljd-交接文件/ai-smart-society-java/ruoyi-gateway/src/main/resources/application-ssl.yml`
- `ljd-交接文件/ai-smart-society-java/ruoyi-modules/ai-program/src/main/resources/application.properties`
- `ljd-交接文件/ai-smart-society-java/ruoyi-modules/coze-api-zhs/src/main/resources/application.properties`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`

### .env / .env.*
```

## 13. 配置 / 凭证 / 证书清单

### application*.yml / application*.properties
- `code/edu/admin/admin/.env`
- `code/edu/web/web/.env`
- `edu client/admin/admin/.env`
- `edu client/web/web/.env`
- `ihui-ai-admin-frontend/.env`
- `ihui-ai-admin-frontend/.env.development`
- `ihui-ai-admin-frontend/.env.example`
- `ihui-ai-admin-frontend/.env.production`
- `ihui-ai-admin-frontend/.env.staging`
- `zhs_app-ZZ/Ai-WXMiniVue/.env.development`
- `zhs_app-ZZ/Ai-WXMiniVue/.env.production`

### 证书 (.jks / .p12 / .pem / .crt / .key)
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-content-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-live-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-member-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-message-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/target/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/target/application.yml`
- `code/edu/service/service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-order-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-point-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-search-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `code/edu/service/service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `code/ljd-交接文件/ZHS_Server_java/src/main/resources/application.yml`
- `code/ljd-交接文件/ZHS_Server_java/target/classes/application.yml`
- `code/ljd-交接文件/ai-smart-society-java/docker/nacos/conf/application.properties`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-gateway/src/main/resources/application-ssl.yml`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-gateway/target/classes/application-ssl.yml`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-modules/ai-program/src/main/resources/application.properties`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-modules/ai-program/target/classes/application.properties`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-modules/coze-api-zhs/src/main/resources/application.properties`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-modules/coze-api-zhs/target/classes/application.properties`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-content-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-live-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-member-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-order-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-point-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-search-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-ask-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-circle-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-content-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-exam-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-learn-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-live-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-member-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-notification-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-order-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-oss-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-point-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-resource-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-search-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-setting-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `code/ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-content-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-live-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-member-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `edu client/service/service/ihui-ai-edu-message-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/target/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/target/application.yml`
- `edu client/service/service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-order-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-point-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-search-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `edu client/service/service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-content-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-live-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-member-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-message-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-order-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-point-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-search-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `edu server/edu service/edu service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `ljd-交接文件/ZHS_Server_java/src/main/resources/application.yml`
- `ljd-交接文件/ZHS_Server_java/target/classes/application.yml`
- `ljd-交接文件/ai-smart-society-java/docker/nacos/conf/application.properties`
- `ljd-交接文件/ai-smart-society-java/ruoyi-gateway/src/main/resources/application-ssl.yml`
- `ljd-交接文件/ai-smart-society-java/ruoyi-modules/ai-program/src/main/resources/application.properties`
- `ljd-交接文件/ai-smart-society-java/ruoyi-modules/coze-api-zhs/src/main/resources/application.properties`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-ask-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-circle-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-content-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-exam-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-learn-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-live-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-member-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-message-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-notification-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-order-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-oss-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-point-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-resource-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-search-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-setting-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `ljd-交接文件/service/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-ask-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-behavior-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-circle-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-content-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-exam-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-learn-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-live-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/target/classes/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-member-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-message-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-notification-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-order-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-oss-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-alipay.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-point-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-resource-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-schedule-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-rocketmq.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-search-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-setting-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/target/classes/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-dev.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-prod.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application-test.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/src/main/resources/application.yml`
- `ljd-交接文件/service_2/ihui-ai-edu-visit-tracking-service/target/classes/application.yml`

### .env / .env.*
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `code/edu/service/service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-gateway/src/main/resources/program.aizhs.top.jks`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-gateway/target/classes/program.aizhs.top.jks`
- `code/ljd-交接文件/service/__MACOSX/cloud-learning-auth-service/src/main/resources/._jwt.jks`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/jwt.jks`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/target/classes/jwt.jks`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `edu client/service/service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/jwt.jks`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/target/classes/jwt.jks`
- `ljd-交接文件/ai-smart-society-java/ruoyi-gateway/src/main/resources/program.aizhs.top.jks`
- `ljd-交接文件/service/__MACOSX/cloud-learning-auth-service/src/main/resources/._jwt.jks`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/jwt.jks`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/target/classes/jwt.jks`

### 微信 / VAPID / AI 厂商密钥配置文件
- `code/edu/admin/admin/.env`
- `code/edu/web/web/.env`
- `edu client/admin/admin/.env`
- `edu client/web/web/.env`
- `ihui-ai-admin-frontend/.env`
- `ihui-ai-admin-frontend/.env.development`
- `ihui-ai-admin-frontend/.env.example`
- `ihui-ai-admin-frontend/.env.production`
- `ihui-ai-admin-frontend/.env.staging`
- `zhs_app-ZZ/Ai-WXMiniVue/.env.development`
- `zhs_app-ZZ/Ai-WXMiniVue/.env.production`

### 证书 (.jks / .p12 / .pem / .crt / .key)
- `code/edu/service/service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `code/edu/service/service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-gateway/src/main/resources/program.aizhs.top.jks`
- `code/ljd-交接文件/ai-smart-society-java/ruoyi-gateway/target/classes/program.aizhs.top.jks`
- `code/ljd-交接文件/service/__MACOSX/cloud-learning-auth-service/src/main/resources/._jwt.jks`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `code/ljd-交接文件/service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `code/ljd-交接文件/service_2/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/jwt.jks`
- `code/ljd-交接文件/service_2/ihui-ai-edu-gateway-service/target/classes/jwt.jks`
- `edu client/service/service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `edu client/service/service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `edu server/edu service/edu service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/src/main/resources/jwt.jks`
- `edu server/edu service/edu service/ihui-ai-edu-gateway-service/target/classes/jwt.jks`
- `ljd-交接文件/ai-smart-society-java/ruoyi-gateway/src/main/resources/program.aizhs.top.jks`
- `ljd-交接文件/service/__MACOSX/cloud-learning-auth-service/src/main/resources/._jwt.jks`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `ljd-交接文件/service/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/src/main/resources/jwt.jks`
- `ljd-交接文件/service_2/ihui-ai-edu-auth-service/target/classes/jwt.jks`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/src/main/resources/jwt.jks`
- `ljd-交接文件/service_2/ihui-ai-edu-gateway-service/target/classes/jwt.jks`

### 微信 / VAPID / AI 厂商密钥配置
- `code/edu/admin/admin/src/assets/login/weixin.png`
- `code/edu/admin/admin/src/assets/login/workwechat.png`
- `code/edu/service/service/ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay`
- `code/edu/service/service/ihui-ai-edu-pay-service/target/classes/com/yjs/cloud/learning/pay/biz/wechatpay`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/wechat`
- `code/edu/service/service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `code/edu/web/web/dist/footer/zf/weixin@1x.png`
- `code/edu/web/web/public/footer/zf/weixin@1x.png`
- `code/edu/web/web/src/assets/login/weixin.png`
- `code/edu/web/web/src/assets/login/workwechat.png`
- `code/ljd-交接文件/service/__MACOSX/cloud-learning-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/._wechatpay`
- `code/ljd-交接文件/service/__MACOSX/cloud-learning-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay`
- `code/ljd-交接文件/service/__MACOSX/cloud-learning-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/._wechat`
- `code/ljd-交接文件/service/__MACOSX/cloud-learning-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/._workwechat`
- `code/ljd-交接文件/service/__MACOSX/cloud-learning-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat`
- `code/ljd-交接文件/service/__MACOSX/cloud-learning-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay`
- `code/ljd-交接文件/service/ihui-ai-edu-pay-service/target/classes/com/yjs/cloud/learning/pay/biz/wechatpay`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/wechat`
- `code/ljd-交接文件/service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay`
- `code/ljd-交接文件/service_2/ihui-ai-edu-pay-service/target/classes/com/yjs/cloud/learning/pay/biz/wechatpay`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/wechat`
- `code/ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `edu client/admin/admin/src/assets/login/weixin.png`
- `edu client/admin/admin/src/assets/login/workwechat.png`
- `edu client/service/service/ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay`
- `edu client/service/service/ihui-ai-edu-pay-service/target/classes/com/yjs/cloud/learning/pay/biz/wechatpay`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat`
- `edu client/service/service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `edu client/service/service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/wechat`
- `edu client/service/service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `edu client/web/web/dist/footer/zf/weixin@1x.png`
- `edu client/web/web/public/footer/zf/weixin@1x.png`
- `edu client/web/web/src/assets/login/weixin.png`
- `edu client/web/web/src/assets/login/workwechat.png`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay`
- `edu server/edu service/edu service/ihui-ai-edu-pay-service/target/classes/com/yjs/cloud/learning/pay/biz/wechatpay`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/wechat`
- `edu server/edu service/edu service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `ljd-交接文件/service/__MACOSX/cloud-learning-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/._wechatpay`
- `ljd-交接文件/service/__MACOSX/cloud-learning-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay`
- `ljd-交接文件/service/__MACOSX/cloud-learning-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/._wechat`
- `ljd-交接文件/service/__MACOSX/cloud-learning-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/._workwechat`
- `ljd-交接文件/service/__MACOSX/cloud-learning-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat`
- `ljd-交接文件/service/__MACOSX/cloud-learning-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay`
- `ljd-交接文件/service/ihui-ai-edu-pay-service/target/classes/com/yjs/cloud/learning/pay/biz/wechatpay`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/wechat`
- `ljd-交接文件/service/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/src/main/java/com/yjs/cloud/learning/pay/biz/wechatpay`
- `ljd-交接文件/service_2/ihui-ai-edu-pay-service/target/classes/com/yjs/cloud/learning/pay/biz/wechatpay`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/wechat`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/src/main/java/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/wechat`
- `ljd-交接文件/service_2/ihui-ai-edu-usercenter-service/target/classes/com/yjs/cloud/learning/usercenter/biz/workwechat`
- `zhs_app-ZZ/Ai-WXMiniVue/dist/build/mp-weixin`
- `zhs_app-ZZ/Ai-WXMiniVue/dist/dev/app-plus/static/images/wechat_file.png`
- `zhs_app-ZZ/Ai-WXMiniVue/dist/dev/mp-weixin`
- `zhs_app-ZZ/Ai-WXMiniVue/src/static/images/wechat_file.png`
- `zhs_app-ZZ/Ai-WXMiniVue/src/uniCloud-aliyun/cloudfunctions/uni-id-co/lib/third-party/weixin`
- `zhs_app-ZZ/Ai-WXMiniVue/src/uniCloud-aliyun/cloudfunctions/uni-id-co/lib/utils/weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/src/uniCloud-aliyun/cloudfunctions/uni-id-co/module/login/login-by-weixin-mobile.js`
- `zhs_app-ZZ/Ai-WXMiniVue/src/uniCloud-aliyun/cloudfunctions/uni-id-co/module/login/login-by-weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/src/uniCloud-aliyun/cloudfunctions/uni-id-co/module/relate/bind-mobile-by-mp-weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/src/uniCloud-aliyun/cloudfunctions/uni-id-co/module/relate/bind-weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/src/uniCloud-aliyun/cloudfunctions/uni-id-co/module/relate/unbind-weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/src/uniCloud-aliyun/cloudfunctions/uni-id-co/module/utils/secure-network-handshake-by-weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/src/uni_modules/uni-open-bridge-common/uniCloud/cloudfunctions/common/uni-open-bridge-common/weixin-server.js`
- `zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/uni-id-co/lib/third-party/weixin`
- `zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/uni-id-co/lib/utils/weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/uni-id-co/module/login/login-by-weixin-mobile.js`
- `zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/uni-id-co/module/login/login-by-weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/uni-id-co/module/relate/bind-mobile-by-mp-weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/uni-id-co/module/relate/bind-weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/uni-id-co/module/relate/unbind-weixin.js`
- `zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/uni-id-co/module/utils/secure-network-handshake-by-weixin.js`

## 14. 资源文件 (data / json / videos)

### edu client/data JSON
- `data/ai-agent-tutorials.json`
- `data/ai-coding-communities.json`
- `data/ai-coding-tools-comparison.json`
- `data/claude-code-tutorials.json`
- `data/clawdbot-import-articles.json`
- `data/clawdbot-import-resources.json`
- `data/clawdbot-resources.json`
- `data/cursor-skills-tutorials.json`
- `data/mcp-tutorials.json`
- `data/prompt-engineering-tutorials.json`
- `data/vibe-coding-tutorials.json`

### Ai-WXMiniVue static 资源
- `src/static/`
- `src/static/css/`
- `src/static/fonts/`
- `src/static/icons/`
- `src/static/images/`
- `src/static/images/add/`
- `src/static/images/default/`
- `src/static/images/model-plaza/`
- `src/static/images/xtk/`
- `src/static/tabbar/`

## 15. 前端路由配置文件

### edu client/web
- `src/components/RouterGuard/routerGuardLoadScript.js`
- `src/router`
- `src/router/index.js`
### edu client/admin
- `src/components/RouterGuard/routerGuardLoadScript.js`
- `src/router`
- `src/router/index.js`
### ihui-ai-admin-frontend

---

## 摘要统计

| 维度 | 数量 |
|------|------|
| edu service 服务 | 22 |
| edu service Controller | 131 |
| edu service HTTP 端点 | 677 |
| edu client/service Controller | 132 |
| ZHS_Server_java Controller | 39 |
| ai-smart-society-java Controller | 114 |

