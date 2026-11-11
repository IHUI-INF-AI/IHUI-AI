// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育板块学生考勤三端 e2e(票 B71 UI 面)。
 *
 * 覆盖链路(全部在真实浏览器里跑页面组件真实交互):
 *  A. 教师端 /edu/edu-management/attendance:签到 → 列表出现记录 → 状态筛选 → 删除;
 *     批量点名(BatchCheckInDialog 幂等:首轮 created=2,复跑 skipped=2);
 *     回填非当日成对用例(前端拦死不发请求 / 绕开前端直连 ⇒ 400 点名原因);
 *     early(早退)档:签退重判后真入列,文案 + 色档正确且能被单独筛出
 *  B. 学生端 /edu/attendance:自助签到 → 成功提示 → 表格出现当日记录 → 按钮置灰
 *  C. 家长端 /edu/parent/children/:childId/attendance:只读(有统计/记录,无任何写控件)
 *  D. 真实后端链路(不桩数据面):登录态经 web proxy 进教师页,管理端 GET 读路径
 *     (class / attendance / attendance/me / leave)必须真 200 且 code=0 ——
 *     证明页面到 8802 形态后端接线是真的,不是只活在 route mock 里。
 *     本组先做**写接口契约探测**:本机 api 进程若装的是改口前的代码则显式 skip 并打印读数,
 *     不静默 fixme、不为过而改判据(见 probeWriteContract)。
 *
 * 契约口径(2026-11-04 与后端改口对齐,现读 apps/api/src/routes/edu-ai-management.ts +
 * apps/web/app/(main)/edu/edu-management/attendance/check-in-contract.ts):
 *  ① 写接口(check-in / batch-check-in / self-check-in)**不收 status**:状态一律服务端按该班
 *     edu_attendance_rule 阈值 + judgeStatus 现算 ⇒ 本文件的桩同样只按阈值判档,并显式忽略
 *     请求体里的 status;写请求的断言里也不得再出现 status 字段(见 lastWriteBody 断言)。
 *     对话框里那个「状态」下拉已随改口一起删除 ⇒ 想拿到 late 只能填「该日内时刻」让服务端判。
 *  ② date 与 checkInTime 必须同属一个上海业务日;回填非当日而无时刻 ⇒ 前端禁用提交、
 *     请求根本不发;绕过前端直连 ⇒ 400 且 message 点名「回填非当日」。
 *  ③ 签退后按阈值重判(leave/absent 受优先级保护)⇒ early 自此真有写入路径。
 *  ④ GET /attendance 的 status 只认 present/late/early/absent/leave 五档,非法值 400;
 *     web 侧「全部状态」已在 setState 处归一成空串(不发 status=all),故切回全部状态**两行都回**
 *     —— 这一段此前钉的是「缺陷」(列表恒空),缺陷已于 41d5da91ec8 修复,桩面按修复后的契约复刻。
 *
 * 为什么 A–C 桩数据面(与 e2e/checkin-phase1d.spec.ts 同一先例口径):
 *  - 学生自签在后端要"在册学籍"(resolveSelfCheckInClassId),家长腿要
 *    edu_parent_student_binding confirmed 行 —— 这些夹具不在本票射程;
 *  - 桩的是**数据面**,页面组件、react-query 缓存失效、筛选态、对话框、radix
 *    Select 弹层全是真的 —— 这正是要回归的 UI 链路。
 *  mock 的响应形状逐条对照 apps/api/src/routes/edu-ai-management.ts 现读契约
 *  ({ code, message, data } 信封;列表 { list };自签 201 回显 { classId,status,checkInTime })。
 *  桩里的 judgeStub/同日校验是**被测服务端行为的最小复刻**(测试替身,生产判据单源仍在
 *  apps/api/src/services/edu-attendance-rule.ts);改后端契约必须同步改这里,否则桩即失真。
 *
 * 登录腿不走桩:fixtures 的 apiLoginAndSaveStorageState 打真 API。
 * 跑法(本机已有他席 8801/8802 在跑时,复用既存 server,禁止再起全栈 dev):
 *   E2E_SKIP_SEED=1 E2E_AUTO_CLEANUP=0 PLAYWRIGHT_BASE_URL=http://localhost:8801 \
 *   E2E_ADMIN_ACCOUNT=<账号> E2E_ADMIN_PASSWORD=<口令,只经环境变量> \
 *   pnpm --filter @ihui/web exec playwright test e2e/edu-attendance.spec.ts \
 *     --project=chromium --no-deps
 * (E2E_SKIP_SEED/E2E_AUTO_CLEANUP:本机默认库是他席共用的开发库,seed/cleanup 都是跨会话副作用)
 * 首跳要现编译页面,navigationTimeout 已抬高(冷编译假红教训)。
 */
import { expect, type Page } from '@playwright/test'
import { test } from './fixtures'

test.setTimeout(180_000)
test.use({ navigationTimeout: 90_000, actionTimeout: 30_000 })

/* ─── 固定 ID:前 8 位两两不同,表格截断显示后仍可精确点名 ─── */
const CLASS_ID = 'c0ffee00-0000-4000-8000-00000000e2e1'
const CLASS_NAME = 'E2E考勤测试班'
const STUDENT_A = 'aa000000-0000-4000-8000-0000000000a1'
const STUDENT_B = 'bb000000-0000-4000-8000-0000000000b2'
const STUDENT_C = 'cc000000-0000-4000-8000-0000000000c3'
const STUDENT_D = 'dd000000-0000-4000-8000-0000000000d4'
const CHILD_ID = 'ee000000-0000-4000-8000-0000000000ce'

