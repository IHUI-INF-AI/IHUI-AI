// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815964:长任务提交(反馈提交一类)的全局作业注册表 —— 按 jobId 可取(get)、可丢(dismiss),
 * 并按 jobId 冻结提交瞬间的表单快照。
 *
 * 形态对齐上游 packages/ui/src/feedback/feedbackSubmissionJob.ts:全局 Map + globalListeners,
 * 作业句柄带 getState/subscribe。快照的成文理由(上游 :61 同型):提交瞬间的用户表单快照,
 * 用于按 jobId 重新打开对应反馈 —— 用户关掉对话框不等于放弃这份数据。
 *
 * 最关键的守卫(上游 :148-155 同型):`paused-log`(等待用户继续上传日志)的作业**拒绝丢弃**。
 * 否则"关闭对话框"的清理钩子会顺手把等待补日志的作业清掉,用户后续上传的日志再也接不上。
 * dismiss 对该态返回 false 而不是抛错:守卫的职责是拦住数据丢失,不是打断"关对话框"这个动作
 * 本身(抛错会把正常关闭流程也砸了);"false 是没丢成还是本来就没有"由 getSubmissionJob 区分。
 *
 * 状态闭集四个值,不新增不并桶;首个消费点是 web 反馈上传链 —— 接线前本模块只提供注册表
 * 与它的判据测试,不造 UI。
 */

/** 状态闭集。`paused-log` 是"提交被挂起、等用户继续上传日志"的中间态,不是失败也不是完成。 */
export type SubmissionJobStatus = 'running' | 'paused-log' | 'success' | 'error'

/**
 * 提交瞬间的用户表单快照的形状:纯数据键值(标题/正文/联系方式/截图清单一类)。
 * 注册时深拷贝并逐层冻结 —— 此后调用方再怎么改原表单对象,这份快照都还原样。
 */
export type SubmissionFormSnapshot = Readonly<Record<string, unknown>>

export interface SubmissionJobSnapshot<TForm extends object = SubmissionFormSnapshot> {
  readonly jobId: string
  readonly status: SubmissionJobStatus
  readonly form: TForm
  /** 仅 status === 'error' 时在键:人类可读的失败原因;从没失败过 ⇒ 键缺席,不是空串。 */
  readonly error?: string
  /** 仅 status === 'success' 且调用方带回了结果时在键(如服务端反馈编号)。 */
  readonly result?: unknown
}

/** 注册入参:jobId 全局唯一;form 是提交瞬间的表单,注册那一刻被冻结成快照。 */
export interface RegisterSubmissionJobInput<TForm extends object> {
  readonly jobId: string
  readonly form: TForm
}

export interface SubmissionJobHandle<TForm extends object = SubmissionFormSnapshot> {
  readonly jobId: string
  /** 作业被显式丢弃后返回 null —— 句柄还在手上的事实不等于作业还在注册表里。 */
  getState(): SubmissionJobSnapshot<TForm> | null
  /** 本作业的状态迁移通知;返回退订函数。 */
  subscribe(listener: () => void): () => void
  /** running → paused-log:提交被挂起,等用户继续上传日志。 */
  pauseLog(): void
  /** paused-log → running:用户补完日志,提交继续。 */
  resume(): void
  /** → success;`result` 是服务端带回的结果(如反馈编号),不带则 result 键缺席。 */
  succeed(result?: unknown): void
  /** → error;`error` 是人类可读的失败原因。 */
  fail(error: string): void
}

interface InternalJob {
  readonly jobId: string
  /** 冻结的快照,状态迁移时整体重建 —— 读到的人拿到的永远是某一刻的完整态。注册表对泛型擦形成基形。 */
  snapshot: SubmissionJobSnapshot<SubmissionFormSnapshot>
  readonly listeners: Set<() => void>
}

const jobs = new Map<string, InternalJob>()
const globalListeners = new Set<() => void>()

function notify(listeners: ReadonlySet<() => void>): void {
  for (const listener of [...listeners]) listener()
}

function notifyJob(job: InternalJob): void {
  notify(job.listeners)
  notify(globalListeners)
}

/** 深冻结:快照的每一层都不可再改,"冻结"才算数(只冻顶层,内层数组照样能被 push 穿)。 */
function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return
  Object.freeze(value)
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key])
  }
}

