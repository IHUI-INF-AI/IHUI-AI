// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * HR 全链路 HTTP 级端到端验证(临时脚本)。
 *
 * 走真实 Fastify 路由 + 真实 JWT 鉴权 + 真实 RBAC 守卫 + 真实数据库,
 * 与浏览器点击调用的完全是同一条链路(只是不经过 TCP 监听)。
 */
import { buildServer } from '../../../apps/api/src/server.ts'

const ADMIN_USER_ID = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg)
  console.log('  ✓ ' + msg)
}

/** 从响应里取业务数据(统一响应包装 {code, data}) */
function unwrap(res) {
  const body = res.json()
  if (body && typeof body === 'object' && 'data' in body) return body.data
  return body
}

async function main() {
  console.log('\n[1] 构建真实 Fastify 服务(完整路由 + 插件 + 守卫)')
  const app = await buildServer()
  await app.ready()
  // @fastify/under-pressure 在启动初期会返回 503(健康采样尚未就绪),
  // 这不是业务失败。等它放行后再开始真实请求。
  let warmed = false
  for (let i = 0; i < 40; i++) {
    const probe = await app.inject({ method: 'GET', url: '/health' })
    if (probe.statusCode < 500) {
      warmed = true
      break
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!warmed) throw new Error('服务健康检查持续 5xx,under-pressure 未放行')
  console.log('  服务已就绪(健康检查通过)')

  // 管理员 JWT:必须用包内 signAccessToken —— 它会写入 iss/aud/sub/type，
  // 用 app.jwt.sign 手搓会因为缺 iss/aud 被 verifyAccessToken 拒绝(401)。
  const { signAccessToken } = await import('../../../packages/auth/src/jwt.ts')
  const token = await signAccessToken({
    userId: ADMIN_USER_ID,
    roleId: 1,
    type: 'access',
  })
  const auth = { authorization: `Bearer ${token}` }

  try {
    console.log('\n[2] 未认证访问必须被拒绝(证明守卫真的生效)')
    const noAuth = await app.inject({ method: 'GET', url: '/api/hr-import/batches' })
    assert([401, 403].includes(noAuth.statusCode), `未带 token → ${noAuth.statusCode}(非 200)`)

    console.log('\n[2b] 诊断:带 token 调一个只读 HR 接口')
    const diag = await app.inject({ method: 'GET', url: '/api/hr-import/batches', headers: auth })
    console.log('   batches with token →', diag.statusCode, diag.body.slice(0, 200))

    console.log('\n[3] 四类导入:上传 → 解析 → 差异核对 → 确认写入')
    const deptId = '11111111-1111-4111-8111-111111111111'

    // 清场
    const { default: postgres } = await import('postgres')
    const sql = postgres(process.env.DATABASE_URL, { max: 1 })
    await sql`DELETE FROM hr_import_batch WHERE file_name LIKE 'e2e-http%'`
    await sql`DELETE FROM hr_attendance_record WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_leave_request WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_overtime_record WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_outgoing_record WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_attendance_daily WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_attendance_monthly WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_payroll_item WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_payroll_period WHERE period_month='2026-11'`
    await sql`DELETE FROM hr_salary_config WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_attendance_rule WHERE department_id=${deptId}::uuid`
    await sql`INSERT INTO hr_attendance_rule (department_id, late_after, early_before, workdays)
      VALUES (${deptId}::uuid, '09:00', '18:00', 31) ON CONFLICT DO NOTHING`

    /** 用 multipart 上传一份 CSV */
    async function upload(kind, fileName, csv) {
      const boundary = '----e2e' + Date.now()
      const parts = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="periodMonth"',
        '',
        '2026-11',
        `--${boundary}`,
        'Content-Disposition: form-data; name="importKind"',
        '',
        kind,
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
        'Content-Type: text/csv',
        '',
        csv,
        `--${boundary}--`,
        '',
      ]
      const payload = Buffer.from(parts.join('\r\n'), 'utf8')
      return app.inject({
        method: 'POST',
        url: '/api/hr-import/batches',
        headers: { ...auth, 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload,
      })
    }

    // --- 打卡 ---
    const attCsv = `工号,姓名,日期,上班打卡,下班打卡
E2E001,张三,2026-11-02,08:55,18:10
E2E001,张三,2026-11-03,09:30,18:05
E2E002,李四,2026-11-02,08:50,18:20
`
    const rAtt = await upload('attendance', 'e2e-http-att.csv', attCsv)
    if (rAtt.statusCode !== 200) {
      console.error('   上传失败响应:', rAtt.body)
    }
    assert(rAtt.statusCode === 200, `打卡上传 HTTP ${rAtt.statusCode}`)
    const attData = unwrap(rAtt)
    assert(attData.totalRows === 3, `解析 3 行(实际 ${attData.totalRows})`)
    assert(attData.matchedRows === 3, '3 行全部匹配')
    const cAtt = await app.inject({
      method: 'POST', url: `/api/hr-import/batches/${attData.batchId}/confirm`, headers: auth,
    })
    assert(cAtt.statusCode === 200, `打卡确认 HTTP ${cAtt.statusCode}`)

    // --- 请假 ---
    const lvCsv = `工号,姓名,假别,开始日期,结束日期,请假天数,请假事由,审批状态
E2E001,张三,年假,2026-11-04,2026-11-04,1,家中有事,已通过
`
    const rLv = await upload('leave', 'e2e-http-lv.csv', lvCsv)
    assert(rLv.statusCode === 200, `请假上传 HTTP ${rLv.statusCode}`)
    const lvData = unwrap(rLv)
    assert(lvData.importKind === 'leave', '批次类型 leave')
    const cLv = await app.inject({
      method: 'POST', url: `/api/hr-import/batches/${lvData.batchId}/confirm`, headers: auth,
    })
    assert(cLv.statusCode === 200, `请假确认 HTTP ${cLv.statusCode}`)
    assert(unwrap(cLv).inserted === 1, '写入 1 条请假')

    // --- 加班 ---
    const otCsv = `工号,姓名,加班日期,加班时长,加班类型
E2E001,张三,2026-11-07,3小时,休息日
`
    const rOt = await upload('overtime', 'e2e-http-ot.csv', otCsv)
    assert(rOt.statusCode === 200, `加班上传 HTTP ${rOt.statusCode}`)
    const otData = unwrap(rOt)
    const cOt = await app.inject({
      method: 'POST', url: `/api/hr-import/batches/${otData.batchId}/confirm`, headers: auth,
    })
    assert(cOt.statusCode === 200, `加班确认 HTTP ${cOt.statusCode}`)
    assert(unwrap(cOt).inserted === 1, '写入 1 条加班')

    // --- 外出 ---
    const outCsv = `工号,姓名,开始日期,结束日期,开始时间,结束时间,外出地点,外出事由,审批状态
E2E001,张三,2026-11-05,2026-11-05,09:00,12:00,客户现场,上门实施,已通过
`
    const rOut = await upload('outgoing', 'e2e-http-out.csv', outCsv)
    assert(rOut.statusCode === 200, `外出上传 HTTP ${rOut.statusCode}`)
    const outData = unwrap(rOut)
    const cOut = await app.inject({
      method: 'POST', url: `/api/hr-import/batches/${outData.batchId}/confirm`, headers: auth,
    })
    assert(cOut.statusCode === 200, `外出确认 HTTP ${cOut.statusCode}`)
    assert(unwrap(cOut).inserted === 1, '写入 1 条外出')

    console.log('\n[4] 差异拦截:未裁决时确认被拒')
    const dupCsv = `工号,姓名,日期,上班打卡,下班打卡
E2E001,张三,2026-11-02,10:00,19:00
`
    const rDup = await upload('attendance', 'e2e-http-dup.csv', dupCsv)
    const dupData = unwrap(rDup)
    assert(dupData.conflictRows === 1, '检测出 1 条差异')
    const cDup = await app.inject({
      method: 'POST', url: `/api/hr-import/batches/${dupData.batchId}/confirm`, headers: auth,
    })
    assert(cDup.statusCode === 409, `未裁决确认 → HTTP ${cDup.statusCode}(应 409)`)

    console.log('\n[5] 差异裁决 → 再确认')
    const detail = await app.inject({
      method: 'GET', url: `/api/hr-import/batches/${dupData.batchId}`, headers: auth,
    })
    const rows = unwrap(detail).rows
    const conflictRow = rows.find((r) => r.matchStatus === 'conflict')
    assert(!!conflictRow, '找到差异行')
    const resolveRes = await app.inject({
      method: 'POST',
      url: `/api/hr-import/rows/${conflictRow.id}/resolve`,
      headers: auth,
      payload: { resolution: 'keep_system' },
    })
    assert(resolveRes.statusCode === 200, `裁决 HTTP ${resolveRes.statusCode}`)
    const cDup2 = await app.inject({
      method: 'POST', url: `/api/hr-import/batches/${dupData.batchId}/confirm`, headers: auth,
    })
    assert(cDup2.statusCode === 200, '裁决后确认成功')

    console.log('\n[6] 结算:日结 → 月结')
    const dailyRes = await app.inject({
      method: 'POST', url: '/api/hr-settle/daily', headers: auth,
      payload: { periodMonth: '2026-11' },
    })
    assert(dailyRes.statusCode === 200, `日结 HTTP ${dailyRes.statusCode}`)
    const dailyData = unwrap(dailyRes)
    assert(dailyData.employeeDays > 0, `日结 ${dailyData.employeeDays} 人日`)

    const monthlyRes = await app.inject({
      method: 'POST', url: '/api/hr-settle/monthly', headers: auth,
      payload: { periodMonth: '2026-11' },
    })
    assert(monthlyRes.statusCode === 200, `月结 HTTP ${monthlyRes.statusCode}`)
    const monthlyData = unwrap(monthlyRes)
    assert(monthlyData.employees >= 1, `月结 ${monthlyData.employees} 人`)

    const monthlyQuery = await app.inject({
      method: 'GET', url: '/api/hr-settle/monthly?periodMonth=2026-11', headers: auth,
    })
    assert(monthlyQuery.statusCode === 200, '月结查询成功')
    const mRows = unwrap(monthlyQuery).rows
    const e1 = mRows.find((r) => r.employeeNo === 'E2E001')
    console.log('   E2E001 月结:', JSON.stringify({
      scheduled: e1.scheduledDays, actual: e1.actualDays, late: e1.lateCount,
      ot: e1.otHours, leave: e1.leaveDays,
    }))
    assert(Number(e1.lateCount) === 1, '迟到 1 次')
    assert(Number(e1.otHours) === 3, '加班 3 小时')

    console.log('\n[7] 薪资计算')
    await sql`INSERT INTO hr_salary_config (employee_id, base_salary, fixed_allowance, effective_from)
      SELECT id, '21750.00', '500.00', '2026-01-01' FROM hr_employee WHERE employee_no='E2E001'`
    await sql`DELETE FROM hr_insurance_rate_config WHERE region_name='E2E测试市'`
    await sql`INSERT INTO hr_insurance_rate_config
      (region_name, pension_personal, medical_personal, unemployment_personal, housing_fund_rate,
       insurance_base_min, insurance_base_max, effective_year, enabled)
      VALUES ('E2E测试市', 0.08, 0.02, 0.005, 0.07, '3000.00', '30000.00', 2026, true)`

    const calcRes = await app.inject({
      method: 'POST', url: '/api/hr-payroll/calculate', headers: auth,
      payload: { periodMonth: '2026-11', regionName: 'E2E测试市' },
    })
    assert(calcRes.statusCode === 200, `算薪 HTTP ${calcRes.statusCode}`)
    const calcData = unwrap(calcRes)
    console.log('   结果:', JSON.stringify({
      employees: calcData.employees, inserted: calcData.inserted,
      gross: calcData.totalGross, net: calcData.totalNet,
    }))
    assert(calcData.inserted === 1, '算出 1 人工资')
    assert(calcData.totalGross > 0, `应发 ${calcData.totalGross}`)

    const itemsRes = await app.inject({
      method: 'GET', url: '/api/hr-payroll/items?periodMonth=2026-11', headers: auth,
    })
    assert(itemsRes.statusCode === 200, '工资单查询成功')
    const items = unwrap(itemsRes)
    console.log('   工资单:', JSON.stringify(items.rows[0].breakdown.steps))
    assert(items.rows.length === 1, '1 条工资记录')
    assert(items.rows[0].netPay === items.rows[0].breakdown.steps.netPay.toFixed(2),
      '实发与 breakdown 一致')

    console.log('\n[8] 权限隔离:薪资权限点存在但不等于考勤权限')
    const perms = await sql`SELECT name FROM permissions WHERE name LIKE 'hr:%' ORDER BY name`
    const names = perms.map((p) => p.name)
    console.log('   权限点:', names.join(', '))
    assert(names.includes('hr:payroll:manage'), 'hr:payroll:manage 已入库')
    assert(names.includes('hr:payroll:view'), 'hr:payroll:view 已入库')
    assert(names.length === 4, '共 4 个 HR 权限点')

    // 清场
    await sql`DELETE FROM hr_import_batch WHERE file_name LIKE 'e2e-http%'`
    await sql`DELETE FROM hr_payroll_item WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_payroll_period WHERE period_month='2026-11'`
    await sql`DELETE FROM hr_attendance_monthly WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_attendance_daily WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_salary_config WHERE employee_id IN (
      SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
    await sql`DELETE FROM hr_insurance_rate_config WHERE region_name='E2E测试市'`
    await sql`DELETE FROM hr_attendance_rule WHERE department_id=${deptId}::uuid`
    await sql.end()

    console.log('\n✅ HTTP 级全链路端到端全部通过')
  } finally {
    await app.close()
  }
}

main().catch((e) => {
  console.error('\n❌ FAILED:', e)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