/**
 * 上海业务日 —— 与后端 bizDayKey、页面 check-in-contract.ts 的 bizDay() 同口径。
 * 刻意不用浏览器本地日:同日校验由服务端按上海日判,跨时区工位用本地日会拦错方向。
 */
function shanghaiDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
function bizDay(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return shanghaiDay(d)
}
const TODAY = bizDay()
const YESTERDAY = bizDay(-1)

/** 后端 status 词表现读五档(GET /attendance 的枚举闸只认这些;非法值按 400 桩)。 */
const ATT_STATUS = ['present', 'late', 'early', 'absent', 'leave'] as const
/** 协议码 → 中文文案(与 PageClient 的 ATTENDANCE_STATUS 取词同值;仅供断言点名文案,不参与判档) */
const STATUS_LABEL_ZH: Record<string, string> = {
  present: '正常',
  late: '迟到',
  early: '早退',
  absent: '缺勤',
  leave: '请假',
}
/**
 * 桩内"该班规则"阈值(与 GET /attendance/rule 的返回逐字同值,判档只问这一处)。
 * earlyBefore 取 23:59 是有意的:早退判定用例必须在任何真实钟点下都成立
 * (签退时刻 = 服务器 now,取 16:00 会让本用例在下午四点后翻成 present ⇒ 假红)。
 */
const RULE = { lateAfter: '08:30', earlyBefore: '23:59', absentAfter: null as string | null }

/* ─── 有状态内存仓(桩数据面;每用例 beforeEach 复位)─── */

interface AttRecord {
  id: string
  studentId: string
  classId: string
  date: string
  checkInTime: string | null
  checkOutTime: string | null
  status: string
  checkInMethod: string
  operatedBy: string | null
  remark: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

const store = {
  seq: 1,
  records: [] as AttRecord[],
  selfRecords: [] as AttRecord[],
  parentRecords: [] as AttRecord[],
  leaves: [] as Array<Record<string, unknown>>,
  /** 最近一次 GET /attendance 的 query(断言「全部状态」根本不带 status)*/
  lastListQuery: null as Record<string, string> | null,
  /** 最近一次写接口收到的请求体(断言写面不再出现 status 字段)*/
  lastWriteBody: null as Record<string, unknown> | null,
}

/** HH:mm(与后端 hmOfLocalDate 同形态:按本地钟点取值) */
function hmOf(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 被测服务端行为的最小复刻:judgeStatus 的阈值次序(无签到=absent → 迟到 → 早退 → present)。
 * 生产判据单源仍是 apps/api/src/services/edu-attendance-rule.ts,本函数只活在桩里。
 */
function judgeStub(checkInTime: string | null, checkOutTime: string | null): string {
  if (!checkInTime) return 'absent'
  if (RULE.lateAfter && (hmOf(checkInTime) ?? '') > RULE.lateAfter) return 'late'
  if (RULE.earlyBefore && checkOutTime && (hmOf(checkOutTime) ?? '') < RULE.earlyBefore) {
    return 'early'
  }
  return 'present'
}

/** 签退重判的优先级保护(同后端 statusPreservedOnCheckOut:leave/absent 不洗) */
function preservedOnCheckOut(status: string): boolean {
  return status === 'leave' || status === 'absent'
}

type RecordSeed = {
  studentId: string
  classId: string
  date: string
  checkInTime?: string | null
  checkOutTime?: string | null
  checkInMethod?: string
  remark?: string | null
  /** 只有预置夹具(家长腿只读展示)才显式给状态;任何「写」路径都不传 ⇒ 走桩侧判档 */
  status?: string
}

function makeRecord(partial: RecordSeed): AttRecord {
  const now = new Date().toISOString()
  const checkInTime = partial.checkInTime ?? now
  const checkOutTime = partial.checkOutTime ?? null
  return {
    id: `rec-${store.seq++}`,
    studentId: partial.studentId,
    classId: partial.classId,
    date: partial.date,
    checkInTime,
    checkOutTime,
    status: partial.status ?? judgeStub(checkInTime, checkOutTime),
    checkInMethod: partial.checkInMethod ?? 'manual',
    operatedBy: 'e2e',
    remark: partial.remark ?? null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

function resetStore(): void {
  store.seq = 1
  store.records = []
  store.selfRecords = []
  store.leaves = []
  store.lastListQuery = null
  store.lastWriteBody = null
  // 家长腿预置两日记录:今天正常 ×1,昨天迟到 ×1(只读展示断言用)
  store.parentRecords = [
    makeRecord({ studentId: CHILD_ID, classId: CLASS_ID, date: TODAY, status: 'present' }),
    makeRecord({ studentId: CHILD_ID, classId: CLASS_ID, date: YESTERDAY, status: 'late' }),
  ]
}

const jsonOk = (data: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ code: 0, message: 'ok', data }),
})
const jsonErr = (status: number, message: string) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ code: status, message }),
})

