// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 98「HEAD 悬空具名导入对账」镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 重点钉四件"本地全绿也发现不了"的事:
 *  1. 判据必须真读 HEAD blob(工作区滞后 HEAD 是本仓常态);
 *  2. 棘轮锚点必须是该文件 HEAD 自身的违规数 —— 否则存量会把每次提交都判红,逼人 --no-verify;
 *  3. 必须装车(guardian-runner 里 id 98 存在、blocking、skipEnv 对得上);
 *  4. D4「影子 .js」必须**真能认出当年那枚把生产 API 打崩的文件** —— 判据只对自己造的夹具
 *     有牙,等于没有牙(§22c 那条"镜像测试只复读实现就是复读机"讲的就是这一格)。
 */
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitRaw } from '../lib/face-reader.mjs'
import {
  auditFile,
  parseExports,
  parseImports,
  templateInteriorLines,
  aliasEntries,
  resolveAliasSpec,
  buildAliasIndex,
  KNOWN_ALIAS_LEDGER,
  auditShadowJs,
  probeTypeScriptSyntax,
  literalSpecTarget,
  mergeShadow,
  mergeSites,
} from '../check-dangling-local-imports.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(ROOT, 'scripts/check-dangling-local-imports.mjs')

test('源模块导出可单测的纯函数(§22c 前置条件;D3/D4 那几个必须在列,否则判据只能靠端到端摸)', () => {
  for (const fn of [
    parseImports,
    parseExports,
    auditFile,
    templateInteriorLines,
    aliasEntries,
    resolveAliasSpec,
    buildAliasIndex,
    auditShadowJs,
    probeTypeScriptSyntax,
    literalSpecTarget,
    mergeShadow,
    mergeSites,
  ])
    assert.equal(typeof fn, 'function')
  assert.ok(Array.isArray(KNOWN_ALIAS_LEDGER), 'KNOWN_ALIAS_LEDGER 必须是数组(待偿台账不是豁免清单)')
})

test('D3 装车证明:真 tsconfig 的 glob 列表不得把映射吃掉(正则剥注释的翻车现场)', () => {
  const ts =
    '{\n  "extends": "../tsconfig.base.json",\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },\n  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],\n  "exclude": ["node_modules", ".next*"]\n}'
  const e = aliasEntries('apps/web/tsconfig.json', ts)
  assert.ok(e && e.length === 1, `应当解析出 1 条映射,实得 ${JSON.stringify(e)}`)
  assert.equal(e[0].dir, 'apps/web/src')
  const idx = new Map([['apps/web/src', e]])
  assert.equal(
    resolveAliasSpec('apps/web/src/a/b.ts', '@/stores/x', idx),
    'apps/web/src/stores/x',
    '别名必须映射到包内真实前缀(不是把 @/ 当相对路径,也不是判不了就放过)',
  )
  assert.equal(resolveAliasSpec('apps/web/src/a/b.ts', 'react/jsx-runtime', idx), null)
  assert.equal(resolveAliasSpec('packages/app/src/a.ts', '@/stores/x', idx), null, '别的包没有该映射 ⇒ 不猜')
})

test('D1 正反成对:导入不存在的名字必拦,存在必放行', () => {
  const files = {
    'x/i.ts': "import { Ghost } from './b'",
    'x/b.ts': 'export const Real = 1',
  }
  const read = (p) => files[p] ?? null
  const has = (p) => p in files
  assert.equal(auditFile('x/i.ts', read, has).filter((v) => v.rule === 'D1').length, 1)
  files['x/b.ts'] = 'export const Real = 1\nexport const Ghost = 2'
  assert.equal(auditFile('x/i.ts', read, has).filter((v) => v.rule === 'D1').length, 0)
})

