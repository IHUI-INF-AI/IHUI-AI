// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/intentional-file-deletion.test.mjs
/**
 * 「有意整文件删除」通知书通道的镜像取证 —— 重点是 2026-11-04 补的**提交侧复活判据**
 * (`judgeResurrection`)。
 *
 * 事故形态(实证):
 *   ① healer 侧 —— `heal-worktree-tracked.mjs` 每 2-6 分钟把「工作树缺 ∧ 索引==HEAD」的
 *      tracked 文件 `git restore` 回来,一次 85 件清理每轮被复活(已于 `54feeb4011` 用通知书闸修);
 *   ② 提交侧 —— `8331e5460a`(父提交正是修好 healer 的 `54feeb4011`)把 `105a55a40c` 删掉的
 *      3 件当**新增**提交回来:并发 agent 的工作树早被更早一轮 healer 放回了那 3 件,
 *      它的 `git add -A` 便收编成"新文件"。healer 够不到 `git add`,所以必须另立判据。
 *
 * 本文件钉的是 ② 的判据本体与装车:
 *   T1-T5  三态(absent / broken / entries+defective)—— 坏档绝不能被读成"空表=没声明";
 *   T6-T11 judgeResurrection 六档:命中 / 过期不命中 / 台账外不命中 / 只认新增面 / 坏档判不出 /
 *          缺席判"无判据"但 why 必须点名;
 *   T12    路径归一(反斜杠、`./` 前缀、重复斜杠、去重);
 *   T13    装车形状锁 —— safe-commit 必须真的调用 judgeResurrection(§0.9「造好没装车=没有」),
 *          且不得在提交器里再抄第二份台账解析(§22c);
 *   T14    真仓台账自洽 —— 现存条目必须全部过形状,且每条 path 在 HEAD 里确实不存在
 *          (台账与版本树对账:登记了"要删"却还在树里,说明登记没落地或文件被复活后没再删)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  INTENTIONAL_FILE_DELETION_FILE,
  NOTICE_REASON_MIN,
  buildNoticeIndex,
  isDeletionDeclared,
  judgeResurrection,
  normalizeNoticePath,
  parseFileDeletionNotices,
} from '../lib/intentional-file-deletion.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')

/** 造一份「已过形状」的台账文本。 */
function ledger(...rows) {
  return rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
}

// ─── T1: absent —— 文件不存在 ⇒ 按零条目判,但必须**报出缺席** ─────────────
test('T1 台账缺席:absent=true 且 entries 为空(不静默当空表)', () => {
  const n = parseFileDeletionNotices(null)
  assert.equal(n.absent, true)
  assert.equal(n.broken, null)
  assert.deepEqual(n.entries, [])
})

// ─── T2: broken —— 文本在但解不开 ⇒ 必须落 broken,绝不能退化成空表 ────────
test('T2 台账坏档:JSON 解不开 ⇒ broken 带行号,entries 不当作"没问题"', () => {
  const n = parseFileDeletionNotices('{"path":"a.ts","reason":"这是一条足够长的删除理由"}\n{坏行\n')
  assert.ok(n.broken, '坏行必须落 broken')
  assert.match(n.broken, /第 2 行/)
})

// ─── T3: entries / defective 分流 ───────────────────────────────────────
test('T3 理由不足 ⇒ 进 defective 并点名 why,不进 entries', () => {
  const n = parseFileDeletionNotices(ledger({ path: 'a.ts', reason: '短' }))
  assert.equal(n.entries.length, 0)
  assert.equal(n.defective.length, 1)
  assert.match(n.defective[0].why, new RegExp(String(NOTICE_REASON_MIN)))
})

test('T4 注释行与空行被跳过,不影响条目', () => {
  const text = `// 说明\n\n${ledger({ path: 'a.ts', reason: '这类文件零运行时引用,整文件删除' })}\n// 尾注\n`
  const n = parseFileDeletionNotices(text)
  assert.equal(n.broken, null)
  assert.equal(n.entries.length, 1)
  assert.equal(n.entries[0].path, 'a.ts')
})