function listLive(records: AttRecord[], date: string | null, status: string | null) {
  return records.filter(
    (r) => !r.deletedAt && (!date || r.date === date) && (!status || r.status === status),
  )
}

/**
 * 教师侧签到两入口(代签 / 批量点名)共用的前置校验,与后端 resolveTeacherCheckIn 同判据:
 * 未给时刻 ⇒ 只有当日业务日才取服务器 now;给了时刻 ⇒ 必须能解析且与 date 同一上海业务日。
 * 返回 null 表示通过校验,否则返回 400 的 message(与后端措辞逐字一致)。
 */
function resolveCheckInMoment(
  date: string,
  checkInTimeRaw: unknown,
): { checkInTime: string } | { message: string } {
  if (checkInTimeRaw === undefined || checkInTimeRaw === '') {
    if (date !== TODAY) return { message: '回填非当日的考勤必须显式提供该日内的签到时刻 checkInTime' }
    return { checkInTime: new Date().toISOString() }
  }
  if (typeof checkInTimeRaw !== 'string') return { message: 'checkInTime 不是合法时刻' }
  const d = new Date(checkInTimeRaw)
  if (Number.isNaN(d.getTime())) return { message: 'checkInTime 不是合法时刻' }
  if (shanghaiDay(d) !== date) return { message: 'checkInTime 必须与考勤日期 date 同日' }
  return { checkInTime: checkInTimeRaw }
}