test('目录不得被当成模块读(首版把 ui-react 17 处具名导入全判成悬空)', () => {
  const files = { 'x/i.ts': "import { A } from './bar'", 'x/bar/index.ts': 'export const A = 1' }
  const read = (p) => files[p] ?? null
  // 目录 `x/bar` 在磁盘上"存在"但读不出内容 —— 必须走 index.ts 而不是把目录当目标
  const v = auditFile('x/i.ts', read, (p) => p in files || p === 'x/bar')
  assert.equal(v.length, 0, `应经 index.ts 解析,实际:${JSON.stringify(v)}`)
})

test('装车证明:guardian-runner 里 id 98 必须存在、blocking、只出现一次', () => {
  const src = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const hits = [...src.matchAll(/id: '98'/g)]
  assert.equal(hits.length, 1, `id 98 出现 ${hits.length} 次(重复登记即撞号)`)
  const block = src.slice(hits[0].index, hits[0].index + 900)
  assert.match(block, /script: 'check-dangling-local-imports\.mjs'/)
  assert.match(block, /mode: 'blocking'/)
  assert.match(block, /skipEnv: 'HUSKY_SKIP_DANGLING_IMPORTS'/)
})

/** 一次全量审计喂两条端到端判据(每次跑约 20s,不该跑到第二条时再跑一遍)。
 *  ⚠️ 退出码必须一起交出:HEAD 上只要有任何一处存量红,execFileSync 就抛,而报告里那几行
 *  计数在抛之前已经打印完了 —— 把"别人欠的账"和"我这维没上岗"混成一条失败,是这一族测试
 *  最常见的自欺形态。 */
let GUARD_RUN
function runGuard() {
  if (!GUARD_RUN) {
    try {
      GUARD_RUN = {
        rc: 0,
        out: execFileSync(process.execPath, [GUARD], {
          cwd: ROOT,
          encoding: 'utf8',
          windowsHide: true,
          maxBuffer: 128 << 20,
          timeout: 420000,
        }),
      }
    } catch (e) {
      GUARD_RUN = { rc: e.status ?? 1, out: String(e.stdout || '') }
    }
  }
  return GUARD_RUN
}

test('真仓 HEAD:D1/D2 必须为 0,D3 只能是已登记的 G-195 那一处(多一处就是有人又提交了半成品)', () => {
  const { rc, out } = runGuard()
  if (rc !== 0) {
    //  exit 1 时也要把"到底是哪几处"报出来 —— 只说"失败了"等于没有哨兵
    const back = [...out.matchAll(/^   (\S+):\d+ \[(D\d)\] (.+?)  →/gm)]
    assert.fail(
      `HEAD 上出现 ${back.length} 处未登记的悬空具名导入(rc=${rc}):\n` +
        back.map(([, f, r, raw]) => `     ${f} [${r}] ${raw}`).join('\n'),
    )
  }
  assert.match(out, /内容口径:HEAD 内容/)
  assert.match(out, /新增 0 文件/)
  const found = [...out.matchAll(/(\S+\.[\w.]+(?:tsx|ts|jsx|js|mjs|cjs)):(\d+) \[(D\d)\] (\S+)/g)].map(
    (m) => ({ file: m[1], line: m[2], rule: m[3], spec: m[4] }),
  )
  const d12 = found.filter((v) => v.rule !== 'D3')
  assert.equal(d12.length, 0, `D1/D2 存量已于 2026-09-24 清零,又出现说明合并把修复吞了:${JSON.stringify(d12)}`)
  // 别名表若整体失效(读不到 tsconfig ⇒ 索引为空),"0 处"是假的绿 —— 所以先验尺子本身在岗。
  const m = /生效映射 (\d+) 个包目录/.exec(out)
  assert.ok(m && Number(m[1]) > 0, `别名表空 ⇒ D3 根本没上岗,报告里的"0 处"不成立:${out}`)
  // D3 允许出现的唯一形态:在待偿台账里(= G-195 那处已知半成品)。多出一处就说明
  // 有人又把"消费者入库、被调用方没写"提交进了 HEAD —— 那正是本判据要拦的东西。
  for (const v of found.filter((x) => x.rule === 'D3'))
    assert.ok(
      KNOWN_ALIAS_LEDGER.includes(`${v.file}|${v.spec}`),
      `未登记的 D3 悬空别名导入:${v.file}:${v.line} ${v.spec} —— 修它,或按 G-195 的格式登记并说明为什么不能现在修`,
    )
})

