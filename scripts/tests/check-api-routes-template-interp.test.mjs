// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 8(check-api-routes)取材侧的「`:param` 假影」修复(2026-10-04)
//
// 病根:`extractFrontendCalls` 的 pathRe 字符类含 `\$ { }`(为 2026-09-17 那次
// 「单行内联查询串整条匹配」加固一并进来的),模板串插值被**整段吃进路径**:
//
//   `/api/subagents/all${suffix}` ⇒ 抽出 `/api/subagents/all${suffix}`
//                                    ⇒ normalizeCallPath 落成 `/api/subagents/all:param`
//
// 而运行期真实 URL 是 `/api/subagents/all` 或 `/api/subagents/all?status=x`
// —— `:param` 那个段**谁都没发过** ⇒ 凭空一条"后端不存在"的假影死调用。
//
// 本票修法:**保留 pathRe 原文**(收窄字符类会连带抽不出 1,158 条真实插值调用,
// 已实测否证,理由见 isTemplateInterpolationPhantom 注释),改为把「粘连插值且
// 插值不是查询串构造器」这一形态标记为「抽不出真路径」,归入既有的
// 「未判定(有传输口却抽不出路径)」桶(shapeUnknown),不进调用集。
//
// 覆盖面(每条都盯住一种"修过头"或"修漏"的方向):
//   T1 模板插值假影 ⇒ 不进调用集、不进死调用
//   T2 **同形态但无插值** ⇒ 仍进调用集且正常对账(防过度收紧 · 变异验证会翻红)
//   T3 真实字面量里含 `:` ⇒ 完全不受影响(源码实存,apps/web/api-docs/page.tsx:102 同形)
//   T4 正例对照:后端已注册 + 前端带插值 ⇒ 报 0(证明不是噪声发生器)
//   T5 源码锁:修法不得被"后来者求省事"换成收窄 pathRe 字符类
//
// 不重写判据实现(重写就是第二份真相,会跟着源一起漂绿);只锁"装上了 / 有牙 / 不静默 / 不过度"。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-api-routes.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