/** 把 edu-ai-management 考勤族整桩成内存仓;契约形状对照后端现读 */
async function installAttendanceMocks(page: Page): Promise<void> {
  await page.route(/\/api\/edu-ai-management\//, async (route) => {
    const req = route.request()
    const method = req.method()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^.*\/api\/edu-ai-management/, '')
    const body = (() => {
      try {
        return req.postDataJSON() as Record<string, unknown>
      } catch {
        return {}
      }
    })()

    // ── 班级清单(ClassSelect)──
    if (method === 'GET' && path === '/class') {
      return route.fulfill(jsonOk({ list: [{ id: CLASS_ID, name: CLASS_NAME }], total: 1 }))
    }

    // ── 统计 / 规则 / 二维码(先于泛列表匹配)──
    if (method === 'GET' && path === '/attendance/stats') {
      const live = listLive(store.records, null, null)
      const byStatus = (s: string) => live.filter((r) => r.status === s).length
      const total = live.length
      const present = byStatus('present')
      return route.fulfill(
        jsonOk({
          total,
          attendanceRate: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
          statusBreakdown: ['present', 'late', 'early', 'absent', 'leave'].map((status) => ({
            status,
            count: byStatus(status),
          })),
          periodBreakdown: live.map((r) => ({ period: r.date, status: r.status, count: 1 })),
        }),
      )
    }
    if (path === '/attendance/rule' && (method === 'GET' || method === 'PUT')) {
      return route.fulfill(
        jsonOk({
          rule: {
            id: 'rule-1',
            classId: body.classId ?? url.searchParams.get('classId') ?? CLASS_ID,
            lateAfter: RULE.lateAfter,
            earlyBefore: RULE.earlyBefore,
            absentAfter: RULE.absentAfter,
            enabled: true,
            qrSecretConfigured: true,
          },
        }),
      )
    }
    if (method === 'POST' && path === '/attendance/rule/rotate-qr-secret') {
      return route.fulfill(jsonOk({ rotated: true, fingerprint: 'e2efingerprint' }))
    }
    if (method === 'GET' && path === '/attendance/qrcode') {
      const expiresAt = new Date(Date.now() + 120_000).toISOString()
      return route.fulfill(
        jsonOk({
          payload: JSON.stringify({
            type: 'edu-attendance-checkin',
            version: 1,
            classId: CLASS_ID,
            token: 'e2e-token',
            expiresAt,
          }),
          classId: CLASS_ID,
          expiresAt,
          ttlMs: 120_000,
        }),
      )
    }

    // ── 学生本人两档 ──
    if (method === 'GET' && path === '/attendance/me') {
      const date = url.searchParams.get('date')
      return route.fulfill(jsonOk({ list: listLive(store.selfRecords, date, null) }))
    }
    if (method === 'POST' && path === '/attendance/self-check-in') {
      store.lastWriteBody = body
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? TODAY))) {
        return route.fulfill(jsonErr(400, '日期格式必须为 YYYY-MM-DD'))
      }
      const date = (body.date as string) ?? TODAY
      // 学生自签的时刻由服务端取 now(入参没有 checkInTime),状态同样由规则现判
      const rec = makeRecord({
        studentId: 'self',
        classId: CLASS_ID,
        date,
        checkInMethod: 'self',
        remark: (body.remark as string) ?? null,
      })
      store.selfRecords.push(rec)
      return route.fulfill(
        jsonOk(
          {
            classId: CLASS_ID,
            status: rec.status,
            checkInTime: rec.checkInTime,
            record: rec,
            judgedBy: 'edu_attendance_rule.judgeStatus',
          },
          201,
        ),
      )
    }

    // ── 教师端操作面 ──
    if (method === 'POST' && path === '/attendance/check-in') {
      store.lastWriteBody = body
      const date = (body.date as string) ?? TODAY
      const resolved = resolveCheckInMoment(date, body.checkInTime)
      if ('message' in resolved) return route.fulfill(jsonErr(400, resolved.message))
      const dup = store.records.find(
        (r) =>
          !r.deletedAt &&
          r.studentId === body.studentId &&
          r.classId === body.classId &&
          r.date === date,
      )
      if (dup) return route.fulfill(jsonErr(409, '该学生今日已签到'))
      const rec = makeRecord({
        studentId: body.studentId as string,
        classId: body.classId as string,
        date,
        checkInTime: resolved.checkInTime,
        // 请求体里即便带 status 也一律不读:状态由 RULE 阈值现判(后端 schema 已删该字段)
        checkInMethod: (body.checkInMethod as string) ?? 'manual',
        remark: (body.remark as string) ?? null,
      })
      store.records.push(rec)
      return route.fulfill(jsonOk({ record: rec }, 201))
    }
    if (method === 'POST' && path === '/attendance/batch-check-in') {
      store.lastWriteBody = body
      const date = (body.date as string) ?? TODAY
      const resolved = resolveCheckInMoment(date, body.checkInTime)
      if ('message' in resolved) return route.fulfill(jsonErr(400, resolved.message))
      const roster = [STUDENT_C, STUDENT_D]
      let created = 0
      let skipped = 0
      for (const sid of roster) {
        const dup = store.records.find(
          (r) => !r.deletedAt && r.studentId === sid && r.date === date,
        )
        if (dup) skipped++
        else {
          store.records.push(
            makeRecord({
              studentId: sid,
              classId: body.classId as string,
              date,
              checkInTime: resolved.checkInTime,
              remark: (body.remark as string) ?? null,
            }),
          )
          created++
        }
      }
      return route.fulfill(jsonOk({ roster: roster.length, created, skipped, missedIds: [] }))
    }
    if (method === 'PUT' && path === '/attendance/check-out') {
      const rec = store.records.find(
        (r) =>
          !r.deletedAt &&
          r.studentId === body.studentId &&
          r.classId === body.classId &&
          r.date === body.date,
      )
      if (!rec) return route.fulfill(jsonErr(404, '未找到签到记录'))
      if (rec.checkOutTime) return route.fulfill(jsonErr(409, '该学生今日已签退'))
      rec.checkOutTime = new Date().toISOString()
      // 本票②:签退后按阈值重判 ⇒ early 自此真有写入路径;leave/absent 受优先级保护
      if (!preservedOnCheckOut(rec.status)) rec.status = judgeStub(rec.checkInTime, rec.checkOutTime)
      rec.updatedAt = rec.checkOutTime
      return route.fulfill(jsonOk({ record: rec }))
    }
    const delAtt = /^\/attendance\/([\w-]+)$/.exec(path)
    if (method === 'DELETE' && delAtt) {
      const rec = store.records.find((r) => r.id === delAtt[1])
      if (rec) rec.deletedAt = new Date().toISOString()
      return route.fulfill(jsonOk({ deleted: Boolean(rec) }))
    }

    // ── 请假 CRUD(教师页 mount 即拉,必须桩)──
    if (path === '/leave' && method === 'GET') {
      return route.fulfill(jsonOk({ list: store.leaves.filter((l) => !l.deletedAt) }))
    }
    if (path === '/leave' && method === 'POST') {
      store.leaves.push({ id: `lv-${store.seq++}`, status: 'pending', ...body })
      return route.fulfill(jsonOk({ leave: store.leaves.at(-1) }, 201))
    }
    const approve = /^\/leave\/([\w-]+)\/approve$/.exec(path)
    if (approve && method === 'PUT') {
      const lv = store.leaves.find((l) => l.id === approve[1])
      if (lv) lv.status = body.status
      return route.fulfill(jsonOk({ leave: lv ?? null }))
    }
    const delLeave = /^\/leave\/([\w-]+)$/.exec(path)
    if (delLeave && method === 'DELETE') {
      const lv = store.leaves.find((l) => l.id === delLeave[1])
      if (lv) lv.deletedAt = new Date().toISOString()
      return route.fulfill(jsonOk({ deleted: Boolean(lv) }))
    }

    // ── 家长只读 ──
    const parentAtt = /^\/parent\/children\/([\w-]+)\/attendance$/.exec(path)
    if (method === 'GET' && parentAtt) {
      // 家长侧「按状态筛选」与教师端共用同一枚枚举闸(后端同一实例,§0.6)
      const status = url.searchParams.get('status')
      if (status !== null && !(ATT_STATUS as readonly string[]).includes(status)) {
        return route.fulfill(jsonErr(400, 'status 仅支持 present/late/early/absent/leave'))
      }
      const list = store.parentRecords
        .filter((r) => r.studentId === parentAtt[1] && !r.deletedAt && (!status || r.status === status))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      return route.fulfill(jsonOk({ list }))
    }

    // ── 教师端考勤列表(泛匹配放最后)──
    if (method === 'GET' && path === '/attendance') {
      const status = url.searchParams.get('status')
      // 后端枚举闸(2026-11-04 同批改口):非五档值一律 400 点名,不再静默当合法筛选值。
      // web 侧「全部状态」已归一成不传 ⇒ 一旦回潮发 status=all,本桩当场 400 炸给页面。
      if (status !== null && !(ATT_STATUS as readonly string[]).includes(status)) {
        return route.fulfill(jsonErr(400, 'status 仅支持 present/late/early/absent/leave'))
      }
      store.lastListQuery = Object.fromEntries(url.searchParams.entries())
      return route.fulfill(jsonOk({ list: listLive(store.records, url.searchParams.get('date'), status) }))
    }

    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 404, message: `e2e mock 未登记的考勤端点:${method} ${path}` }),
    })
  })
}