/**
 * 直接锁"反引号只由词法状态决定"这条判据。
 *
 * 为什么光有上面那条端到端零容忍不够:全树扫到 1 处假红要靠人跑去复现,而这两型字面量
 * 在仓库里就 6 行(门 119 的 5 行字符字面量 + 门 91:403 的 1 行正则)—— 谁把扫描器退回
 * "数一行反引号奇偶",本测试立即点名,而不是等下一个无关提交被钉红。
 * G-177 的起因正是这个:奇偶法把 check-theme-prop-wiring.mjs 后 500 多行整体反档,
 * 于是夹具模板里拼出来的 `import … from '../components/Carousel'` 被判成真导入 → D2 恒红。
 */
test('反引号在字符字面量/正则字面量里都不得翻转模板状态(真仓 G-177 的两型)', () => {
  // 型 ①:反引号作为字符常量参与语法扫描(真门 119 就是这个写法,5 行)
  const CHAR_LIKE = ['const q = "`"', "import { Ghost } from './b'", 'export const Ghost = 1'].join('\n')
  // 型 ②:反引号在正则字面量里(真门 91:403 就是这个写法)
  const RE_LIKE = ['const re = /^(?:\'|"|`)(light|dark)(?:\'|"|`)$/', "import { Ghost } from './b'"].join('\n')
  for (const [name, text] of [
    ['字符字面量', CHAR_LIKE],
    ['正则字面量', RE_LIKE],
  ]) {
    const inside = templateInteriorLines(text)
    assert.equal(inside.length, text.split('\n').length, '逐行标记必须与行数等长(短一节 = 有行没被扫到)')
    assert.equal(
      inside.slice(1).some(Boolean),
      false,
      `${name}里的反引号被当成了模板定界符(奇偶法必错在这一型)`,
    )
    assert.equal(auditFile('p/i.ts', (p) => (p === 'p/i.ts' ? text : 'export const Ghost = 1'), () => true).length, 0, `${name}型不得产出假红`)
  }
  // 反向对照:真模板体内的行仍须判"在模板内" —— 否则本判据是恒 false 的空壳
  // (端到端那条零容忍恰好会因此变绿,所以这条必须单独钉)
  const REAL_TPL = ['const a = `', "import { Ghost } from './b'", 'x`'].join('\n')
  assert.deepEqual(
    templateInteriorLines(REAL_TPL),
    [false, true, true],
    '模板起始行不在内、纯内容行在内、闭合行仍算在内(闭合符本身才把它关上)',
  )
})

/**
 * D4 的**承重证明**:判据必须认出当年那枚真的把生产 API 打崩了约 2.5 小时的文件。
 *
 * 为什么不用夹具:§22c 那条"镜像测试只复读实现就是复读机"讲的正是这一型 —— 自己造的 `x.js`
 * 只能证明"实现按自己的理解会红",证明不了它能吃掉真仓实际产出的形态。所以这里把
 * `6bf657df86^` 那三(blob:影子 .js、被遮蔽的 .ts、真实的消费方)**逐字**喂同一判据。
 * 反向对照取修复后的 HEAD 同名两文件:同一份消费方代码,修好后不再产出候选。
 */
