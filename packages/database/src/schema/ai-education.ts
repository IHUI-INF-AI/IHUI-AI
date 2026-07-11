import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  real,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

/**
 * AI 教育政策表 (ai_education_policy)。
 * 记录国家/地方/行业发布的 AI 教育相关政策文件，支持按级别/状态/关键词筛选。
 * policy_level: national/provincial/industry/school。
 * status: active/abrogated/draft。
 * 软删除：deleted_at 非空视为已删除。
 */
export const aiEducationPolicy = pgTable(
  'ai_education_policy',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    policyName: varchar('policy_name', { length: 300 }).notNull(),
    issuingAuthority: varchar('issuing_authority', { length: 200 }).notNull(),
    issueDate: date('issue_date'),
    effectiveDate: date('effective_date'),
    policyLevel: varchar('policy_level', { length: 50 }),
    targetGroup: varchar('target_group', { length: 200 }),
    summary: text('summary'),
    keyPoints: text('key_points'),
    implementation: text('implementation'),
    goals: text('goals'),
    supportingMeasures: text('supporting_measures'),
    relatedPolicies: text('related_policies'),
    sourceUrl: varchar('source_url', { length: 500 }),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    levelIdx: index('ix_ai_edu_policy_level').on(t.policyLevel),
    statusIdx: index('ix_ai_edu_policy_status').on(t.status),
  }),
)

/**
 * AI 师资认证表 (ai_teacher_certification)。
 * 记录各类 AI 教师培训与认证项目（发证机构/培训内容/考核方式/有效期等）。
 * level: primary/intermediate/advanced。
 */
export const aiTeacherCertification = pgTable(
  'ai_teacher_certification',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    certName: varchar('cert_name', { length: 200 }).notNull(),
    issuingAuthority: varchar('issuing_authority', { length: 200 }).notNull(),
    targetTeachers: varchar('target_teachers', { length: 200 }),
    level: varchar('level', { length: 50 }),
    trainingHours: integer('training_hours'),
    trainingContent: text('training_content'),
    assessmentMethod: text('assessment_method'),
    certificationRequirements: text('certification_requirements'),
    validity: varchar('validity', { length: 100 }),
    benefits: text('benefits'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    levelIdx: index('ix_ai_teacher_cert_level').on(t.level),
  }),
)

/**
 * AIGC 工具详情表 (aigc_tool_detail)。
 * 记录 AIGC 工具的详细信息（分类/定价/功能/优缺点/评分等），供前端工具目录展示。
 * category: text/image/video/audio/code/3d/agent。
 */
export const aigcToolDetail = pgTable(
  'aigc_tool_detail',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    nameCn: varchar('name_cn', { length: 100 }),
    category: varchar('category', { length: 50 }).notNull(),
    subcategory: varchar('subcategory', { length: 50 }),
    provider: varchar('provider', { length: 200 }),
    url: varchar('url', { length: 500 }),
    description: text('description'),
    coreFeatures: text('core_features'),
    useCases: text('use_cases'),
    pricingModel: varchar('pricing_model', { length: 50 }),
    pricingDetail: text('pricing_detail'),
    freeTier: varchar('free_tier', { length: 100 }),
    generationSpeed: varchar('generation_speed', { length: 100 }),
    outputQuality: varchar('output_quality', { length: 100 }),
    chineseSupport: varchar('chinese_support', { length: 50 }),
    learningCurve: varchar('learning_curve', { length: 50 }),
    apiAvailable: boolean('api_available').default(false).notNull(),
    mobileApp: boolean('mobile_app').default(false).notNull(),
    pros: text('pros'),
    cons: text('cons'),
    tips: text('tips'),
    alternatives: text('alternatives'),
    rating: real('rating'),
    userCount: varchar('user_count', { length: 100 }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index('ix_aigc_tool_category').on(t.category),
    ratingIdx: index('ix_aigc_tool_rating').on(t.rating),
  }),
)

/**
 * K12 AI 课程标准表 (k12_ai_curriculum)。
 * 记录中小学 AI 课程标准（学段/年级/课时/目标/模块/评价等）。
 * stage: primary/junior/senior。
 */
export const k12AiCurriculum = pgTable(
  'k12_ai_curriculum',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stage: varchar('stage', { length: 50 }).notNull(),
    gradeRange: varchar('grade_range', { length: 100 }),
    courseName: varchar('course_name', { length: 200 }),
    hoursPerYear: integer('hours_per_year'),
    courseType: varchar('course_type', { length: 50 }),
    learningObjectives: text('learning_objectives'),
    contentModules: text('content_modules'),
    keyConcepts: text('key_concepts'),
    skillRequirements: text('skill_requirements'),
    teachingMethods: text('teaching_methods'),
    assessmentMethods: text('assessment_methods'),
    toolsResources: text('tools_resources'),
    integrationSubjects: text('integration_subjects'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    stageIdx: index('ix_k12_ai_curr_stage').on(t.stage),
  }),
)

/**
 * 高校 AI 通识课程表 (university_ai_course)。
 * 记录高校 AI 通识/专业课程的详细信息（学分/学时/模块/教材/考核等）。
 */
export const universityAiCourse = pgTable(
  'university_ai_course',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    courseName: varchar('course_name', { length: 200 }).notNull(),
    courseType: varchar('course_type', { length: 50 }),
    targetMajor: varchar('target_major', { length: 200 }),
    credits: real('credits'),
    hours: integer('hours'),
    university: varchar('university', { length: 200 }),
    description: text('description'),
    modules: text('modules'),
    prerequisites: text('prerequisites'),
    textbooks: text('textbooks'),
    teachingTeam: text('teaching_team'),
    assessment: text('assessment'),
    isRequired: boolean('is_required').default(false).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    universityIdx: index('ix_uni_ai_course_university').on(t.university),
    typeIdx: index('ix_uni_ai_course_type').on(t.courseType),
  }),
)

export type AiEducationPolicy = typeof aiEducationPolicy.$inferSelect
export type NewAiEducationPolicy = typeof aiEducationPolicy.$inferInsert
export type AiTeacherCertification = typeof aiTeacherCertification.$inferSelect
export type NewAiTeacherCertification = typeof aiTeacherCertification.$inferInsert
export type AigcToolDetail = typeof aigcToolDetail.$inferSelect
export type NewAigcToolDetail = typeof aigcToolDetail.$inferInsert
export type K12AiCurriculum = typeof k12AiCurriculum.$inferSelect
export type NewK12AiCurriculum = typeof k12AiCurriculum.$inferInsert
export type UniversityAiCourse = typeof universityAiCourse.$inferSelect
export type NewUniversityAiCourse = typeof universityAiCourse.$inferInsert
