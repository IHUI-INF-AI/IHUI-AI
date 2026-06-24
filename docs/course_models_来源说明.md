# course_models.py 来源说明

> 维护日期：2026-06-24
> 维护人：迁移审计
> 风险等级：🟡 P2（命名误导，新人易混淆）

## ⚠️ 关键结论

`server/app/models/course_models.py` 中的 14 个 model 类**全部来自 ZHS_Server_java 项目（com.ai.manager.course.domain.\*）**，**与 ihui-ai-edu-learn-service 的 26 个 entity 完全没有字段对应关系**。

真正的 learn-service 迁移集中在 [`learn_models.py`](file:///g:/IHUI-AI/server/app/models/learn_models.py)（含 25 个 model，已完整覆盖 25 个 entity）。

## 一、course_models.py 内 14 个 model 真实来源

| # | Model 类 | 表名 | 真实来源 | 与 learn-service 关系 |
|---|---|---|---|---|
| 1 | `Course` | zhs_course | zhs_educational_training.zhs_course | ❌ 无关 |
| 2 | `CourseVideo` | zhs_course_video | zhs_educational_training.zhs_course_video | ❌ 无关 |
| 3 | `EducationalCourse` | zhs_educational_course | zhs_educational_training.zhs_educational_course | ❌ 无关 |
| 4 | `EducationPlatform` | zhs_education_platform | zhs_educational_training.zhs_education_platform | ❌ 无关 |
| 5 | `ZhsCourseNew` | zhs_course_new | ZHS_Server_java course 域 | ❌ 无关 |
| 6 | `ZhsIdentityExtended` | zhs_identity_ext | ZHS_Server_java identity 域 | ❌ 无关 |
| 7 | `ZhsOrganizationExtended` | zhs_organization_ext | ZHS_Server_java org 域 | ❌ 无关 |

（注：文件头注释仅列 4 个 model，文件中实际有 7 个 class，含 2 个 alias）

## 二、learn-service 的 25 个 entity 真实落位

| # | H 盘 entity | G 盘 model | 表名 | 状态 |
|---|---|---|---|---|
| 1 | Lesson | Lesson | t_lesson | ✅ |
| 2 | LessonChapter | LessonChapter | t_lesson_chapter | ✅ |
| 3 | LessonChapterSection | LessonChapterSection | t_lesson_chapter_section | ✅ |
| 4 | LessonCategoryRelation | LessonCategoryRelation | t_lesson_category_relation | ✅ |
| 5 | SignUp | SignUp | t_sign_up | ✅ |
| 6 | Record | Record | t_record | ✅ |
| 7 | RecordLog | RecordLog | t_record_log | ✅ |
| 8 | LessonTask | LessonTask | lesson_task | ✅ |
| 9 | Rate | Rate | t_rate | ✅ |
| 10 | Topic | Topic | t_topic | ✅ |
| 11 | TopicLesson | TopicLesson | t_topic_lesson | ✅ |
| 12 | TopicTopicCategoryRelation | TopicTopicCategoryRelation | t_topic_topic_category_relation | ✅ |
| 13 | TopicCategory | TopicCategory | t_topic_category | ✅ |
| 14 | TopicCategoryRelation | TopicCategoryRelation | t_topic_category_relation | ✅ |
| 15 | Category | Category | t_category | ✅ |
| 16 | CategoryRelation | CategoryRelation | t_category_relation | ✅ |
| 17 | Homework | Homework | homework | ✅ |
| 18 | HomeworkRecord | HomeworkRecord | t_homework_record | ✅ |
| 19 | Certificate | Certificate | t_certificate | ✅ |
| 20 | CertificateTemplate | CertificateTemplate | t_certificate_template | ✅ |
| 21 | CertificateSerialNumber | CertificateSerialNumber | t_certificate_serial_number | ✅ |
| 22 | LearnMap | LearnMap | t_learn_map | ✅ |
| 23 | LearnMapTopic | LearnMapTopic | t_learn_map_topic | ✅ |
| 24 | LessonAccess | LessonAccess | lesson_access | ✅ |
| 25 | ExamPaperRecord | ExamPaperRecord | t_exam_paper_record | ✅ |

## 三、learn-service 字段类型差异（按 2026-06-24 核对结果）

| H 字段 | H 类型 | G 字段 | G 类型 | 差异说明 |
|---|---|---|---|---|
| price / originalPrice | BigDecimal | price / original_price | Integer(分) | 单位元→分，避免浮点精度问题 |
| totalTime | Long | total_time | Integer | 范围够用，无溢出风险 |
| score (ExamPaperRecord) | Long | score | Integer | 分数必为整数 |
| progress (Record) | BigDecimal | progress | Integer(0-100) | 进度用 0-100 整数百分比 |
| phrase / introduction / description | String | 同名 | Text | 长度上限移除，不影响业务 |
| status (枚举) | 枚举 | status | Integer | 业务层枚举值映射 |
| content | String | content | Text | 同上 |

## 四、建议（封版期不重构）

1. **不改名**：避免在封版期引入大改动，保留 `course_models.py` 原名。
2. **加注释**：在 `course_models.py` 顶部增加本说明文档的简短引用（已通过 file:// 链接实现）。
3. **新人 onboarding**：在 onboarding 文档顶部明确指出"学习服务请看 `learn_models.py`，不要看 `course_models.py`"。

## 五、引用

- 完整 learn-service 字段对比：[迁移字段对比报告.md §4. learn-service](file:///g:/IHUI-AI/docs/%E8%BF%81%E7%A7%BB%E5%AD%97%E6%AE%B5%E5%AF%B9%E6%AF%94%E6%8A%A5%E5%91%8A.md)
- H 盘 learn-service 源码：`H:\edu client\service\service\ihui-ai-edu-learn-service\src\main\java\com\yjs\cloud\learning\learn\biz\**\entity\*.java`（只读）
