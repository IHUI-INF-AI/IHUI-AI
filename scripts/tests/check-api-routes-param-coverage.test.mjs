// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:守门 8(check-api-routes)「参数段假命中」盲区(2026-10-23 立)。
 *
 * 病根(复现证据):旧 `matchSegs` 对 `:param` 段两侧都 `continue`,「段数相等」成了唯一约束 ⇒
 * 一条参数路由会吞掉任意同段数的**具体字面路径**。实证(HEAD 面全量档):
 *   · 主腿 60 处:如 `GET /api/asks/mine` ↔ `GET /api/asks/:id`、
 *     `GET /api/auth/google/callback` ↔ `GET /api/auth/:provider/callback`;
 *   · BP 腿 4 处:如 `GET /api/refund/:param` ↔ `GET /api/refunds/:id` 一族。
 * 旧口径把它们全记成「已在册」,于是"后端从未注册的具体静态路径"在账面是绿的 —— 真死调用结构上不可见。
 *
 * 本票只改**分档**,不新增判红路径(§12e:改判会让存量一次性从"在册"落到"未判定",
 * 当场判红就是与任何提交都无关的恒红门):
 *   · `literal` / `wild` ⇒ 仍按在册(正例);
 *   · `param`          ⇒ 落「未判定(参数段覆盖)」,逐条点名 + 计入结论行,**不记在册也不判红**。
 *
 * 覆盖面(每条都盯住一种"修过头/修漏/静默失效"的方向):
 *   T1 判据本体(直接 import 源脚本 `__test__`,§22c 不复制判据)
 *   T2 反例:具体路径只被 `:param` 接住 ⇒ 不记在册、不判红、逐条点名
 *   T3 正例:字面静态注册优先 ⇒ 同一条调用仍判在册(未判定桶 0)
 *   T4 防过度收紧:前端动态段 ↔ 后端参数段是同一路由形状,不得误判
 *   T5 存量只报数:结论行必须带读数,且退出码不得因此翻红
 *   T6 源码锁:param 分流不得被并回 `found`;`matchSegs` 必须委托共享判据
 *
 * 2026-10-24 追加(票 G-962c,门 8「前缀假设未判定」7 条的成因 —— **方法推导读错**):
 *   T7 驼峰/复合命名 wrapper 正控(`srsPost` / `postJson` / 跨行 `postQuiet` ⇒ POST)
 *   T8 `del(` 正控(miniapp-taro `api-bridge` 的 DELETE 短名)
 *   T9 邻行不借用负控(上一个**独立语句**是 `post(...)`,本行无动词名 ⇒ 必须是 GET)
 *   T10 接线锁:门体只许 import 这一份判据,不得自带第二份 `inferMethodAtLine`
 *
 * 三个行为例都按"旧实现代入即红"设计:旧判据对它们分别给出 GET / GET / POST(全是错的)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as LIB } from '../lib/route-registration-extract.mjs'
// 方法推导判据本体(2026-10-24 由门体搬到 lib,理由见该文件头注):测试直接 import 生产判据,
// 不在本文件复制任何词表/正则常量(§22c;复制一份必然漂移)。
import { __test__ as METHOD_INFER } from '../lib/api-route-method-infer.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-api-routes.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')
const BASELINE = JSON.stringify({ version: 1, perFileCount: {} })

