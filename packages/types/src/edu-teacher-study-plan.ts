// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教师侧「学习计划编排」屏的形状单源
 * (web `edu/edu-management/study-plan` ↔ RN `EduTeacherStudyPlan`)。
 *
 * 2026-10-28 立:RN 此前只有 `EduChildStudyPlansScreen`(家长视角只读
 * `GET /api/edu-ai-management/parent/children/:childId/study-plans`),与本屏**不是同一物** ——
 * 教师侧要选学期/班级、建计划、改计划、删计划、把月计划自动拆成周计划,故新建屏而不复用。
 *
 * ⚠️ 后端实回(读 `apps/api/src/routes/edu-ai-management.ts`,非臆测):
 *  - `GET  /api/edu-ai-management/term`                       ⇒ `success({ list, total, page, pageSize, totalPages })`
 *  - `GET  /api/edu-ai-management/class?termId=`               ⇒ `success({ list })`
 *  - `GET  /api/edu-ai-management/study-plan?termId=&classId=`  ⇒ `success({ list, total, ... })`
 *  - `GET  /api/edu-ai-management/study-plan/:id/items`        ⇒ `success({ items })`(**不是** web 读的 `{ list }`)
 *  - `POST /api/edu-ai-management/study-plan`                  ⇒ 201 `success({ plan })`
 *  - `PUT  /api/edu-ai-management/study-plan/:id`              ⇒ `success({ plan })`
 *  - `DELETE /api/edu-ai-management/study-plan/:id`            ⇒ `success({ deleted })`(软删)
 *  - `POST /api/edu-ai-management/study-plan/:id/auto-split`   ⇒ 201 `success({ count, plans })`
 *  - `PUT  /api/edu-ai-management/plan-item/:id`               ⇒ `success({ item })`
 *  计划条目**没有** `POST /plan-item/:id`;新建走 `POST /study-plan/:id/items`
 *  (createPlanItemSchema),故本切片只承载条目勾选(PUT),不承载条目新建/删除。
 *
 * `status` 在服务端是 `z.string().max(20)`(不是枚举),库里理论上可存任意串 ⇒
 * 类型如实声明为 `string`,屏上按已知四档取词、未知档原样回显,不做"未知即草稿"的假归一。
 */
import type { TFunction } from './app-shared.js'

/** 计划类型(后端 `createPlanSchema` 的 z.enum,封闭两值) */
export type EduTeacherPlanType = 'monthly' | 'weekly'

/** 已知的计划状态档位(web `PLAN_STATUS_KEYS` 同集);服务端未约束,故只作渲染取词的子集用 */
export const EDU_TEACHER_PLAN_STATUSES = ['draft', 'active', 'completed', 'archived'] as const

/** 学期(edu_term 行:只声明本屏渲染的列) */
export interface EduTeacherTerm {
  id: string
  name: string
  /** 当前学期标记 —— 选学期时优先落它 */
  isCurrent?: boolean | null
  startDate?: string | null
  endDate?: string | null
}

/** 班级(edu_class 行:只声明本屏渲染的列) */
export interface EduTeacherClass {
  id: string
  name: string
  grade?: string | null
  termId?: string | null
}

/** 学习计划(edu_study_plan 行) */
export interface EduTeacherStudyPlan {
  id: string
  title: string
  planType: EduTeacherPlanType
  classId: string
  termId: string
  /** `YYYY-MM-DD`(服务端直存字符串,不做时区换算) */
  startDate: string
  endDate: string
  description?: string | null
  /** 已知档位见 EDU_TEACHER_PLAN_STATUSES;服务端未约束 ⇒ 保留 string */
  status: string
  /** 非空表示这是某月计划自动拆解出来的周计划 */
  parentPlanId?: string | null
  createdAt?: string | null
}

/** 计划条目(edu_plan_item 行) */
export interface EduTeacherPlanItem {
  id: string
  planId: string
  content: string
  objective?: string | null
  notes?: string | null
  dueDate?: string | null
  parentItemId?: string | null
  completed: boolean
  sortOrder?: number | null
  completedAt?: string | null
}

/**
 * 计划表单受控值。`classId` / `termId` 由页面顶部的学期/班级选择器决定
 * (web 的编辑态表单根本不展示这两项,见 `StudyPlanEditDialog.tsx:142-175`),
 * 故这里只在**新建**时由宿主回填,不放进可编辑集合。
 */
export interface EduTeacherPlanForm {
  title: string
  planType: EduTeacherPlanType
  startDate: string
  endDate: string
  description: string
}

/**
 * `EduTeacherStudyPlanScreen` 受控 props 契约。
 * 平台无关:取数、登录态、导航、提交全在宿主 wrapper;颜色走 colorScheme 语义 token。
 */
export interface EduTeacherStudyPlanScreenProps {
  t: TFunction
  /** 学期候选(空 + 非 loading ⇒ 空态) */
  terms: EduTeacherTerm[]
  /** 当前学期下的班级候选 */
  classes: EduTeacherClass[]
  /** 当前学期/班级下的全部计划(含 auto-split 产出的子计划,屏上按 parentPlanId 折叠) */
  plans: EduTeacherStudyPlan[]
  /** 选中计划的条目;未选中计划时传空数组 */
  items: EduTeacherPlanItem[]
  selectedTermId: string
  selectedClassId: string
  /** 当前展开的计划 id;`null` ⇒ 右侧详情位显示"请选择计划"提示 */
  selectedPlanId: string | null
  /** 表单值;`null` ⇒ 表单弹层关闭 */
  form: EduTeacherPlanForm | null
  /** 非空 ⇒ 表单处于编辑态(可删除),空 ⇒ 新建态 */
  editingPlanId: string | null
  /** 首屏/学期/班级加载中 */
  loading: boolean
  /** 班级列表加载中(切学期时只灰班级选择器,不整屏骨架) */
  classesLoading?: boolean
  /** 条目加载中 */
  itemsLoading?: boolean
  /** 计划表单提交中 */
  saving: boolean
  /** 正在删除的计划 id(用于禁用删除键) */
  deletingPlanId?: string | null
  /** 正在拆解的计划 id(用于禁用拆解键) */
  splittingPlanId?: string | null
  /** 页面级错误文案(加载失败整屏错误态;提交失败则内联红字) */
  error?: string
  /** 一次性提示(如"已拆解为 N 个周计划") */
  notice?: string
  onBack: () => void
  onRetry: () => void
  onSelectTerm: (termId: string) => void
  onSelectClass: (classId: string) => void
  onSelectPlan: (planId: string) => void
  /** 打开新建表单(学期/班级必选,宿主负责禁用) */
  onOpenCreate: () => void
  onOpenEdit: (plan: EduTeacherStudyPlan) => void
  onCloseForm: () => void
  onFormChange: (key: keyof EduTeacherPlanForm, value: string) => void
  onSubmitForm: () => void
  onDeletePlan: (plan: EduTeacherStudyPlan) => void
  onAutoSplit: (plan: EduTeacherStudyPlan) => void
  onUpdateStatus: (plan: EduTeacherStudyPlan, status: string) => void
  /** 勾选/取消勾选条目(PUT /plan-item/:id { completed }) */
  onToggleItem: (item: EduTeacherPlanItem) => void
  colorScheme?: 'light' | 'dark'
}
