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
  d4ChannelBlind,
  probeTypeScriptSyntax,
  literalSpecTarget,
  mergeShadow,
  mergeSites,
  SELF_SKIP as GATE_SKIP_ENV,
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
    d4ChannelBlind,
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
        // stdio 三元组**不是可选的**:缺它时本机 spawn 恒 `EBUSY`(errno -4082,status=null,
        // stdout 空),而本文件下面两条 catch 只取 e.stdout ⇒ 报成"报告缺 D4 计数行"/"rc=1 但
        // 0 处未登记",即**尺子被环境故障伪装成判红**。门体自检里的 run() 早就写了这三行,
        // 同一个仓库两处 spawn 一处写一处不写,漂移出来的就是这一族假红(2026-10-03 实测 7 例)。
        out: execFileSync(process.execPath, [GUARD], {
          cwd: ROOT,
          encoding: 'utf8',
          windowsHide: true,
          maxBuffer: 128 << 20,
          timeout: 420000,
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
      }
    } catch (e) {
      GUARD_RUN = { rc: e.status ?? 1, out: String(e.stdout || '') + String(e.stderr || '') }
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

test('D4 端到端计数行:落点必须 > 0 而判红候选 = 0(把"没扫到"与"扫过且干净"分开)', () => {
  const { out } = runGuard()
  // 三数各钉一格,少一格都不行:
  //  · 落点(scanned)= 采集口径 —— 0 ⇒ 门自己 exit 2,这一行压根不会被读到;
  //  · 指向入库 .js(targeted) —— **允许 > 0**(本仓 8 个合规 .js 被字面命中),它不是判据;
  //  · 判红候选 —— HEAD 上必须为 0。
  const m =
    /D4 影子 \.js:扫到的 '\.js' 说明符落点 (\d+) 个 \| 其中指向入库 \.js (\d+) 个 \| 判红候选 (\d+) 个 \| 只报数\(同名对无人指向\)(\d+) 个/.exec(
      out,
    )
  assert.ok(m, `报告缺 D4 计数行 ⇒ 这一维没上岗:${out.slice(0, 400)}`)
  assert.ok(Number(m[1]) > 0, `落点 0 个 ⇒ 采集通道没吃到真数据,那句"候选 0"不作数:${out}`)
  assert.ok(Number(m[2]) > 0, `指向入库 .js 为 0 ⇒ 这一维在真仓上没碰到任何真实面(本仓应有 8 个):${out}`)
  assert.equal(Number(m[3]), 0, `HEAD 上出现 ${m[3]} 个影子 .js ⇒ 有人把 .ts 的实现写进了同名 .js`)
  assert.ok(!/D4 未判定/.test(out), `D4 未判定必须清零后只在个别场合点名,不能常态挂着:${out}`)
})

/**
 * 票面 G-815915 反假绿①「扫到 0 个候选判死不记绿」的**成对**证明。
 *
 * 为什么端到端那条不够:全量档的 exit 2 要么触发要么不触发,证明不了"判据本身挑对了口径"。
 * 而这一格的口径正是本票最容易做错的一处 ———
 *   正例:采集通道扫到 **0 个落点** ⇒ 必须判死(`d4ChannelBlind` 为真);
 *   反例:落点扫到 N 个、但其中指向入库 `.js` 的为 **0** ⇒ **不得**判死。
 * 反例这一侧是票面自己写下的状态(「现读覆盖面为 0」),真仓 HEAD 今天就是它(落点 1768 /
 * 指向入库 8,但门必须容忍 `targeted` 为 0 这一格)。把判死挂到 `targeted` 上,尺子会在
 * 票面描述的那个状态下恒红(§12e:唯一结局是各会话绕过钩子、连带废掉链上其余门)。
 */
test('D4 反假绿①:扫到 0 个落点判死,但"落点>0 而入库命中=0"必须放行(成对,防恒红)', () => {
  // 正例:一条 `.js` 说明符都没有 ⇒ 采集通道什么也没递出来
  const blind = auditShadowJs(
    (p) => (p === 'a/i.ts' ? "export const x = 1" : 'export const A = 1'),
    [],
    new Set(['a/i.ts', 'a/b.ts']),
  )
  assert.equal(blind.scanned, 0, '构造面:没有 `.js` 说明符 ⇒ 落点必须真的是 0')
  assert.equal(blind.targeted, 0)
  assert.equal(d4ChannelBlind(blind), true, '扫到 0 个落点 ⇒ 必须判死不记绿')

  // 反例:落点存在(指向未入库的 `.js`,这是本仓 1768 个落点的绝大多数形态)⇒ 尺子看过东西,不得判死
  const seenNotTracked = auditShadowJs(
    (p) => (p === 'a/i.ts' ? "export const x = 1" : null),
    [{ target: 'a/ghost.js', by: 'a/i.ts', line: 1, spec: './ghost.js' }],
    new Set(['a/i.ts']),
  )
  assert.equal(seenNotTracked.scanned, 1, '落点计数在"是否入库"过滤之前 —— 这一格必须被计入')
  assert.equal(seenNotTracked.targeted, 0, '指向未入库 .js ⇒ targeted 仍是 0(这正是票面写的那一格)')
  assert.equal(
    d4ChannelBlind(seenNotTracked),
    false,
    '落点>0 而 targeted=0 ⇒ 不得判死(否则本仓常态被判红,门成恒红门)',
  )

  // 反向对照:门体真跑时这条判死必须真的拦下来(派生一次门体,--files 收窄到没有 .js 说明符的夹具)
  const guardSrc = readFileSync(GUARD, 'utf8')
  assert.match(guardSrc, /d4ChannelBlind\(shadowPending\)/, '判死必须挂在 D4 结果上,不能只定义不用')
  assert.match(guardSrc, /采集通道断链/, '判死那一档必须自报"无法判定",不得静默放过')
})

/**
 * 票面点名的**正反成对**核心档:「错名 `.js` 影子架空 `.ts` 说明符映射」要判红,
 * 而「`.ts` 真在、只是同名 `.js` 也在」**不得误判**。
 *
 * 为什么反例这一侧不可省(它是本票最容易写成恒红门的地方):
 * `.ts` 编译出同名 `.js` 是 TS 项目的**常态**,不是缺陷。判据若把"同名对存在"本身当缺陷,
 * 它就会在每一个正常仓库上判红,而恒红门的唯一结局是各会话开始绕钩子、连带废掉链上其余门
 * (§12e)。所以本门 D4 的两条判红都额外要求"**有 `.js` 说明符字面命中**"这个前提 ——
 * 无人指向的同名对只进 `deadPairs` 报名,不进 `byShadow`。
 *
 * 本例把三格一次锁死,少任何一格都说明尺子退化了:
 *  ① 正例 —— 同名对 + 有 `.js` 说明符指向 ⇒ 判红 1(错名影子架空了 .ts);
 *  ② 反例 —— 同名对 + 无人指向 ⇒ 判红 0 且 `deadPairs` 点名(死重量而非陷阱);
 *  ③ 反例 —— 同名对 + 有指向,但那份 `.js` 是**合法普通 JS**(无 TS 语法)且同 stem 的 `.ts`
 *     是唯一实现 ⇒ 仍判红 1(遮蔽本身就够,不需要"它是穿了马甲的 TS")。
 */
test('D4 正反成对:错名 .js 影子必红,而"影子与实体并存"的两条常态格都不得误判', () => {
  // ① 正例:错名 `.js` 影子架空 `.ts` —— 同名对 + 有 `.js` 说明符字面命中
  const shadowed = auditShadowJs(
    (p) =>
      ({
        's/x.js': 'export const Real = 1',
        's/x.ts': 'export const Real = 1',
        's/i.ts': "import { Real } from './x.js'\nexport const Y = Real",
      })[p] ?? null,
    [{ target: 's/x.js', by: 's/i.ts', line: 1, spec: './x.js' }],
    new Set(['s/x.js', 's/x.ts', 's/i.ts']),
  )
  assert.equal(shadowed.byShadow.size, 1, `错名影子必须判红 1 处,实得 ${[...shadowed.byShadow.keys()]}`)
  assert.equal(shadowed.byShadow.get('s/x.js')[0].rule, 'D4')
  assert.equal(shadowed.deadPairs.length, 0, '有人指向 ⇒ 不得同时进"只报数"(两处各算一次即计数虚高)')

  // ② 反例:同名对在库、无人经 `.js` 指向 —— 影子与实体并存的常态,只报数不判红
  const coexisting = auditShadowJs(
    (p) =>
      ({
        'c/x.js': 'export const Real = 1',
        'c/x.ts': 'export const Real = 1',
        'c/i.ts': "import { Real } from './x'\nexport const Y = Real",
      })[p] ?? null,
    [],
    new Set(['c/x.js', 'c/x.ts', 'c/i.ts']),
  )
  assert.equal(
    coexisting.byShadow.size,
    0,
    '`.ts` 真在、只是同名 `.js` 也在,而无人经 .js 指向 ⇒ 不得误判(编译产物入库是常态,不是缺陷)',
  )
  assert.deepEqual(
    coexisting.deadPairs,
    ['c/x.js'],
    '这一格必须落到 deadPairs 报名 —— 判红与静默都不行,只报数才是正确出口',
  )
  assert.equal(coexisting.scanned, 0, '无人写 `.js` 说明符 ⇒ 采集落点真的是 0(与 ① 的 1 构成对照)')

  // ③ 反例:同名对 + 有指向,但那份 `.js` 是合法普通 JS —— 遮蔽本身即判红,不需要"穿了马甲"
  //    (票面判据 ①:人读到的是 .ts,运行时拿到的是 .js,导出对不对是另一回事)
  const plainJs = auditShadowJs(
    (p) =>
      ({
        'p/x.js': 'const Real = 1\nexport { Real }',
        'p/x.ts': 'export const Real = 1',
        'p/i.ts': "import { Real } from './x.js'\nexport const Y = Real",
      })[p] ?? null,
    [{ target: 'p/x.js', by: 'p/i.ts', line: 1, spec: './x.js' }],
    new Set(['p/x.js', 'p/x.ts', 'p/i.ts']),
  )
  assert.equal(plainJs.byShadow.size, 1, '同名对 + 字面命中 ⇒ 必须判红(与 ② 的差别只在"有无指向")')
  assert.match(plainJs.byShadow.get('p/x.js')[0].hint, /遮蔽/)
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

/** G-815985 `--rev` 的 CLI 端到端(每次派生约 20s,与 runGuard 同量级,故各只跑一次)。
 *  RAP(真实历史锚点对):f3857e05cd 修掉 input-status-slot 引用的两个从未写下的导出 ——
 *  以修后为锚审修前必红且点名那 1 文件,锚点取反必绿。判据只对自己造的夹具有牙等于没有牙。 */
function runRev(args, env) {
  try {
    const out = execFileSync(process.execPath, [GUARD, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 128 << 20,
      timeout: 420000,
      env: env ?? process.env,
      // 与 runGuard 同一口径(见该处注释):缺 stdio ⇒ 本机 spawn 恒 EBUSY,而下面 catch
      // 只取 stdout ⇒ 报成"应 exit 0"之类的假红。两处各写一遍必漂移,故同形。
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { rc: 0, out: String(out) }
  } catch (e) {
    return { rc: e.status ?? 9, out: String(e.stdout || '') + String(e.stderr || '') }
  }
}

test('--rev 审 HEAD 面必须 exit 0 且报出 rev 口径行(装车:门真跑了 --rev 分支)', () => {
  const r = runRev(['--rev', 'HEAD'])
  assert.equal(r.rc, 0, `--rev HEAD 应 exit 0:${r.out.slice(-800)}`)
  assert.match(r.out, /内容口径:--rev HEAD/)
})

test('--rev 假 sha 与面冲突必须 exit 2(无法判定,不是"没违规")', () => {
  const bad = runRev(['--rev', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'])
  assert.equal(bad.rc, 2, `假 rev 应 exit 2:${bad.out.slice(-500)}`)
  const conflict = runRev(['--rev', 'HEAD', '--staged'])
  assert.equal(conflict.rc, 2, `--rev 与 --staged 同给应 exit 2:${conflict.out.slice(-500)}`)
})

test('--rev 在 SELF_SKIP 下仍审计(调用方点名要结论,跳过等于没审)', () => {
  const r = runRev(['--rev', 'HEAD'], { ...process.env, [GATE_SKIP_ENV]: '1' })
  assert.equal(r.rc, 0, `skip 下 --rev 仍应 exit 0:${r.out.slice(-500)}`)
  assert.match(r.out, /内容口径:--rev/)
  assert.ok(!r.out.includes('已跳过'), 'skip 行一旦出现,等于门对自己立项那一型失明')
})

test('--rev 真历史阳性对照:修前 vs 修后锚点必红且点名 input-status-slot.tsx', () => {
  const r = runRev(['--rev', 'f3857e05cd^', '--anchor', 'f3857e05cd'])
  assert.equal(r.rc, 1, `应 exit 1:${r.out.slice(-800)}`)
  assert.match(r.out, /input-status-slot\.tsx/)
})

test('--rev 锚点方向反了必须绿(锚点错了尺子要安静,而不是反咬)', () => {
  const r = runRev(['--rev', 'f3857e05cd', '--anchor', 'f3857e05cd^'])
  assert.equal(r.rc, 0, `应 exit 0:${r.out.slice(-800)}`)
})

test('--rev 接线形状锁:revMain 不得被摘,SELF_SKIP 忽略必须有注释凭据', () => {
  const src = readFileSync(GUARD, 'utf8')
  assert.match(src, /async function revMain\(rev, anchorOpt/)
  assert.match(src, /indexOf\('--rev'\)/)
  assert.match(src, /SELF_SKIP.*在这一档不吃|在这一档不吃.*SELF_SKIP/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