/* ─── 对话框内签到(学生ID / 日期 / 该日内时刻 / 签到方式 / 备注)───
 * 契约改口后**没有「状态」下拉**(apps/web/.../PageClient.tsx 的 CheckInDialog 现读只有一个
 * radix Select = 签到方式):想拿到 late/early,只能填「该日内时刻」让服务端按规则判档。
 * 输入框按 type 定位,不靠 nth( nth 会随字段增减静默错位)。
 */
async function checkInViaDialog(
  page: Page,
  studentId: string,
  opts: { hm?: string; date?: string; method?: string } = {},
): Promise<void> {
  await page.getByRole('button', { name: '签到', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: '签到' })).toBeVisible()
  await dialog.getByPlaceholder('请输入学生ID').fill(studentId)
  if (opts.date) await dialog.locator('input[type="date"]').fill(opts.date)
  if (opts.hm) await dialog.locator('input[type="time"]').fill(opts.hm)
  if (opts.method) {
    // 弹窗内唯一 combobox = 签到方式
    await dialog.getByRole('combobox').click()
    await page.getByRole('option', { name: opts.method, exact: true }).click()
  }
  await dialog.getByRole('button', { name: '确认签到' }).click()
  await expect(dialog).toBeHidden()
}

/**
 * 工具栏「状态」筛选下拉的唯一锚点:页面此刻只有两枚 combobox(班级 w-40 / 状态 w-32),
 * 状态档宽度是 PageClient 现读的 className="w-32"。按 accessible name 定位不稳
 * (radix 在 value='' 时把 placeholder 渲染成触发器文本,name 计算随档位变化),故用形状锚。
 */
function statusFilter(page: Page) {
  return page.locator('button[role="combobox"].w-32')
}