function root() {
  const dir = mkScratch('ihui-api-routes-interp-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
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
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}
const BASELINE = JSON.stringify({ version: 1, perFileCount: {} })

/** 从输出里取某一端的「文件 / 调用点 / 疑似不存在」三个数 */
function endStat(out, end) {
  // 正式档报数行:`· web:文件 N / 调用 N / 取不到内容 N / 未判定(...)N(...)`
  const m =
    out.match(new RegExp(`· ${end}:文件 (\\d+) / 调用 (\\d+) / 取不到内容 (\\d+) / 未判定`)) ||
    // 探针档报数行:`· web:文件 N / 调用点 N / 疑似不存在 N / 已豁免 N / 未判定`
    out.match(new RegExp(`· ${end}:文件 (\\d+) / 调用点 (\\d+) / 疑似不存在 (\\d+) /`))
  if (!m) throw new Error(`输出里没有 ${end} 的报数行\n${out}`)
  return { files: Number(m[1]), calls: Number(m[2]), dead: m[3] === undefined ? 0 : Number(m[3]) }
}
/** 某一端「死调用」总数(读死调用自己的行,不用调用点数代替 —— 两者不是一回事)。
 *  注意:零容忍端(web)死调用为 0 时**不打印**那一行(见 check-api-routes 的 ratchet 分支),
 *  所以读不到行就是 0,不能当成"取不到判据"。 */
function deadCalls(out, end) {
  const m = out.match(new RegExp(`· ${end}:死调用 (\\d+) 处`))
  return m ? Number(m[1]) : 0
}
/** 某一端「未判定(有传输口却抽不出路径)」的计数 */
function shapeUnknown(out, end) {
  const m = out.match(
    new RegExp(`· ${end}:文件 \\d+ / 调用(?:点)? \\d+ / [^\\n]*?未判定\\(有传输口却抽不出路径\\)(\\d+)`),
  )
  if (!m) throw new Error(`输出里没有 ${end} 的未判定计数\n${out}`)
  return Number(m[1])
}

// ─── T1 模板插值假影 ⇒ 不进调用集、不进死调用 ───
// 后端**故意不注册** `/api/x/all` 与 `/api/x/all:param` 任何一条:
// 若假影仍进调用集,`/api/x/all:param` 必被判死(死调用 +1)—— 这正是修掉的那条读数。
test('T1 模板插值假影不进调用集也不进死调用(粘连插值 + 非查询串构造器)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 只注册一条无关路由 ⇒ 任何**真**调用点都会被判死,读数干净可归因
    put(dir, 'apps/api/src/routes/none.ts', "server.get('/api/nothing-at-all', async () => ({}))\n")
    // 复刻 packages/api-client/src/endpoints/subagents.ts:186 的真实形态。
    // ⚠️ 必须带一个**传输口**(`fetchApi`):shapeUnknown 桶的判据是
    // `calls.length === 0 && TRANSPORT_RE.test(src)`,没有传输口就不进那个桶
    // (真实的 subagents.ts 走 `api()`,而 TRANSPORT_RE 认的是 fetchApi/fetch/axios 等 ——
    //  这正是"归入未判定"这个归属在真实面上**不完全**覆盖的原因,本用例只钉住归属同口径)。
    put(
      dir,
      'packages/api-client/src/endpoints/subagents.ts',
      [
        "import { fetchApi } from '@ihui/api-client'",
        'const qs = new URLSearchParams()',
        "if (q.status) qs.append('status', q.status)",
        "const suffix = qs.toString() ? `?${qs.toString()}` : ''",
        'export function getAll() {',
        '  return fetchApi(`/api/x/all${suffix}`)',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only'])
    assert.equal(r.status, 0, `本用例不该判红\n${r.out}`)
    assert.doesNotMatch(
      r.out,
      /all:param/,
      `假影 \`/api/x/all:param\` 仍被当成调用路径(它不是任何人会写的段)\n${r.out}`,
    )
    assert.equal(deadCalls(r.out, 'api-client'), 0, `假影不该进死调用(修前此处为 1)\n${r.out}`)
    assert.equal(
      endStat(r.out, 'api-client').calls,
      0,
      `抽不出真路径的插值不该进调用集\n${r.out}`,
    )
    // 归属:「未判定(有传输口却抽不出路径)」——与既有的抽不出路径同口径,不得静默消失
    assert.equal(
      shapeUnknown(r.out, 'api-client'),
      1,
      `假影必须归入既有的未判定桶(有传输口却抽不出路径)\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── T2 防过度收紧:**同一个文件里**插值与无插值两条并存,只有插值那条被剔 ───
// 这是"收窄 pathRe 字符类"那种改法的死穴:pathRe 要求**收尾引号紧邻**,把 `$ { }`
// 从字符类去掉 ⇒ 整条字面量匹配不上,连**不含插值**的同形路径也一起消失。
//
// 为什么必须写在**同一个文件**里(而不是 T1/T2 各用一个文件):
// 取材是**逐行**判的,过度收紧的失败形态是"某一类字面量整体抽不出"。
// 若两个形态分落两个文件,一个"按文件跳过"的过度修法也能让两条各自通过 ⇒ 测不出收紧。
// 同文件并存时,"按文件跳过"与"按形态跳过"两种过度修法都会立刻现形(调用点数对不上)。
test('T2 防过度收紧:同文件内插值那条被剔、无插值那条仍进调用集', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/x.ts', "server.get('/api/x/all', async () => ({}))\n")
    // 一个文件、两条调用:`${suffix}` 那条是假影(后端没注册 `/api/x/all:param`),
    // 无插值那条是真调用(后端注册了 `/api/x/all`)。
    put(
      dir,
      'apps/web/src/anchor.ts',
      [
        "import { fetchApi } from '@ihui/api-client'",
        'export function a(suffix: string) {',
        '  return fetchApi(`/api/x/all${suffix}`)',
        '}',
        'export function b() {',
        "  return fetchApi('/api/x/all')",
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only'])
    assert.equal(r.status, 0, `已注册路径不得判红\n${r.out}`)
    assert.equal(
      endStat(r.out, 'web').calls,
      1,
      `只有无插值那条该进调用集(读数 1);读数 0 = 过度收紧把整条字面量都抽不出来了\n${r.out}`,
    )
    assert.equal(deadCalls(r.out, 'web'), 0, `后端已注册 ⇒ 死调用 0\n${r.out}`)
    // 反向:另一条真调用也不能被顺带丢掉(计数必须恰好是 1,不是 0)
    assert.match(r.out, /前端 API 调用: 1 处/, `调用集必须恰好 1 条\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T3 真实字面量里含 `:` 的路径完全不受影响(源码实存同形) ───
// 复刻 apps/web/app/(main)/developer/api-docs/page.tsx:102 的真实形态:
// 源码里真就写着 `/api/developer/api-keys/:id/shares`,不是模板插值。
test('T3 真实字面量里的 `:` 不受影响(源码里真写着 :param 形状)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(
      dir,
      'apps/api/src/routes/k.ts',
      "server.get('/api/developer/api-keys/:id/shares', async () => ({}))\n",
    )
    put(
      dir,
      'apps/web/src/api-docs/page.tsx',
      [
        'export const paths = {',
        "  shares: '/api/developer/api-keys/:id/shares',",
        '}',
        "fetchApi('/api/developer/api-keys/:id/shares')",
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only'])
    assert.equal(r.status, 0, `已注册路径不得判红\n${r.out}`)
    assert.equal(
      endStat(r.out, 'web').calls,
      2,
      `源码里真写着 ':id' 的字面量必须两条都进调用集\n${r.out}`,
    )
    assert.equal(deadCalls(r.out, 'web'), 0, `两条都该对上后端注册\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T4 正例对照:后端已注册 + 前端带插值 ⇒ 报 0(证明修复不是噪声发生器) ───
// 用**整段插值**形态(`/api/activities/${slug}` ⇒ 归一成 `/api/activities/:param`,
// 与后端 `/api/activities/:slug` 对得上)。若修复把整段插值也误判成假影,
// 这一条会从"0 死调用"变成"0 调用点 + 1 未判定",从而暴露过度收紧。
test('T4 正例对照:后端已注册 + 前端整段插值 ⇒ 报 0(且仍进调用集)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(
      dir,
      'apps/api/src/routes/act.ts',
      "server.get('/api/activities/:slug', async () => ({}))\n",
    )
    put(
      dir,
      'apps/web/src/activities/[slug]/PageClient.tsx',
      [
        'export function useActivity(slug: string) {',
        '  return api(`/api/activities/${slug}`)',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only'])
    assert.equal(r.status, 0, `已注册路径不得判红\n${r.out}`)
    assert.equal(deadCalls(r.out, 'web'), 0, `整段插值应与后端 :slug 对上\n${r.out}`)
    assert.equal(
      endStat(r.out, 'web').calls,
      1,
      `整段插值必须仍进调用集(它归一出的 :param 是真实段形状)\n${r.out}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── T5 源码锁:修法不得被换成"收窄 pathRe 字符类"(已实测否证的那条路) ───
// 收窄字符类会让 1,158 条真实插值调用一起抽不出来(路径要求收尾引号紧邻)。
// 这条锁的是"别把判据改回一个已被否证的形态",并要求注释里留着否证理由。
test('T5 源码锁:pathRe 字符类保持原样,且修法是"标记"而非"收窄正则"', () => {
  // 逐字比 pathRe 那一行(不用正则比:这一行里有 8 个正则元字符,转义地狱不值得踩)
  const pathReLine = SRC.split(/\r?\n/).find((l) => l.includes('const pathRe ='))
  assert.ok(pathReLine, '找不到 pathRe 定义行')
  // 锁**字符类**那一段(收窄字符类就是从这儿下手的),而不是整行:
  // 整行里含 `['"`]` 的反引号,在模板串/普通字符串里都要跟转义打架,而字符类
  // `[a-zA-Z0-9/_\-${}:.?&=%,+~#@!;]` 里**没有**反引号 ⇒ 可以用 String.raw 干净地写死。
  //
  // 这里逐字要保住的三个字符是 `$` `{` `}`:pathRe 靠它们把模板串插值整段吃进路径,
  // 本票的修法是**下游标记**(isTemplateInterpolationPhantom)而不是删它们。
  // 删任何一个 ⇒ 1,158 条真实插值调用一起抽不出来(已实测否证)。
  // ⚠️ 这里**不能**用 String.raw:`${` 在模板串里仍会触发插值(而 `\$` 又会被当转义),
  //    写出来必然语法错或字面不符。所以整段由"普通字符串 + 逐字符码"拼 ——
  //    字符类里要保住的三个字符是反斜杠 + `$` + 花括号,它们在源码里的确切形态是:
  //      `\` `-`(转义连字符) `$` `{` `}`  —— 注意 `$` 与花括号**都没有**反斜杠。
  const BS = String.fromCharCode(92) // 反斜杠
  const CHAR_CLASS = '[a-zA-Z0-9/_' + BS + '-${}:.?&=%,+~#@!;]'
  assert.ok(
    pathReLine.includes(CHAR_CLASS),
    `pathRe 字符类被改动了(应逐字含 ${CHAR_CLASS})—— 收窄它会连带抽不出 1,158 条真实插值调用(已实测否证)`,
  )
  // 另两段也要保:开头必须仍要求**引号紧邻** `/api/`(这是"抽不出路径"这个归属得以
  // 成立的前提),结尾必须仍要求**收尾引号紧邻**(方案 a 之所以会连带抽不出整条字面量,
  // 动的就是这一段)。两段都含**反引号**,模板串会被它提前截断 ⇒ 反引号用变量注入。
  // 精确形态:开头 `['"`](`,结尾 `+)['"`]/g`。
  const BT = String.fromCharCode(96) // 反引号
  const QUOTE3 = "'" + '"' + BT // 三种引号 ' " `
  assert.ok(pathReLine.includes('[' + QUOTE3 + ']('), 'pathRe 的起始锚(引号紧邻 /api/)被改动')
  assert.ok(
    pathReLine.includes('+)[' + QUOTE3 + ']/g'),
    'pathRe 的收尾锚(收尾引号紧邻)被改动',
  )
  assert.match(
    SRC,
    /function isTemplateInterpolationPhantom\(/,
    '必须保留 isTemplateInterpolationPhantom 判据(否则 T1 会翻红成静默绿)',
  )
  // 判据必须在取材处被真正调用,而不是只定义不用
  assert.match(
    SRC,
    /if \(isTemplateInterpolationPhantom\(rawPath\)\) continue/,
    'extractFrontendCalls 必须消费该判据',
  )
  // 注释必须留着"为什么不收窄"的实测理由(否则下一个人会当成分疏漏顺手改掉)
  assert.match(
    SRC,
    /为什么不做"收窄 pathRe 字符类"/,
    '缺少"收窄正则已被否证"的注释 —— 后人会把它当疏漏改回去',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
