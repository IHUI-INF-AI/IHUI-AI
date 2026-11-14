// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * HrAttendanceScreen 接线锁(2026-11-13 立)。
 *
 * 立此夹具的因由:本屏 2026-11-09 落地时带了三处真实缺陷,而 XUI-069 / XUI-070 那两把
 * 接线锁的样本只取了 DevicesScreen / PurchaseScreen 等五枚,恰好没覆盖到它。
 *
 * 缺陷一(会真的签不上):签到日期用 `new Date().toISOString().slice(0, 10)` = UTC 日。
 *   后端 `hrCheckIn` 用 `bizDayKey()`(Asia/Shanghai)判 `bad_date`(apps/api/src/services/
 *   hr-attendance.ts)。北京时间 00:00–07:59 打开本页,UTC 日仍是"昨天" ⇒ 后端拒,
 *   前端只弹"签到日期必须是当日或合法的历史业务日" —— 用户看着当天钟点却签不上。
 *   同一缺陷在 EduAttendanceScreen 一族早已修过(components/attendance-status.ts 的
 *   attendanceBizDay 注释逐字记着),本屏是漏网的一枚。
 * 缺陷二(竞态):`load` 依赖 departmentId 且无请求序号;翻查部门时旧响应后到会把新部门
 *   的记录盖掉(XUI-069 同型)。
 * 缺陷三(重复提交 + 卸载后 setState):`busy` 是 state,同 tick 连点两次时两次都读到 false
 *   (`disabled` 要等重渲染);请求在途时卸载,`finally` 里仍会 setState(XUI-070 同型)。
 *
 * 本夹具是**源码接线断言**(读屏源码逐个钉住接线点),不是行为渲染测试 —— RN 组件级 RTL
 * 在本仓结构性缺位。行为面由后端 bizDayKey 与 attendanceBizDay 的既有单测各自锁住。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCREEN = readFileSync(
  join(__dirname, '..', 'src', 'screens', 'HrAttendanceScreen.tsx'),
  'utf8',
)

describe('HrAttendanceScreen 签到业务日必须取上海日', () => {
  it('date 走共享单源 attendanceBizDay(),不得再出现裸 toISOString 取日', () => {
    expect(SCREEN).toContain("import { attendanceBizDay } from '../components/attendance-status'")
    expect(SCREEN).toContain('date: attendanceBizDay(),')
    // 反向:裸 UTC 取日会与后端 bizDayKey 错开一整天(北京时间 00:00–07:59)
    expect(SCREEN).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/)
  })
})

describe('XUI-069 请求竞态:HrAttendanceScreen 列表响应带序号守卫', () => {
  it('有请求序号 ref,且过期响应在 setState 之前就被丢弃', () => {
    expect(SCREEN).toContain('const reqSeqRef = useRef(0)')
    expect(SCREEN).toContain('const seq = (reqSeqRef.current += 1)')
    expect(SCREEN).toContain('if (seq !== reqSeqRef.current || !mountedRef.current) return')
    // 守卫必须排在对 records 的写入之前,否则等于写在后面再判旧
    expect(
      SCREEN.indexOf('if (seq !== reqSeqRef.current || !mountedRef.current) return'),
    ).toBeLessThan(SCREEN.indexOf('setRecords('))
    // 收尾态只在"仍是最新一轮且未卸载"时才落,避免旧轮把 loading 提前关掉
    expect(SCREEN).toContain('if (seq === reqSeqRef.current && mountedRef.current) {')
  })
})

describe('XUI-070 重复提交与卸载后回调', () => {
  it('签到用 ref 入口锁,finally 复位', () => {
    expect(SCREEN).toContain('const checkingInRef = useRef(false)')
    expect(SCREEN).toContain(
      'if (!employeeId.trim() || !departmentId.trim() || checkingInRef.current) return',
    )
    expect(SCREEN).toContain('checkingInRef.current = true')
    expect(SCREEN).toContain('checkingInRef.current = false')
  })

  it('卸载守卫:mount 时置真、卸载置假,异步回调前先看它', () => {
    expect(SCREEN).toContain('const mountedRef = useRef(true)')
    expect(SCREEN).toContain('mountedRef.current = false')
    expect(SCREEN).toContain('if (!mountedRef.current) return')
    expect(SCREEN).toContain('if (mountedRef.current) setBusy(false)')
  })
})

describe('加载失败不得静默', () => {
  it('load 有 catch 分支且提示复用 common.loadFailed(不新增跨端缺键)', () => {
    expect(SCREEN).toMatch(/catch\s*\{[\s\S]*?appAlert\(/)
    expect(SCREEN).toContain("t('common.loadFailed')")
    // 本屏自己的词包里没有 loadFailed,写 hrAttendance.loadFailed 会回显裸键名
    expect(SCREEN).not.toContain("'hrAttendance.loadFailed'")
  })
})