test('D4 真仓历史 blob 阳性对照:6bf657df86^ 那枚影子 .js 必须被点名(夹具不算证明)', () => {
  const PRE = '6bf657df86^'
  const SHADOW = 'apps/api/src/services/user-concurrency-service.js'
  const REAL_TS = 'apps/api/src/services/user-concurrency-service.ts'
  const CONSUMER = 'apps/api/src/routes/v1-public.ts'
  const show = (rev, p) => gitRaw(['show', `${rev}:${p}`], ROOT, { timeout: 120000 })
  const jsBlob = show(PRE, SHADOW)
  const tsBlob = show(PRE, REAL_TS)
  const consumerBlob = show(PRE, CONSUMER)
  // 先验夹具本身:**这**才是当年那个形状,而不是我记忆里的那个形状。
  assert.match(jsBlob, /new Map<string, number>/, '历史 blob 取样取错了(探针无从谈起)')
  assert.match(consumerBlob, /from '\.\.\/services\/user-concurrency-service\.js'/, '消费方不是那一条')
  assert.ok(jsBlob !== tsBlob, '两份内容必须不同 —— 相同就不是"遮蔽",而是"重复登记"')

  const files = { [SHADOW]: jsBlob, [REAL_TS]: tsBlob, [CONSUMER]: consumerBlob }
  const read = (p) => files[p] ?? null
  const sites = []
  const v = auditFile(CONSUMER, read, (p) => p in files, new Map(), sites)
  const found = sites.filter((s) => s.target === SHADOW)
  assert.ok(found.length >= 1, `同一遍解析必须把这条 '.js' 说明符的字面目标递出来,实得 ${JSON.stringify(sites)}`)
  // 同一条 import 在旧射程里也算 D1(被解析器挑中的 .ts 确实没导出那个名字)——
  // 这一格要说清:D1 看得见"导出缺",但**看不见遮蔽这件事本身**,所以才需要 D4。
  assert.ok(v.some((x) => x.rule === 'D1'), '历史那处同时是 D1(说明符按 TS 口径指 .ts)')

  const shadow = auditShadowJs(read, sites, new Set([SHADOW, REAL_TS]))
  assert.equal(shadow.byShadow.size, 1, `历史形态必须判 1 处影子,实得 ${[...shadow.byShadow.keys()]}`)
  const [hit] = shadow.byShadow.get(SHADOW)
  assert.equal(hit.rule, 'D4')
  assert.match(hit.hint, /遮蔽/, '必须点名"同名 .ts 被字面 .js 遮蔽"这一维')
  assert.match(hit.hint, /TS 专有语法/, '必须点名"这 .js 是穿了马甲的 TS"这一维')
  assert.ok(hit.hint.includes(CONSUMER), '必须点名消费方,否则无人能就地修')
  assert.ok(hit.line > 0 && hit.line <= jsBlob.split('\n').length, '命中行必须是该 .js 内的真实行号')

  // 反向对照:修复后的 HEAD 只剩 .ts ⇒ 同一判据不再产出候选(尺子没有把"约定写法"一律判红)
  const fixedJs = readFileSync(join(ROOT, SHADOW.replace(/\.js$/, '.ts')), 'utf8')
  const fixedSites = []
  auditFile(CONSUMER, (p) => (p === REAL_TS ? fixedJs : null), () => false, new Map(), fixedSites)
  const after = auditShadowJs((p) => (p === REAL_TS ? fixedJs : null), fixedSites, new Set([REAL_TS]))
  assert.equal(after.byShadow.size, 0, '修好后不得再判红')
  assert.equal(after.targeted, 0, '那个 .js 已不在库 ⇒ 连"字面命中"都不该成立(有向存在性判据)')
})