test('T5 until 不是 ISO 日期 ⇒ defective(不把坏日期当长期有效)', () => {
  const n = parseFileDeletionNotices(
    ledger({ path: 'a.ts', reason: '这类文件零运行时引用,整文件删除', until: '2026/11/04' }),
  )
  assert.equal(n.entries.length, 0)
  assert.equal(n.defective.length, 1)
  assert.match(n.defective[0].why, /ISO/)
})

// ─── T6: 提交侧复活判据 —— 命中 ─────────────────────────────────────────
test('T6 judgeResurrection:新增面命中台账 ⇒ resurrected,并带出理由', () => {
  const notices = parseFileDeletionNotices(
    ledger({ path: 'apps/web/x/Old.tsx', reason: '迁移残留,零引用,整文件删除' }),
  )
  const j = judgeResurrection({ notices, addedPaths: ['apps/web/x/Old.tsx'], today: '2026-11-04' })
  assert.equal(j.verdict, 'resurrected')
  assert.equal(j.hits.length, 1)
  assert.equal(j.hits[0].path, 'apps/web/x/Old.tsx')
  assert.match(j.hits[0].entry.reason, /迁移残留/)
})

// ─── T7: 过期通知书不参与判据(到期自动失效,不是"永久免检") ──────────────
test('T7 judgeResurrection:通知书已过期 ⇒ clean(到期即失效)', () => {
  const notices = parseFileDeletionNotices(
    ledger({ path: 'a.ts', reason: '临时删除,观察期结束后复核', until: '2026-10-01' }),
  )
  const j = judgeResurrection({ notices, addedPaths: ['a.ts'], today: '2026-11-04' })
  assert.equal(j.verdict, 'clean')
  assert.equal(j.hits.length, 0)
})

test('T7b isDeletionDeclared:过期档必须报 expired 而不是 not-declared', () => {
  const notices = parseFileDeletionNotices(
    ledger({ path: 'a.ts', reason: '临时删除,观察期结束后复核', until: '2026-10-01' }),
  )
  const d = isDeletionDeclared(notices, 'a.ts', '2026-11-04')
  assert.equal(d.declared, false)
  assert.equal(d.verdict, 'expired')
})

// ─── T8: 台账外路径不受影响(不误伤正常新增) ────────────────────────────
test('T8 judgeResurrection:新增面与台账无交集 ⇒ clean', () => {
  const notices = parseFileDeletionNotices(
    ledger({ path: 'a.ts', reason: '零运行时引用,整文件删除处理' }),
  )
  const j = judgeResurrection({ notices, addedPaths: ['b.ts', 'c/d.tsx'], today: '2026-11-04' })
  assert.equal(j.verdict, 'clean')
  assert.deepEqual(j.hits, [])
})

// ─── T9: 只认「新增面」—— 修改不需要撤回通知书 ──────────────────────────
test('T9 judgeResurrection:台账内路径若只是被修改(不在新增面)则不拦', () => {
  const notices = parseFileDeletionNotices(
    ledger({ path: 'a.ts', reason: '零运行时引用,整文件删除处理' }),
  )
  // 调用方只把 `A` 态路径送进来;修改文件不进 addedPaths ⇒ 判据自然放行。
  const j = judgeResurrection({ notices, addedPaths: [], today: '2026-11-04' })
  assert.equal(j.verdict, 'clean')
})

// ─── T10: 坏档 ⇒ undetermined(判不出),绝不能读成 clean ────────────────
test('T10 judgeResurrection:台账坏档 ⇒ undetermined(不是 clean)', () => {
  const notices = parseFileDeletionNotices('{坏行\n')
  const j = judgeResurrection({ notices, addedPaths: ['a.ts'], today: '2026-11-04' })
  assert.equal(j.verdict, 'undetermined')
  assert.ok(j.why)
})

// ─── T11: 缺席 ⇒ clean,但 why 必须点名"无判据" ─────────────────────────
test('T11 judgeResurrection:台账缺席 ⇒ clean 且 why 点名无判据', () => {
  const notices = parseFileDeletionNotices(null)
  const j = judgeResurrection({ notices, addedPaths: ['a.ts'], today: '2026-11-04' })
  assert.equal(j.verdict, 'clean')
  assert.match(j.why, /不存在/)
})