async function chooseStatus(page: Page, label: string): Promise<void> {
  await statusFilter(page).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

function attRow(page: Page, studentId: string) {
  return page.getByRole('row').filter({ hasText: studentId.slice(0, 8) })
}

/** 在页面上下文里带鉴权直连接口(绕开前端前置拦,专测服务端那一半)*/
async function callApiFromPage(
  page: Page,
  path: string,
  init: { method: string; body?: unknown },
): Promise<{ status: number; code: number | null; message: string; data: unknown }> {
  return page.evaluate(
    async ({ p, m, b }) => {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      const token = window.localStorage.getItem('token')
      if (token) headers.authorization = `Bearer ${token}`
      const res = await fetch(p, {
        method: m,
        credentials: 'include',
        headers,
        body: b === undefined ? undefined : JSON.stringify(b),
      })
      const j = (await res.json().catch(() => null)) as {
        code?: number
        message?: string
        data?: unknown
      } | null
      return { status: res.status, code: j?.code ?? null, message: j?.message ?? '', data: j?.data ?? null }
    },
    { p: path, m: init.method, b: init.body },
  )
}

test.describe.serial('教师端考勤 · 标记→列表→筛选→删除(route 桩数据面)', () => {
  test.beforeEach(async ({ adminPage }) => {
    resetStore()
    await installAttendanceMocks(adminPage)
  })

  test('签到一名学生后列表出现记录,可按状态筛选,删除后消失', async ({ adminPage: page }) => {
    await page.goto('/edu/edu-management/attendance')
    await expect(page.getByRole('heading', { name: '考勤管理' })).toBeVisible()
    // 规则/二维码面板随首个班级自动加载(桩面 rule/qrcode 都在)
    await expect(page.getByTestId('attendance-qr')).toBeVisible()

    // 08:00(早于该班 lateAfter 08:30)⇒ 服务端判 present;不填日期 = 当日 ⇒ 服务端落 now
    await checkInViaDialog(page, STUDENT_A, { hm: '08:00' })
    await expect(attRow(page, STUDENT_A)).toBeVisible()
    await expect(attRow(page, STUDENT_A).getByText('正常', { exact: true })).toBeVisible()
    await expect(attRow(page, STUDENT_A).getByText('教师代签')).toBeVisible()

    // 写接口请求体不得再出现 status(后端 checkInSchema 已删该字段,状态一律服务端现算)
    expect(store.lastWriteBody).not.toBeNull()
    expect(store.lastWriteBody?.status).toBeUndefined()

    // 10:00 晚于阈值 ⇒ 这一档现在是"服务端判出来的迟到",不是端上自报的
    await checkInViaDialog(page, STUDENT_B, { hm: '10:00' })
    await expect(attRow(page, STUDENT_B)).toBeVisible()
    await expect(attRow(page, STUDENT_B).getByText('迟到', { exact: true })).toBeVisible()

    // 状态筛选:切「迟到」只剩 B
    await chooseStatus(page, '迟到')
    await expect(attRow(page, STUDENT_A)).toHaveCount(0)
    await expect(attRow(page, STUDENT_B)).toBeVisible()
    expect(store.lastListQuery?.status).toBe('late')

    // 切回「全部状态」⇒ 两行都回(缺陷已修:哨兵值 'all' 在 setState 处归一成空串,
    // 根本进不了 query;桩侧对非法枚举回 400,一旦回潮页面会直接报「加载签到记录失败」)
    await chooseStatus(page, '全部状态')
    await expect(attRow(page, STUDENT_A)).toBeVisible()
    await expect(attRow(page, STUDENT_B)).toBeVisible()
    expect(store.lastListQuery?.status).toBeUndefined()

    // 具体档筛选仍可用:切「正常」只剩 A
    await chooseStatus(page, '正常')
    await expect(attRow(page, STUDENT_A)).toBeVisible()
    await expect(attRow(page, STUDENT_B)).toHaveCount(0)

    // 删除:A 行消失;再切「迟到」验证 B 仍在(删除只落了 A)
    await attRow(page, STUDENT_A).getByRole('button', { name: '删除', exact: true }).click()
    await expect(attRow(page, STUDENT_A)).toHaveCount(0)
    await chooseStatus(page, '迟到')
    await expect(attRow(page, STUDENT_B)).toBeVisible()
  })

  test('回填非当日:前端拦死 ⇒ 一条写请求都不发;绕开前端直连 ⇒ 400 且点名原因', async ({
    adminPage: page,
  }) => {
    await page.goto('/edu/edu-management/attendance')
    await page.getByRole('button', { name: '签到', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('请输入学生ID').fill(STUDENT_A)
    await dialog.locator('input[type="date"]').fill(YESTERDAY)

    // 正面(前端那一半):没给该日内时刻 ⇒ 警告可见 + 提交禁用 + 请求根本不发
    await expect(dialog.getByText('回填非当日考勤须给出该日内的签到时刻')).toBeVisible()
    const confirm = dialog.getByRole('button', { name: '确认签到' })
    await expect(confirm).toBeDisabled()
    let writeHits = 0
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/attendance/check-in')) writeHits++
    })
    await expect(confirm).toBeDisabled()
    expect(writeHits).toBe(0)
    expect(store.records).toHaveLength(0)

    // 反面 A(补上该日内时刻 ⇒ 前端放行,请求真发出并入库)
    await dialog.locator('input[type="time"]').fill('09:00')
    await expect(dialog.getByText('回填非当日考勤须给出该日内的签到时刻')).toBeHidden()
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(dialog).toBeHidden()
    expect(writeHits).toBe(1)
    expect(store.lastWriteBody?.status).toBeUndefined()
    // 回填的行落在昨日:当日清单里没有它(日期筛选口径由服务端 date 条件给)
    const todayList = await callApiFromPage(page, `/api/edu-ai-management/attendance?date=${TODAY}`, {
      method: 'GET',
    })
    expect((todayList.data as { list: AttRecord[] }).list.map((r) => r.studentId)).not.toContain(
      STUDENT_A,
    )
    const backfill = await callApiFromPage(
      page,
      `/api/edu-ai-management/attendance?date=${YESTERDAY}`,
      { method: 'GET' },
    )
    const backfillList = (backfill.data as { list: AttRecord[] }).list
    expect(backfillList.map((r) => r.studentId)).toContain(STUDENT_A)
    expect(backfillList.find((r) => r.studentId === STUDENT_A)?.date).toBe(YESTERDAY)

    // 反面 B(服务端那一半):同样的缺时刻请求绕过前端直发 ⇒ 400,message 点名「回填非当日」
    const rejected = await callApiFromPage(page, '/api/edu-ai-management/attendance/check-in', {
      method: 'POST',
      body: { studentId: STUDENT_B, classId: CLASS_ID, date: YESTERDAY, checkInMethod: 'manual' },
    })
    expect(rejected.status).toBe(400)
    expect(rejected.message).toContain('回填非当日')
    expect(store.records.filter((r) => r.studentId === STUDENT_B)).toHaveLength(0)
  })

  test('早退(early):签退重判后真入列,文案与色档正确,且能被单独筛出', async ({
    adminPage: page,
  }) => {
    await page.goto('/edu/edu-management/attendance')
    // 两名学生都是 08:00 到(present);只有 A 被签退 ⇒ 按该班 earlyBefore 重判成 early
    await checkInViaDialog(page, STUDENT_A, { hm: '08:00' })
    await checkInViaDialog(page, STUDENT_B, { hm: '08:00' })
    await expect(attRow(page, STUDENT_A).getByText('正常', { exact: true })).toBeVisible()

    await attRow(page, STUDENT_A).getByRole('button', { name: '签退', exact: true }).click()

    // 文案 + 色档:early 档 = 橙(bg-orange-500,ATTENDANCE_STATUS 现读)
    const earlyBadge = attRow(page, STUDENT_A).getByText('早退', { exact: true })
    await expect(earlyBadge).toBeVisible()
    await expect(earlyBadge).toHaveClass(/bg-orange-500/)
    // B 没签退,仍是正常(绿档)
    await expect(attRow(page, STUDENT_B).getByText('正常', { exact: true })).toBeVisible()
    // 签退后该行不再有「签退」按钮
    await expect(attRow(page, STUDENT_A).getByRole('button', { name: '签退' })).toHaveCount(0)

    // early 能被单独筛出
    await chooseStatus(page, '早退')
    await expect(attRow(page, STUDENT_A)).toBeVisible()
    await expect(attRow(page, STUDENT_B)).toHaveCount(0)
    expect(store.lastListQuery?.status).toBe('early')

    // 切回全部状态:两行都回(early 行不因新档位掉出清单)
    await chooseStatus(page, '全部状态')
    await expect(attRow(page, STUDENT_A)).toBeVisible()
    await expect(attRow(page, STUDENT_B)).toBeVisible()
  })

  test('批量点名:首轮新签到 2 人入列,复跑全部跳过(幂等)', async ({ adminPage: page }) => {
    await page.goto('/edu/edu-management/attendance')
    await page.getByRole('button', { name: '批量点名' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: '批量点名' })).toBeVisible()
    // ClassSelect 清单到货后自动选中首班,按钮随即解禁
    await expect(dialog.getByRole('button', { name: '开始点名' })).toBeEnabled({
      timeout: 15_000,
    })
    await dialog.getByRole('button', { name: '开始点名' }).click()
    await expect(dialog.getByText('新签到')).toBeVisible()
    await expect(dialog.getByText('2', { exact: true }).first()).toBeVisible()
    await expect(attRow(page, STUDENT_C)).toBeVisible()
    await expect(attRow(page, STUDENT_D)).toBeVisible()
    // 批量写请求同样不带 status(后端 batchCheckInSchema 已删该字段)
    expect(store.lastWriteBody?.status).toBeUndefined()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: '批量点名' }).click()
    await dialog.getByRole('button', { name: '开始点名' }).click()
    await expect(dialog.getByText('跳过')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('批量点名回填非当日:缺该日内时刻 ⇒ 警告可见、按钮禁用、请求不发', async ({
    adminPage: page,
  }) => {
    await page.goto('/edu/edu-management/attendance')
    await page.getByRole('button', { name: '批量点名' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: '开始点名' })).toBeEnabled({ timeout: 15_000 })
    await dialog.locator('input[type="date"]').fill(YESTERDAY)
    await expect(dialog.getByText('回填非当日考勤须给出该日内的签到时刻')).toBeVisible()
    let writeHits = 0
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/attendance/batch-check-in')) writeHits++
    })
    await expect(dialog.getByRole('button', { name: '开始点名' })).toBeDisabled()
    expect(writeHits).toBe(0)
    expect(store.records).toHaveLength(0)
  })
})

