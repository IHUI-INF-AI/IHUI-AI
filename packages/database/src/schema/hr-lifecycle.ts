// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  date,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { hrEmployee, hrDepartment } from './hr-ai-management.js'
import { users } from './users.js'

/**
 * 人事生命周期(2026-11-23 立,补齐"招聘 → 入职 → 合同 → 试用转正 → 离职"主干)。
 *
 * 设计边界:
 *   · 主档仍以 hr_employee 为唯一中心,本文件不复制员工字段,只补"与员工相关的过程单据";
 *   · 合同/转正/离职/招聘各有独立状态机,状态推进只允许服务层 hs-lifecycle 动作函数,
 *     路由不直接写状态(避免"谁都能改状态"导致看板失真);
 *   · 多级审批不在此自建:请假走 hr_approval_*(leave_request 强绑),本模块保留
 *     approval_instance 关联位(approval_ref varchar),接入时只填空、不改状态机。
 */

/** 合同类型:fixed(固定期限) / indefinite(无固定期限) / internship(实习) / parttime(非全日制) / labor(劳务) */
export const HR_CONTRACT_TYPES = ['fixed', 'indefinite', 'internship', 'parttime', 'labor'] as const
export type HrContractType = (typeof HR_CONTRACT_TYPES)[number]

/** 合同状态:draft(待签) / signed(生效) / expiring(即将到期,派生态不落库) / expired / terminated(解除) / renewed(已续签) */
export const HR_CONTRACT_STATUS = ['draft', 'signed', 'expired', 'terminated', 'renewed'] as const
export type HrContractStatus = (typeof HR_CONTRACT_STATUS)[number]

/**
 * 劳动合同表 (hr_contract)。
 * probation_end_date 由 probation_months 在服务层推导(自然月加月、末日对齐),
 * 不存冗余到期提醒:到期/试用到期一律用 date 现算,避免"今天到期"写死进库再过期失真。
 */
export const hrContract = pgTable(
  'hr_contract',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    /** 合同编号(企业内唯一) */
    contractNo: varchar('contract_no', { length: 60 }).notNull(),
    contractType: varchar('contract_type', { length: 20 }).default('fixed').notNull(),
    startDate: date('start_date').notNull(),
    /** 固定期限必填;无固定期限为 NULL */
    endDate: date('end_date'),
    /** 试用期月数 0~6;0 = 无试用期 */
    probationMonths: integer('probation_months').default(0).notNull(),
    /** 试用期结束日(服务层推导落库,便于"试用到期未评估"一次查询;NULL = 无试用期) */
    probationEndDate: date('probation_end_date'),
    /** 试用期工资比例(%,如 80);NULL = 合同未约定 */
    probationSalaryRate: numeric('probation_salary_rate', { precision: 5, scale: 2 }),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    /** 签署附件地址(对象存储/cdn 链接) */
    fileUrl: varchar('file_url', { length: 500 }),
    /** 续签链:本条合同由哪份旧合同续来 */
    parentContractId: uuid('parent_contract_id').references((): AnyPgColumn => hrContract.id, {
      onDelete: 'set null',
    }),
    /** 解除/终止原因(terminated 时填) */
    terminateReason: text('terminate_reason'),
    /** 外部审批单号占位(接 hr_approval 或 OA 时填) */
    approvalRef: varchar('approval_ref', { length: 100 }),
    remark: text('remark'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeIdx: index('ix_hr_contract_emp').on(t.employeeId),
    noIdx: uniqueIndex('uq_hr_contract_no').on(t.contractNo),
    endIdx: index('ix_hr_contract_end').on(t.endDate),
    statusIdx: index('ix_hr_contract_status').on(t.status),
  }),
)

/** 转正评估结果:pass(通过) / extend(延长试用) / fail(不予转正) */
export const HR_PROBATION_RESULTS = ['pass', 'extend', 'fail'] as const
export type HrProbationResult = (typeof HR_PROBATION_RESULTS)[number]

/**
 * 试用期转正评估表 (hr_probation_review)。
 * pass 且落库成功时,服务层同笔写 hr_employee.regular_date = decided_at 当日;
 * extend 必填 extended_until(不得早于原试用结束日);fail 只记录结论,不自动改员工状态。
 */