// ─── T12: 路径归一 + 去重 ───────────────────────────────────────────────
test('T12 路径归一:反斜杠/./前缀/重复斜杠都折成同一 key,且 hits 去重', () => {
  assert.equal(normalizeNoticePath('.\\apps\\web\\a.tsx'), 'apps/web/a.tsx')
  assert.equal(normalizeNoticePath('./apps//web/a.tsx'), 'apps/web/a.tsx')
  const notices = parseFileDeletionNotices(
    ledger({ path: 'apps/web/a.tsx', reason: '零运行时引用,整文件删除处理' }),
  )
  const j = judgeResurrection({
    notices,
    addedPaths: ['apps\\web\\a.tsx', './apps/web/a.tsx', 'apps//web/a.tsx'],
    today: '2026-11-04',
  })
  assert.equal(j.verdict, 'resurrected')
  assert.equal(j.hits.length, 1, '同一路径的三种写法必须只算一条')
})

// ─── T13: 装车形状锁 —— 判据必须真的被提交器调用 ────────────────────────
test('T13 装车:safe-commit 调用 judgeResurrection,且不另抄台账解析', () => {
  const src = readFileSync(join(REPO_ROOT, 'scripts/safe-commit.mjs'), 'utf8')
  assert.match(src, /judgeResurrection\s*\(/, 'Step 3b-2 必须调用 lib 判据(造好没装车=没有)')
  assert.match(
    src,
    /from '\.\/lib\/intentional-file-deletion\.mjs'/,
    '判据必须来自 lib 单一真相源',
  )
  // §22c:提交器里不得再出现第二条解析(JSON.parse 台账行 / 手写 reason 长度比较)
  assert.doesNotMatch(
    src,
    /NOTICE_REASON_MIN/,
    'safe-commit 不得自行比较理由长度 —— 那是 parseFileDeletionNotices 的职责',
  )
})

// ─── T14: 真仓台账自洽(台账 ↔ 版本树对账)───────────────────────────────
test('T14 真仓台账:条目全部过形状、无重复,且登记的路径确实不在版本树里', () => {
  const abs = join(REPO_ROOT, INTENTIONAL_FILE_DELETION_FILE)
  if (!existsSync(abs)) return // 台账缺席在真仓里合法(从未登记过删除)
  const n = parseFileDeletionNotices(readFileSync(abs, 'utf8'))
  assert.equal(n.broken, null, `台账坏档:${n.broken}`)
  assert.equal(
    n.defective.length,
    0,
    `台账有 ${n.defective.length} 条被拒条目:${n.defective.map((d) => `${d.path}(${d.why})`).join(', ')}`,
  )
  if (n.entries.length === 0) return // 只有注释头的空台账:合法中间态

  const seen = new Set()
  for (const e of n.entries) {
    assert.ok(!seen.has(e.path), `台账重复登记:${e.path}`)
    seen.add(e.path)
  }

  // **对账**:登记为"有意删除"的路径,在版本树里就不该还活着。
  // 这一条正是 2026-11-04 那 3 件回流的自动探针 —— `8331e5460a` 把它们当新增提交回来时,
  // 台账没登记所以没人发现;现在只要登记过的文件再出现在树里,本用例立刻变红。
  //
  // 基准取 `origin/main` 优先:本地 HEAD 常年落后远端(多会话并发),拿落后 HEAD 对账会把
  // "远端已删、本地还没拉到"读成回流,满屏假红 —— 那条探针随后就会被当噪音关掉。
  const probeRef = (() => {
    for (const ref of ['origin/main', 'HEAD']) {
      const r = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', '--verify', '--quiet', ref], {
        windowsHide: true,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 30_000,
      })
      if (r.error) return null // git 不可用(裸检出/沙箱)⇒ 判不出
      if (r.status === 0) return ref
    }
    return null
  })()
  if (!probeRef) return // 判不出就跳过对账,绝不伪造通过(§0.3)

  const revived = []
  for (const e of n.entries) {
    const r = spawnSync('git', ['-C', REPO_ROOT, 'cat-file', '-e', `${probeRef}:${e.path}`], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 30_000,
    })
    if (r.error) return // 同上:判不出不伪造结论
    if (r.status === 0) revived.push(e.path)
  }
  assert.deepEqual(
    revived,
    [],
    `以下路径已登记为「有意删除」却仍在 ${probeRef} 树里(被复活后再次提交 = 回流):\n  ${revived.join('\n  ')}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