test.describe.serial('学生端自助考勤 · 自签链路(route 桩数据面)', () => {
  test.beforeEach(async ({ adminPage }) => {
    resetStore()
    await installAttendanceMocks(adminPage)
  })

  test('空列表→填备注自签→当日记录入列且按钮置灰', async ({ adminPage: page }) => {
    await page.goto('/edu/attendance')
    await expect(page.getByRole('heading', { name: '我的考勤' })).toBeVisible()
    await expect(page.getByText('暂无签到记录')).toBeVisible()

    await page.getByPlaceholder('可选，备注信息').fill('学生自助签到')
    await page.getByRole('button', { name: '自助签到' }).click()
    await expect(page.getByText('签到成功')).toBeVisible()
    // 自签请求体只有 date + remark(身份/班级/状态都由服务端现取现判)
    expect(store.lastWriteBody?.status).toBeUndefined()
    expect(store.lastWriteBody?.classId).toBeUndefined()
    expect(store.lastWriteBody?.studentId).toBeUndefined()
    // 状态是桩按该班阈值现判的 ⇒ 断言"页面渲染的文案 == 服务端判出来的那一档",
    // 而不是把某一档写死在断言里(钟点不同判档不同,写死即假红)。
    const judged = store.selfRecords.at(-1)?.status ?? ''
    expect(ATT_STATUS).toContain(judged as (typeof ATT_STATUS)[number])
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: TODAY })
        .filter({ hasText: STATUS_LABEL_ZH[judged] }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: '自助签到' })).toBeDisabled()
  })
})