/**
 * 冻结提交瞬间的表单快照:先深拷贝再深冻结。
 * 深拷贝是必须的 —— 直接 freeze 调用方的原对象会把用户还活着的表单一起冻死;
 * structuredClone 不可克隆(表单里混进函数一类非数据)时退回浅拷贝并继续冻结,
 * 顶层隔离的保证不丢,也不静默吞字段。
 */
function freezeFormSnapshot<T extends object>(form: T): T {
  let copy: unknown
  try {
    copy = structuredClone(form)
  } catch {
    copy = { ...form }
  }
  deepFreeze(copy)
  return copy as T
}

function applyStatus(
  job: InternalJob,
  status: SubmissionJobStatus,
  extra: { error?: string; result?: unknown } = {},
): void {
  // 作业已被显式丢弃后句柄上的迟到迁移是空操作:注册表是唯一真相,不在就是不在,
  // 不悄悄复活(真要重来就重新注册一个新 jobId)。
  if (!jobs.has(job.jobId)) return
  job.snapshot = Object.freeze({
    jobId: job.jobId,
    status,
    form: job.snapshot.form,
    ...(extra.error !== undefined ? { error: extra.error } : {}),
    ...(extra.result !== undefined ? { result: extra.result } : {}),
  })
  notifyJob(job)
}

/** 注册一个提交作业:初始态 running,表单在注册瞬间被冻结为快照。jobId 重复 ⇒ 报错拒绝(复用 id 会孤儿化旧作业的订阅者,不静默覆盖)。 */
export function registerSubmissionJob<TForm extends object>(
  input: RegisterSubmissionJobInput<TForm>,
): SubmissionJobHandle<TForm> {
  const { jobId, form } = input
  if (jobs.has(jobId)) {
    throw new Error(`submission-job: jobId 已注册(${jobId}),拒绝静默覆盖 —— 复用 id 会孤儿化旧作业的订阅者`)
  }
  const job: InternalJob = {
    jobId,
    snapshot: Object.freeze({
      jobId,
      status: 'running',
      // 擦形边界:注册表只存基形;句柄侧的回填依据是"句柄与表单同刻而生"(见 getState)。
      form: freezeFormSnapshot(form) as SubmissionFormSnapshot,
    }),
    listeners: new Set(),
  }
  jobs.set(jobId, job)
  notify(globalListeners)
  return {
    jobId,
    // 句柄与表单同刻而生(只能出自本次 registerSubmissionJob),冻结在注册表里的就是
    // 本次所注册表单的副本 ⇒ 回填 TForm 有据;注册表这一侧对泛型擦形成基形。
    getState: () => (jobs.get(jobId)?.snapshot ?? null) as SubmissionJobSnapshot<TForm> | null,
    subscribe(listener) {
      job.listeners.add(listener)
      return () => {
        job.listeners.delete(listener)
      }
    },
    pauseLog: () => applyStatus(job, 'paused-log'),
    resume: () => applyStatus(job, 'running'),
    succeed: (result?: unknown) => applyStatus(job, 'success', { result }),
    fail: (error: string) => applyStatus(job, 'error', { error }),
  }
}

/** 按 jobId 取当前快照;没有这个作业(从未注册或已丢弃)⇒ null。 */
export function getSubmissionJob(jobId: string): SubmissionJobSnapshot | null {
  return jobs.get(jobId)?.snapshot ?? null
}

/**
 * 按 jobId 丢弃一个作业。真删除 ⇒ true;没删成 ⇒ false。
 *
 * false 的两种成因可由 getSubmissionJob 区分:取回 paused-log 的作业 ⇒ 被**守卫拒绝**
 * (`paused-log` 在等用户继续上传日志,删了用户的日志就再也接不上 —— 上游 :148-155 同型);
 * 取回 null ⇒ 本来就没有(已丢或不存在的 id)。终态(success/error)必须真能删,否则
 * 注册表就成了只进不出的泄漏。
 */
export function dismissSubmissionJob(jobId: string): boolean {
  const job = jobs.get(jobId)
  if (!job) return false
  if (job.snapshot.status === 'paused-log') return false
  jobs.delete(jobId)
  notifyJob(job)
  return true
}

/** 全局订阅:任何注册/迁移/丢弃都会通知。返回退订函数。 */
export function subscribeSubmissionJobs(listener: () => void): () => void {
  globalListeners.add(listener)
  return () => {
    globalListeners.delete(listener)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