export const hrProbationReview = pgTable(
  'hr_probation_review',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    /** 关联合同(评估对象是这份合同的试用期) */
    contractId: uuid('contract_id').references(() => hrContract.id, { onDelete: 'set null' }),
    result: varchar('result', { length: 20 }).notNull(),
    /** 评估得分 0~100,可空 */
    score: integer('score'),
    selfSummary: text('self_summary'),
    managerComment: text('manager_comment'),
    /** extend 时的延长后试用结束日 */
    extendedUntil: date('extended_until'),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeIdx: index('ix_hr_probation_emp').on(t.employeeId),
    resultIdx: index('ix_hr_probation_result').on(t.result),
  }),
)

/** 离职原因:voluntary(主动) / contract_end(合同到期) / dismissal(辞退) / mutual(协商一致) / retire(退休) / other */
export const HR_RESIGN_REASONS = [
  'voluntary',
  'contract_end',
  'dismissal',
  'mutual',
  'retire',
  'other',
] as const
export type HrResignReason = (typeof HR_RESIGN_REASONS)[number]

/** 离职状态:applied(申请) / approved(已批) / settled(已办结) / cancelled(撤销) */
export const HR_RESIGN_STATUS = ['applied', 'approved', 'settled', 'cancelled'] as const
export type HrResignStatus = (typeof HR_RESIGN_STATUS)[number]

/**
 * 离职申请表 (hr_resignation)。
 * 状态机:applied → approved → settled(终态,员工置 left + resign_date);
 * applied 可 cancelled;approved 不可撤销(只能协商后另走流程)。
 * checklist 为交接清单勾选快照(键值对,键为条目名、值为布尔),办结时要求全部为真。
 */
export const hrResignation = pgTable(
  'hr_resignation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    applyDate: date('apply_date').notNull(),
    /** 最后工作日(不得早于申请日) */
    lastWorkDate: date('last_work_date').notNull(),
    reasonType: varchar('reason_type', { length: 20 }).default('voluntary').notNull(),
    reason: text('reason'),
    /** 交接人(员工 id) */
    handoverTo: uuid('handover_to').references(() => hrEmployee.id, { onDelete: 'set null' }),
    handoverNote: text('handover_note'),
    status: varchar('status', { length: 20 }).default('applied').notNull(),
    checklist: jsonb('checklist').$type<Record<string, boolean>>().default({}).notNull(),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    /** 离职证明编号(办结时生成,格式 RESIGN-YYMMDD-<id 前 6 位>) */
    certificateNo: varchar('certificate_no', { length: 60 }),
    /** 最后一次在职日期快照,用于离职证明与薪资结算参考 */
    lastSalaryPeriod: varchar('last_salary_period', { length: 20 }),
    approvalRef: varchar('approval_ref', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeIdx: index('ix_hr_resign_emp').on(t.employeeId),
    statusIdx: index('ix_hr_resign_status').on(t.status),
    lastWorkIdx: index('ix_hr_resign_last_work').on(t.lastWorkDate),
  }),
)

/** 招聘岗位状态:draft / open(在招) / paused(暂停) / closed(关闭) */
export const HR_OPENING_STATUS = ['draft', 'open', 'paused', 'closed'] as const
export type HrOpeningStatus = (typeof HR_OPENING_STATUS)[number]

/**
 * 招聘岗位表 (hr_job_opening)。
 * 一个岗位一条记录,head_count 为计划人数,hired_count 在录用闭环时自增;
 * 达到计划人数不自动关岗(可能超招),由人显式 close。
 */
export const hrJobOpening = pgTable(
  'hr_job_opening',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 岗位编号(企业内唯一,招聘看板与报表引用) */
    code: varchar('code', { length: 60 }).notNull(),
    title: varchar('title', { length: 100 }).notNull(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    headCount: integer('head_count').default(1).notNull(),
    hiredCount: integer('hired_count').default(0).notNull(),
    employmentType: varchar('employment_type', { length: 20 }).default('fulltime').notNull(),
    /** 薪资区间(整数分),仅展示不参与算薪 */
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    requirements: text('requirements'),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: uniqueIndex('uq_hr_opening_code').on(t.code),
    deptIdx: index('ix_hr_opening_dept').on(t.departmentId),
    statusIdx: index('ix_hr_opening_status').on(t.status),
  }),
)