function root() {
  const dir = mkScratch('ihui-api-routes-param-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
  return dir
}
function put(dir, rel, content) {
  const full = join(dir, ...rel.split('/'))
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}
function run(dir, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, '--worktree', '--root', dir, ...extra], {
    cwd: HERE,
    encoding: 'utf8',
    // 不建 stdin 管道在本机会必 EBUSY(见记忆:凡不吃 stdin 的子进程一律带管道)
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}
/** 契约夹具:后端 /asks 面由 asksBody 决定,前端调用由 webCall 决定 */
function fixture(asksBody, webCall) {
  const dir = root()
  put(dir, 'scripts/api-routes-baseline.json', BASELINE)
  put(
    dir,
    'apps/api/src/server.ts',
    "import { asksRoutes } from './routes/asks'\nserver.register(asksRoutes, { prefix: '/api' })\n",
  )
  put(dir, 'apps/api/src/routes/asks.ts', `export async function asksRoutes(server) {\n${asksBody}}\n`)
  put(dir, 'apps/web/src/call.ts', webCall)
  return dir
}

// ─── T1 判据本体:直接打共享 lib 的 __test__(不复制判据)───

test('T1 覆盖分类:具体字面段被 :param 吞 ⇒ param;字面相等/同族动态段 ⇒ literal;段数不等 ⇒ null', () => {
  const f = LIB.classifyRouteCoverage
  assert.equal(typeof f, 'function', '共享判据必须由 __test__ 暴露(§22c)')
  assert.equal(f(['', 'api', 'asks', 'my'], ['', 'api', 'asks', ':id']), 'param')
  assert.equal(f(['', 'api', 'asks', 'my', 'answers'], ['', 'api', 'asks', ':id', 'answers']), 'param')
  assert.equal(f(['', 'api', 'asks', 'my'], ['', 'api', 'asks', 'my']), 'literal')
  assert.equal(f(['', 'api', 'asks', ':param'], ['', 'api', 'asks', ':id']), 'literal')
  assert.equal(f(['', 'api', 'asks', 'my'], ['', 'api', 'asks', ':id', 'answers']), null)
  assert.equal(f(['', 'api', 'asks', 'my'], ['', 'api', 'circles', ':id']), null)
})

// ─── T2 反例:参数段假命中不再记「已在册」───

test('T2 反例:具体路径只被 :param 接住 ⇒ 落未判定桶 + 逐条点名,且不进死调用清单', () => {
  const dir = fixture("  server.get('/asks/:id', async () => ({}))\n", "fetch('/api/asks/my')\n")
  try {
    const dump = join(dir, 'undetermined.json')
    const missingFile = join(dir, 'missing.json')
    const r = run(dir, ['--dump-undetermined', dump, '--dump-missing', missingFile])
    const u = JSON.parse(readFileSync(dump, 'utf8'))
    const missing = JSON.parse(readFileSync(missingFile, 'utf8'))
    assert.equal(r.status, 0, `存量不得判红(§12e)\n${r.out}`)
    assert.match(r.out, /未判定\(参数段覆盖\)1 处/, `必须把这一档单独点名\n${r.out}`)
    assert.match(r.out, /\/api\/asks\/my/, '必须逐条报名,不许只给数字')
    assert.deepEqual(
      (u.paramSegmentCovered || []).map((c) => `${c.method} ${c.path}`),
      ['GET /api/asks/my'],
      `--dump-undetermined 必须带出该站点\n${JSON.stringify(u, null, 1)}`,
    )
    assert.deepEqual(missing, [], '参数覆盖不是死调用 —— 不得同时落进死调用桶(两桶互斥)')
  } finally {
    rmScratch(dir)
  }
})

// ─── T3 正例:字面静态注册优先 ───

test('T3 正例:后端真有字面静态注册 ⇒ 同一条调用仍判在册,未判定桶 0', () => {
  const dir = fixture(
    "  server.get('/asks/:id', async () => ({}))\n  server.get('/asks/my', async () => ({}))\n",
    "fetch('/api/asks/my')\n",
  )
  try {
    const r = run(dir)
    assert.equal(r.status, 0, r.out)
    assert.match(r.out, /未判定\(参数段覆盖\)0 处/, `字面注册必须优先,不得被打进未判定桶\n${r.out}`)
    assert.match(r.out, /✅ 通过/, r.out)
  } finally {
    rmScratch(dir)
  }
})

// ─── T4 防过度收紧:前端动态段是同一路由形状 ───

test('T4 防过度收紧:前端动态段 ↔ 后端参数段不误判(未判定桶 0 且 exit 0)', () => {
  const dir = fixture(
    "  server.get('/asks/:id/answers', async () => ({}))\n",
    'fetch(`/api/asks/${encodeURIComponent(id)}/answers`)\n',
  )
  try {
    const r = run(dir)
    assert.equal(r.status, 0, r.out)
    assert.match(r.out, /未判定\(参数段覆盖\)0 处/, `同族动态段不得被误判为参数假命中\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T5 存量只报数:读数必须进结论行,退出码不因存量翻红 ───

test('T5 存量只报数:结论行带"参数段覆盖 N 处未判定、不记在册",不改变退出码', () => {
  const dir = fixture("  server.get('/asks/:id', async () => ({}))\n", "fetch('/api/asks/my')\n")
  try {
    const r = run(dir)
    assert.equal(r.status, 0, r.out)
    assert.match(
      r.out,
      /参数段覆盖 1\+0 处未判定、不记在册/,
      `结论行必须带读数 —— 否则"通过"被读成"没有这一档"\n${r.out}`,
    )
    // 未判定块必须早于结论行(顺序反了等于被结论盖住)
    const iBlock = r.out.indexOf('未判定(参数段覆盖)')
    const iPass = r.out.indexOf('✅ 通过')
    assert.ok(iBlock >= 0 && iPass > iBlock, `未判定块(${iBlock})必须早于结论行(${iPass})`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T6 源码锁:分流不得被并回 found / 判据不得被抄第二份 ───

test('T6 源码锁:param 必须先于 found 分流;matchSegs 必须委托共享判据', () => {
  assert.match(
    SRC,
    /coverage === 'param'[\s\S]{0,120}paramCovered\.push\(call\)[\s\S]{0,40}continue/,
    '主腿必须把 param 档单独分流进未判定桶(并回 found 即复活假绿)',
  )
  assert.match(
    SRC,
    /bareParam\.push\(c\)/,
    'BP 腿同一分档不得被删(裸路径同样会被 :param 吞)',
  )
  assert.match(
    SRC,
    /function matchSegs\(fParts, bParts\) \{\n  return classifyRouteCoverage\(fParts, bParts\) !== null/,
    'matchSegs 必须委托共享判据(第二份实现必然漂移,§0.6)',
  )
  assert.match(
    SRC,
    /classifyRouteCoverage/,
    '共享判据必须被门 import 使用,否则装上没装车',
  )
  assert.match(
    SRC,
    /参数段覆盖 \$\{paramCovered\.length\}\+\$\{bareParam\.length\} 处未判定、不记在册/,
    '结论行读数不得被删(判据失效的表现永远是安静)',
  )
})

// ─── T7/T8/T9 方法推导(票 G-962c)───
// 三例都按"旧实现代入即红"构造:旧判据分别给出 GET / GET / POST,而真值都是另一个。

test('T7 驼峰/复合命名 wrapper 正控:srsPost / postJson / 跨行 postQuiet 必须读出 POST', () => {
  const cases = [
    {
      // 旧实现:上下文启发式的 `\bpost\s*[<(]` 对 `srsPost<` 永不命中(post 前是字母 s)⇒ 读成 GET。
      lines: [
        'export function submitReview(id: string, q: number) {',
        "  return srsPost<ReviewResult>('/api/srs-review/review', { id, q })",
        '}',
      ],
      idx: 1,
      label: 'srsPost(动词在末段)',
    },
    {
      // 旧实现同理读成 GET。
      lines: [
        'export function launchDebugSession(params: LaunchParams) {',
        "  return postJson<LaunchResult>('/api/debug/launch', params)",
        '}',
      ],
      idx: 1,
      label: 'postJson(动词在首段)',
    },
    {
      // 跨行实参:方法名住在调用起点行,路径在下一行 —— 判据必须能向前跨进**同一表达式**取名字。
      lines: [
        'function reportResult(response: AgentActionResponse): void {',
        '  void postQuiet(',
        "    '/api/agent-control/result',",
        '    withRespondedIdentity(response),',
        "    '回传移动端执行结果',",
        '  )',
        '}',
      ],
      idx: 2,
      label: 'postQuiet(跨行实参)',
    },
  ]
  for (const c of cases) {
    assert.equal(
      METHOD_INFER.inferMethodAtLine(c.lines, c.idx),
      'POST',
      `${c.label}:驼峰/复合命名 wrapper 的方法必须读出来(旧实现读 GET)`,
    )
  }
})

test('T8 `del(` 正控:miniapp-taro 的 DELETE 短名必须读出 DELETE(旧实现读 GET)', () => {
  assert.ok(
    METHOD_INFER.METHOD_VERB_WORDS.get('del') === 'DELETE',
    'del 必须留在词表里(仓内 utils/api-bridge.ts 用它当 DELETE 短名)',
  )
  const lines = [
    'export const deleteExamWrongQuestion = (id: string) =>',
    '  del<{ deleted: boolean }>(`/api/legacy/exam/wrong-questions/${id}`)',
  ]
  assert.equal(
    METHOD_INFER.inferMethodAtLine(lines, 1),
    'DELETE',
    '旧启发式清单里没有 del ⇒ 会把这条 DELETE 读成 GET',
  )
})

test('T9 邻行不借用负控:上一个独立语句是 post( 时,本行仍是 GET', () => {
  // 本行的被调名 `apiCall` 不含任何动词词段 ⇒ 唯一能救它的就是"窗口只在当前调用表达式内"。
  // 旧实现窗口是纯行号区间(-3..+4),上一行的 `post(` 会被借走 ⇒ 读成 POST。
  const lines = [
    "export const firstShare = (data: unknown) => post('/api/share/first-claim', data)",
    'export const loadShare = (code: string) => apiCall(`/api/share/content/${code}`)',
  ]
  assert.equal(
    METHOD_INFER.inferMethodAtLine(lines, 1),
    'GET',
    '邻行独立语句的 post( 不得借给本行(旧实现读成 POST)',
  )
  // 同一形态的对照组:被调名自带 get ⇒ 也必须 GET(短名识别与窗口收窄两条判据互不覆盖)。
  const lines2 = [
    "export const firstShare2 = (data: unknown) => post('/api/share/first-claim', data)",
    'export const getShareContentByCode = (code: string) => get(`/api/share/content/${code}`)',
  ]
  assert.equal(METHOD_INFER.inferMethodAtLine(lines2, 1), 'GET')
  // 窗口边界本身:跨行参数列表必须**仍能**读到下一行的 method(收窄不得误伤真调用)。
  const multilineOptions = [
    "export const r = await fetchApi('/api/x', {",
    "  method: 'POST',",
    '})',
  ]
  assert.equal(
    METHOD_INFER.inferMethodAtLine(multilineOptions, 0),
    'POST',
    '收窄只挡"邻行独立语句",跨行 options 里自己的 method 必须照读',
  )
})

// ─── T10 接线锁:判据只有一份 ───

test('T10 接线锁:门体 import lib 的判据,不得自带第二份 inferMethodAtLine', () => {
  assert.match(
    SRC,
    /import \{ inferMethodAtLine \} from '\.\/lib\/api-route-method-infer\.mjs'/,
    '门体必须 import 共享判据(§0.6 单一真相源)',
  )
  assert.doesNotMatch(
    SRC,
    /function inferMethodAtLine\s*\(/,
    '门体不得自带第二份实现(两处算同一件事必漂移)',
  )
  for (const k of ['inferMethodAtLine', 'methodVerbOfCallName', 'callExprSpan', 'METHOD_VERB_WORDS']) {
    assert.equal(typeof METHOD_INFER[k], k === 'METHOD_VERB_WORDS' ? 'object' : 'function', `__test__ 必须暴露 ${k}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
