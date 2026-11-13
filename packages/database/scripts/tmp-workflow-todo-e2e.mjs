// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

/**
 * 流程待办真库端到端验证(临时脚本)。
 *
 * 验三条铁律 + 路由可用:
 *   ① 幂等:同 dedupeKey 重复上报不堆行,只刷新计数;
 *   ② 不复活:已 ignored 的待办,重跑不会被打回 open;
 *   ③ 可操作:列表/认领/结清走真实 HTTP。
 */
import { createHmac } from 'node:crypto'
import postgres from 'postgres'

const PORT = process.env.PORT ?? '34597'
const TOKEN = process.env.AI_CALLBACK_SECRET
const ADMIN_ID = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'
const TENANT = 'cfe95955-7402-4d12-97ed-4ca9531f1da6'

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg)
  console.log('  ✓ ' + msg)
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const SRC = 'e2e.todo-test'
const REF = '2026-11'

async function caller(method, path, params) {
  const qs = method.toUpperCase() === 'GET' && Object.keys(params ?? {}).length
    ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : ''
  const url = `http://127.0.0.1:${PORT}/api${path}${qs}`
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = createHmac('sha256', TOKEN).update(`legacy-v1\n${ADMIN_ID}\n${ts}`, 'utf8').digest('hex')
  const res = await fetch(url, {
    method: method.toUpperCase(),
    headers: {
      'content-type': 'application/json',
      'x-internal-service-token': TOKEN,
      'x-user-id': ADMIN_ID,
      'x-internal-service-timestamp': ts,
      'x-internal-service-signature': sig,
      'x-tenant-id': TENANT,
    },
    body: method.toUpperCase() === 'GET' ? undefined : JSON.stringify(params ?? {}),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(body)?.slice(0, 200)}`)
  return body
}

/** 直接调服务层写入(避免为了造数先建流程) */
const { upsertTodos, resolveTodosByKeys, listTodos } = await import(
  '../../../apps/api/src/services/workflow-todo.ts'
)

async function cleanup() {
  await sql`DELETE FROM workflow_todo WHERE source_type = ${SRC}`
}

async function main() {
  await cleanup()
  console.log('\n[1] 首次上报两条待办')

  const r1 = await upsertTodos([
    {
      dedupeKey: `${SRC}:${REF}:missing_salary_config`,
      sourceType: SRC,
      sourceRef: REF,
      severity: 'warn',
      title: '3 人缺少薪资配置',
      detail: '测试用',
      affectedCount: 3,
      actionPath: '/admin/hr-data?tab=payroll',
    },
    {
      dedupeKey: `${SRC}:${REF}:empty_monthly`,
      sourceType: SRC,
      sourceRef: REF,
      severity: 'blocker',
      title: '没有月结数据',
    },
  ])
  assert(r1.created === 2, `新开 2 条(created=${r1.created})`)

  const c1 = await sql`SELECT count(*)::int AS c FROM workflow_todo WHERE source_type = ${SRC}`
  assert(c1[0].c === 2, `库中 2 行`)

  console.log('\n[2] 重复上报 ⇒ 幂等,不堆行,只刷新计数')
  const r2 = await upsertTodos([
    {
      dedupeKey: `${SRC}:${REF}:missing_salary_config`,
      sourceType: SRC,
      sourceRef: REF,
      title: '5 人缺少薪资配置',
      affectedCount: 5,
    },
  ])
  assert(r2.created === 0 && r2.refreshed === 1, `未新建(refreshed=${r2.refreshed})`)
  const c2 = await sql`SELECT count(*)::int AS c FROM workflow_todo WHERE source_type = ${SRC}`
  assert(c2[0].c === 2, `行数仍是 2(未堆重复)`)
  const [row] = await sql`
    SELECT affected_count, title FROM workflow_todo
    WHERE dedupe_key = ${`${SRC}:${REF}:missing_salary_config`}`
  assert(row.affected_count === 5, `计数已更新为 5(实际 ${row.affected_count})`)
  assert(row.title.includes('5 人'), '标题也刷新了')

  console.log('\n[3] 忽略一条 ⇒ 重跑不复活')
  const [target] = await sql`
    SELECT id FROM workflow_todo WHERE dedupe_key = ${`${SRC}:${REF}:missing_salary_config`}`
  await caller('POST', `/workflow-todos/${target.id}/resolve`, {
    status: 'ignored',
    note: '这月 5 人是新人,还没到配薪节点,已知悉',
  })
  const [afterIgnore] = await sql`
    SELECT status, resolution_note FROM workflow_todo WHERE id = ${target.id}::uuid`
  assert(afterIgnore.status === 'ignored', '已标记 ignored')
  assert(String(afterIgnore.resolution_note).includes('新人'), '处理说明已保存')

  const r3 = await upsertTodos([
    {
      dedupeKey: `${SRC}:${REF}:missing_salary_config`,
      sourceType: SRC,
      sourceRef: REF,
      title: '6 人缺少薪资配置',
      affectedCount: 6,
    },
  ])
  assert(r3.skippedResolved === 1, `被识别为已关闭(skippedResolved=${r3.skippedResolved})`)
  const [afterRerun] = await sql`
    SELECT status, affected_count FROM workflow_todo WHERE id = ${target.id}::uuid`
  assert(afterRerun.status === 'ignored', '状态仍是 ignored(没被重跑打回 open)')
  assert(afterRerun.affected_count === 6, '但影响规模刷新为 6(问题变大仍可见)')

  console.log('\n[4] 路由:列表只返回 open')
  const listRes = await caller('GET', '/workflow-todos', { sourceType: SRC, status: 'open' })
  assert(listRes.data.list.length === 1, `open 只有 1 条(另一条已 ignored)`)
  assert(listRes.data.list[0].severity === 'blocker', '是那条 blocker')

  console.log('\n[5] 路由:摘要计数')
  const sumRes = await caller('GET', '/workflow-todos/summary', { sourceType: SRC })
  assert(sumRes.data.open === 1, `open=${sumRes.data.open}`)
  assert(sumRes.data.blocker === 1, `blocker=${sumRes.data.blocker}`)

  console.log('\n[6] 路由:认领')
  const [openTodo] = listRes.data.list
  await caller('POST', `/workflow-todos/${openTodo.id}/claim`, { assign: true })
  const [claimed] = await sql`SELECT assignee_id FROM workflow_todo WHERE id = ${openTodo.id}::uuid`
  assert(claimed.assignee_id === ADMIN_ID, '认领人已写入')

  console.log('\n[7] 路由:结清必须填说明')
  let rejected = false
  try {
    await caller('POST', `/workflow-todos/${openTodo.id}/resolve`, { status: 'resolved', note: '  ' })
  } catch (e) {
    rejected = String(e.message).includes('400')
  }
  assert(rejected, '空说明被拒(400)')

  const okRes = await caller('POST', `/workflow-todos/${openTodo.id}/resolve`, {
    status: 'resolved',
    note: '已确认该月数据源未就绪,已延期到下月处理',
  })
  assert(okRes.data.status === 'resolved', '填了说明后结清成功')

  console.log('\n[8] 业务侧批量结清(问题消失时)')
  await upsertTodos([
    { dedupeKey: `${SRC}:${REF}:k1`, sourceType: SRC, sourceRef: REF, title: '问题1' },
    { dedupeKey: `${SRC}:${REF}:k2`, sourceType: SRC, sourceRef: REF, title: '问题2' },
  ])
  const resolved = await resolveTodosByKeys({
    dedupeKeys: [`${SRC}:${REF}:k1`, `${SRC}:${REF}:k2`],
    note: '数据已补齐,问题消失',
  })
  assert(resolved.resolved === 2, `批量结清 2 条`)

  console.log('\n✅ 流程待办真库端到端全部通过')
  await cleanup()
  await sql.end()
}

main().catch(async (e) => {
  console.error('\n❌ FAILED:', e.message)
  try { await cleanup() } catch {}
  await sql.end()
  process.exit(1)
})