/** 候选人阶段:applied(已投递) / screening(筛选中) / interview(面试中) / offer(已发 offer) / hired(已入职) / rejected(淘汰) / withdrawn(放弃) */
export const HR_CANDIDATE_STAGES = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const
export type HrCandidateStage = (typeof HR_CANDIDATE_STAGES)[number]

/**
 * 候选人表 (hr_candidate)。
 * stage 只允许服务层 advanceCandidate 推进;rejected 必须带 reason(便于渠道复盘)。
 */
export const hrCandidate = pgTable(
  'hr_candidate',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    openingId: uuid('opening_id')
      .notNull()
      .references(() => hrJobOpening.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    email: varchar('email', { length: 120 }),
    /** 简历地址 */
    resumeUrl: varchar('resume_url', { length: 500 }),
    /** 来源渠道(boss/liepin/referral/campus/other) */
    source: varchar('source', { length: 30 }).default('other').notNull(),
    stage: varchar('stage', { length: 20 }).default('applied').notNull(),
    rejectReason: text('reject_reason'),
    /** 期望薪资(整数分) */
    expectedSalary: integer('expected_salary'),
    appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow().notNull(),
    /** 录用后落成的员工 id(招聘→入职闭环的回指) */
    employeeId: uuid('employee_id').references(() => hrEmployee.id, { onDelete: 'set null' }),
    remark: text('remark'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    openingIdx: index('ix_hr_candidate_opening').on(t.openingId),
    stageIdx: index('ix_hr_candidate_stage').on(t.stage),
    employeeIdx: index('ix_hr_candidate_emp').on(t.employeeId),
  }),
)

/** 面试轮次结果:pending / pass / fail */
export const HR_INTERVIEW_RESULTS = ['pending', 'pass', 'fail'] as const
export type HrInterviewResult = (typeof HR_INTERVIEW_RESULTS)[number]

/** 面试方式:onsite(现场) / phone(电话) / video(视频) */
export const HR_INTERVIEW_MODES = ['onsite', 'phone', 'video'] as const

/**
 * 面试安排与面评表 (hr_interview)。
 * 一轮一条;result=pass 且为最后一轮时由服务层推至 offer(不自动发 offer,只改阶段)。
 */
export const hrInterview = pgTable(
  'hr_interview',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => hrCandidate.id, { onDelete: 'cascade' }),
    /** 轮次(1 起) */
    round: integer('round').default(1).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    mode: varchar('mode', { length: 20 }).default('onsite').notNull(),
    /** 面试官姓名快照(外部面试官未必有账号) */
    interviewerName: varchar('interviewer_name', { length: 100 }),
    interviewerId: uuid('interviewer_id').references(() => users.id, { onDelete: 'set null' }),
    score: integer('score'),
    result: varchar('result', { length: 20 }).default('pending').notNull(),
    feedback: text('feedback'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    candidateIdx: index('ix_hr_interview_candidate').on(t.candidateId, t.round),
    resultIdx: index('ix_hr_interview_result').on(t.result),
    scheduledIdx: index('ix_hr_interview_scheduled').on(t.scheduledAt),
  }),
)

export type HrContract = typeof hrContract.$inferSelect
export type NewHrContract = typeof hrContract.$inferInsert
export type HrProbationReview = typeof hrProbationReview.$inferSelect
export type NewHrProbationReview = typeof hrProbationReview.$inferInsert
export type HrResignation = typeof hrResignation.$inferSelect
export type NewHrResignation = typeof hrResignation.$inferInsert
export type HrJobOpening = typeof hrJobOpening.$inferSelect
export type NewHrJobOpening = typeof hrJobOpening.$inferInsert
export type HrCandidate = typeof hrCandidate.$inferSelect
export type NewHrCandidate = typeof hrCandidate.$inferInsert
export type HrInterview = typeof hrInterview.$inferSelect
export type NewHrInterview = typeof hrInterview.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