test.describe.serial('家长端考勤 · 只读链路(route 桩数据面)', () => {
  test.beforeEach(async ({ adminPage }) => {
    resetStore()
    await installAttendanceMocks(adminPage)
  })

  test('查看孩子记录:统计+列表可见,且没有任何写操作控件', async ({ adminPage: page }) => {
    await page.goto(`/edu/parent/children/${CHILD_ID}/attendance`)
    await expect(page.getByRole('heading', { name: '考勤记录' })).toBeVisible()
    await expect(page.getByText('查看孩子的出勤情况')).toBeVisible()
    await expect(page.getByText('出勤率')).toBeVisible()
    await expect(page.getByText('签到记录')).toBeVisible()
    // 预置两条:今天 正常、昨天 迟到
    await expect(page.getByRole('row').filter({ hasText: TODAY }).first()).toBeVisible()
    await expect(page.getByText('迟到', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('50%')).toBeVisible() // 出勤率 1/2 = 50%
    // 只读:不存在签到/签退/删除/请假/导出类写控件
    await expect(page.getByRole('button', { name: /签到|签退|删除|请假|导出/ })).toHaveCount(0)
  })
})

/**
 * 真链路写接口契约探测(2026-11-04)。
 *
 * 为什么要有这一档:本机 8802 上的 api 进程是 `node --import tsx src/index.ts`,
 * **进程内存里装的是它启动那一刻的源码**。若它的启动时刻早于 main 上的改口提交
 * (f1f098635e / 41d5da91ec8),那"写接口不收 status + 回填非当日必须给时刻"这两条
 * 判据在那台进程上根本不存在 ⇒ 真链路用例必然红,而红的原因不是本仓代码有问题。
 * 正解不是改判据凑绿,而是**探测到契约不符就显式 skip 并把读数打出来**(不静默 fixme)。
 *
 * 探测判据(零副作用):POST check-in 用昨日日期且不给 checkInTime。
 *   新契约 ⇒ 400 + message 含「回填非当日」(在落库之前就返回,FK 都不会被碰);
 *   旧契约 ⇒ 不会返回这一条 400(会走插入 ⇒ 随机 UUID 撞 FK 500,或 201/404)。
 * 顺带只报数不判死的另一档:GET /attendance?status=all —— 枚举 400 那一改目前还在
 * 他席在飞的工作树里(HEAD blob 现读不含 attendanceStatusFilterSchema),不作为 skip 条件。
 */
let writeContractProbe: { matched: boolean; detail: string } | null = null

async function probeWriteContract(page: Page): Promise<{ matched: boolean; detail: string }> {
  if (writeContractProbe) return writeContractProbe
  const rejected = await callApiFromPage(page, '/api/edu-ai-management/attendance/check-in', {
    method: 'POST',
    body: { studentId: STUDENT_A, classId: CLASS_ID, date: YESTERDAY, checkInMethod: 'manual' },
  })
  const allFilter = await callApiFromPage(
    page,
    `/api/edu-ai-management/attendance?date=${TODAY}&status=all`,
    { method: 'GET' },
  )
  const matched = rejected.status === 400 && rejected.message.includes('回填非当日')
  writeContractProbe = {
    matched,
    detail: `check-in(昨日·无时刻)=${JSON.stringify({
      status: rejected.status,
      code: rejected.code,
      message: rejected.message,
    })} | status=all(在飞档,只报数)=${JSON.stringify({
      status: allFilter.status,
      message: allFilter.message,
    })}`,
  }
  console.log(`[edu-attendance] 写接口契约探测:${writeContractProbe.detail}`)
  return writeContractProbe
}

test.describe.serial('真实后端链路(不桩数据面;读路径必须真 200)', () => {
  // 本机 8802 上他席在跑的 api + 本地开发库也可跑:教师页经 web proxy 鉴权后进页面,
  // 管理端读路径(class/attendance/attendance/me/leave)按当前登录态真打后端。
  test.beforeEach(() => {
    resetStore()
  })

  test('教师页真链路:代理鉴权进页 + 管理端 GET 读路径 code=0', async ({ adminPage: page }) => {
    await page.goto('/edu/edu-management/attendance')
    // 探测必须在已加载的页面上下文里发(相对 URL 需要真实 origin;about:blank 下 fetch 直接炸)
    const contract = await probeWriteContract(page)
    test.skip(
      !contract.matched,
      `本机 api 进程装的是改口前的源码(写接口"回填非当日必须给该日内时刻"这一判据不存在)⇒ 真链路组显式跳过。探测读数:${contract.detail}`,
    )
    await expect(page.getByRole('heading', { name: '考勤管理' })).toBeVisible()

    const probed = await page.evaluate(
      async (paths) => {
        const out: Array<{ path: string; status: number; code: number | null }> = []
        const token = window.localStorage.getItem('token')
        for (const p of paths) {
          const res = await fetch(p, {
            credentials: 'include',
            headers: token ? { authorization: `Bearer ${token}` } : {},
          })
          const json = (await res.json().catch(() => null)) as { code?: number } | null
          out.push({ path: p, status: res.status, code: json?.code ?? null })
        }
        return out
      },
      [
        '/api/edu-ai-management/class?page=1&pageSize=5',
        `/api/edu-ai-management/attendance?date=${TODAY}`,
        '/api/edu-ai-management/attendance/me',
        '/api/edu-ai-management/leave',
      ],
    )
    // 失败时把逐条读数打进断言消息(403=RBAC/@group 标注缺口;401=登录腿;0=网络)
    expect(
      probed.filter((p) => p.status !== 200 || p.code !== 0),
      `真后端读路径非全绿:${JSON.stringify(probed)}`,
    ).toHaveLength(0)

    // 管理列表在无桩页面上也不得报「加载签到记录失败」
    await expect(page.getByText('加载签到记录失败，请稍后重试')).toHaveCount(0)
  })

  test('学生页真链路:登录后渲染本人考勤面,me 读路径 code=0', async ({ adminPage: page }) => {
    await page.goto('/edu/attendance')
    const contract = await probeWriteContract(page)
    test.skip(
      !contract.matched,
      `本机 api 进程装的是改口前的源码(写接口同日校验未生效)⇒ 真链路组显式跳过。探测读数:${contract.detail}`,
    )
    await expect(page.getByRole('heading', { name: '我的考勤' })).toBeVisible()
    await expect(page.getByText('请先登录')).toHaveCount(0)

    const res = await callApiFromPage(page, '/api/edu-ai-management/attendance/me', {
      method: 'GET',
    })
    expect(
      { status: res.status, code: res.code },
      `attendance/me 真链路读数:${JSON.stringify(res)}`,
    ).toEqual({ status: 200, code: 0 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