test('D4 端到端计数行:字面命中必须 > 0 而判红候选 = 0(把"没扫到"与"扫过且干净"分开)', () => {
  const { out } = runGuard()
  const m =
    /D4 影子 \.js:被 '\.js' 说明符字面命中的入库 \.js (\d+) 个 \| 判红候选 (\d+) 个 \| 只报数\(同名对无人指向\)(\d+) 个/.exec(
      out,
    )
  assert.ok(m, `报告缺 D4 计数行 ⇒ 这一维没上岗:${out.slice(0, 400)}`)
  assert.ok(Number(m[1]) > 0, `字面命中 0 个 ⇒ 采集通道没吃到真数据,那句"候选 0"不作数:${out}`)
  assert.equal(Number(m[2]), 0, `HEAD 上出现 ${m[2]} 个影子 .js ⇒ 有人把 .ts 的实现写进了同名 .js`)
  assert.ok(!/D4 未判定/.test(out), `D4 未判定必须清零后只在个别场合点名,不能常态挂着:${out}`)
})

/**
 * 三条形状锁,钉的是"这一维换个人来改就会悄悄失效"的那三格:
 *  ① D4 不许自带第二台 import 解析器(两遍解析必给两个"谁 import 了谁"的口径);
 *  ② 内容只能走取材层 —— 默认面不得新增磁盘读(`readFileSync(` 在本文件里只许有 FILES_MODE
 *     那一个逃生舱调用点);这条是守门 118 对本门分类的最低要求,写在这里是因为 118 只在
 *     "本次改动动过这道门"时才判,而这条约束应当无条件成立。
 *  ③ 只报数那一族不得被顺手折进判红面(判红与报名是两个出口)。
 */
test('D4 形状锁:不得有第二台解析器 / 不得新增磁盘读 / 只报数不折进判红', () => {
  const src = readFileSync(GUARD, 'utf8')
  const body = /export function auditShadowJs\([\s\S]*?\n}\n/.exec(src)
  assert.ok(body, 'auditShadowJs 必须仍是顶层导出的那一块(拆进别处就要重新配对账)')
  assert.ok(!/parseImports\(/.test(body[0]), 'D4 里又开了一遍 import 解析 ⇒ 两遍解析必然口径分叉')
  assert.equal(
    (src.match(/readFileSync\(/g) || []).length,
    1,
    '默认面新增了磁盘读(唯一合法的一处在 --files 逃生舱里)⇒ 本门会被守门 118 判成按磁盘判',
  )
  assert.match(src, /jsSink\.push\(/, '落点必须由 auditFile 在同一遍解析里递出')
  assert.match(src, /mergeShadow\(byPending, shadowPending\)/, 'D4 必须并进同一张违规表(锚点/打印/退出码只一套)')
  // ③ 构造面:只报数的那一族进 deadPairs、不进 byShadow
  const files = { 'z/x.ts': 'export const A = 1', 'z/x.js': 'export const A = 1' }
  const s = auditShadowJs((p) => files[p] ?? null, [], new Set(Object.keys(files)))
  assert.equal(s.byShadow.size, 0)
  assert.deepEqual(s.deadPairs, ['z/x.js'], '无人指向的同名对必须报名,而不是静默也不静默红')
  // mergeSites:同一处消费方在两面上各记一次 ⇒ 计数虚高,会把无关提交顶过它自己的锚点
  const base = [
    { target: 'z/x.js', by: 'z/i.ts', line: 1 },
    { target: 'z/x.js', by: 'z/j.ts', line: 2 },
  ]
  assert.deepEqual(mergeSites(base, [{ target: 'z/x.js', by: 'z/i.ts', line: 9 }], new Set(['z/i.ts'])), [
    { target: 'z/x.js', by: 'z/j.ts', line: 2 },
    { target: 'z/x.js', by: 'z/i.ts', line: 9 },
  ])
  // 探针与遮罩:同一形状只写在注释里必须一律不命中(门读自己的解释文字 = 本仓最高频失效型)
  assert.ok(probeTypeScriptSyntax('const m = new Map<string, number>()').length > 0)
  assert.deepEqual(probeTypeScriptSyntax('// const m = new Map<string, number>()\nexport const k = 1'), [])
  assert.deepEqual(probeTypeScriptSyntax('const s = "new Map<string, number>()"\nexport const k = 1'), [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
