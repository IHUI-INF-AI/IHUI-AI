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
 *  5. (2026-10-19 补)D5「barrel 同名导出重复」四格成对 + 真仓历史 blob(2225fccfdb8)阳性对照 ——
 *     这枚重复四次复发、最近一次正是 union 合并两侧都收,防回灌必须钉在提交口与审面两道。
 *  6. (2026-10-22 补,票面 G-13)D6「错名 .js 影子架空 .ts 说明符映射」夹具正反成对 + 端到端计数行 ——
 *     同名并存对必报(不管有没有人指向),而 ./x.js→x.ts 的正常约定拼法、JS 侧字面导入与 .d.ts 声明
 *     同伴三型不得误报(误报 = 恒红门,§12e)。
 *  7. (2026-11-01 补,票面 G-815915)D6 的**两型各有真仓历史阳性对照**:型② 走"只喂正文"(c 独立有牙),
 *     型① 走"同一棵树的 ls-tree 全量清单 + 真实三 blob"(a 不是只认夹具);两型都拿当年那枚
 *     `user-concurrency-service.js` 量,读数必须与门体 `--rev 6bf657df86^` 的计数行同源。
 */
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
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
  auditTree,
  auditDuplicateBarrelExports,
  auditNamespaceAggregator,
  d7ChannelBlind,
  D5_BARREL_RE,
  __test__ as D6KIT,
  SELF_SKIP as GATE_SKIP_ENV,
} from '../check-dangling-local-imports.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(ROOT, 'scripts/check-dangling-local-imports.mjs')

test('源模块导出可单测的纯函数(§22c 前置条件;D3/D4/D5 那几个必须在列,否则判据只能靠端到端摸)', () => {
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
    auditTree,
    auditDuplicateBarrelExports,
    auditNamespaceAggregator,
    d7ChannelBlind,
  ])
    assert.equal(typeof fn, 'function')
  assert.ok(Array.isArray(KNOWN_ALIAS_LEDGER), 'KNOWN_ALIAS_LEDGER 必须是数组(待偿台账不是豁免清单)')
  assert.ok(D5_BARREL_RE instanceof RegExp, 'D5 射程封闭集合必须是导出的正则(镜像测试不许另抄一份)')
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

/**
 * D4 端到端计数行断言的**唯一实现**(本文件两条测试与变异自证共用它,§0.6 单一真相源,
 * 任何外部器物要复核这一格必须 import 本函数,不得另抄一份判据)。
 *
 * 〔2026-10-26 改判:数值下限有牙 → 形态有牙〕旧版把 `targeted > 0(本仓应有 8 个)` 钉成
 * 硬下限,而门体两处注释(auditShadowJs 的 `scanned` 段、d4ChannelBlind 的"方向刻意是只认
 * 采集口径、不认 targeted"段)都明写 **targeted === 0 是本仓常态而不是尺子失效** —— 那 8 枚
 * 属"只报数"维度,不是判红维度。日后这些合规 `.js` 被合法移除,旧断言就会假红(测试红 = 挡
 * 全仓落地,§12e 同型只是从门面挪到了测试面)。故现在钉的是:
 *  · 计数行**存在**且四字段齐备、逐枚为数字串(形态牙);
 *  · 落点(scanned)> 0 —— 这是真判据(采集口径,门体据此 exit 2,与成对夹具档互证);
 *  · 判红候选 = 0 —— HEAD 面零容忍(真判据);
 *  · "D4 未判定"不得常态挂着(真判据);
 *  · targeted / deadPairs 的**数值**只报数(>= 0 且形态正确即可,不再挂下限)。
 */
function assertD4CountLine(out) {
  const m =
    /D4 影子 \.js:扫到的 '\.js' 说明符落点 (\d+) 个 \| 其中指向入库 \.js (\d+) 个 \| 判红候选 (\d+) 个 \| 只报数\(同名对无人指向\)(\d+) 个/.exec(
      out,
    )
  assert.ok(m, `报告缺 D4 计数行 ⇒ 这一维没上岗:${out.slice(0, 400)}`)
  // 形态牙:四个字段逐枚必须是数字串(行在而字段缺/形态坏,同样算这一维没上岗)
  for (const [i, name] of [
    [1, '落点(scanned)'],
    [2, '指向入库 .js(targeted,只报数)'],
    [3, '判红候选'],
    [4, '只报数同名对'],
  ])
    assert.match(String(m[i] ?? ''), /^\d+$/, `D4 计数行字段「${name}」缺失或非数字形态 ⇒ 计数行形状坏了`)
  assert.ok(Number(m[1]) > 0, `落点 0 个 ⇒ 采集通道没吃到真数据,那句"候选 0"不作数:${out}`)
  assert.ok(Number(m[2]) >= 0, `targeted 必须是可解析的非负数(数值本身只报数,不是判据)`)
  assert.ok(Number(m[4]) >= 0, `只报数同名对必须是可解析的非负数(数值本身只报数,不是判据)`)
  assert.equal(Number(m[3]), 0, `HEAD 上出现 ${m[3]} 个影子 .js ⇒ 有人把 .ts 的实现写进了同名 .js`)
  assert.ok(!/D4 未判定/.test(out), `D4 未判定必须清零后只在个别场合点名,不能常态挂着:${out}`)
  return { scanned: Number(m[1]), targeted: Number(m[2]), candidates: Number(m[3]), reportOnly: Number(m[4]) }
}

test('D4 端到端计数行:行在且四字段齐 / 落点 > 0 / 判红候选 = 0;targeted 数值只报数(2026-10-26 改判)', () => {
  const { out } = runGuard()
  // 现读报数留痕(只报数,不挂下限):targeted 变 0 不得让本测试翻红 —— 由下面变异②机器自证
  console.log('   D4 计数行现读:', JSON.stringify(assertD4CountLine(out)))
})

/**
 * 变异自证(2026-10-26,改判的承重证明):断言的牙必须在"形态"上,不能靠一次性读数。
 * 两型都在**同一条缓存的门体输出**上做字符串变异,零额外全量扫描:
 *  变异①:把 D4 计数行整条摘掉 ⇒ assertD4CountLine 必须抛(测试翻红 —— "缺行=没上岗"有牙);
 *  变异②:把 targeted 读数改成 0 ⇒ 必须不抛(它不是判据 —— 旧的 `> 0` 下限正是这里会假红的牙)。
 * 反向防呆:夹具本身若摘不到行/改不到数(正则烂了)也当场判失败,变异自证不许是空转。
 */
test('D4 计数行断言变异自证:摘行必翻红 / targeted 归零必不红(形态有牙,数值只报数)', () => {
  const { out } = runGuard()
  assert.doesNotThrow(() => assertD4CountLine(out), '基准面:真报告必须先过(否则下面两型都是空转)')
  // 变异①:整行摘除
  const noLine = out.replace(/^.*D4 影子 \.js:.*\n?/m, '')
  assert.ok(noLine.length < out.length, '夹具失效:没摘到 D4 计数行(行形态漂了,先修正则再谈判据)')
  assert.throws(() => assertD4CountLine(noLine), /缺 D4 计数行/, '摘掉计数行必须翻红 ⇒ 这一维"没上岗"要有牙')
  // 变异②:targeted 读数 → 0(其余字段原样;用回调拼接,避免 '$10$2' 被解析成组 10 的字面量)
  const zeroed = out.replace(/(其中指向入库 \.js )\d+( 个)/, (_, a, b) => `${a}0${b}`)
  assert.match(zeroed, /其中指向入库 \.js 0 个/, '夹具失效:没把 targeted 改成 0')
  assert.doesNotThrow(() => assertD4CountLine(zeroed), 'targeted=0 是门体明写的常态 ⇒ 断言不得为此翻红(假红=挡全仓落地)')
  // 变异③:只报数字段(deadPairs)读数 → 0 同样不得翻红 —— "只报数"一族整族无数值下限
  const zeroDead = zeroed.replace(/(只报数\(同名对无人指向\))\d+( 个)/, (_, a, b) => `${a}0${b}`)
  assert.match(zeroDead, /只报数\(同名对无人指向\)0 个/, '夹具失效:没把只报数改成 0')
  assert.doesNotThrow(() => assertD4CountLine(zeroDead), '只报数维不得挂数值下限')
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
 *  ② 内容只能走取材层 —— 默认面不得新增**被审内容**的磁盘读。`readFileSync(` 在本文件里只许有
 *     两处,且各自的**身份**都被点名钉死:一处在 FILES_MODE 那个人工逃生舱里(读被审内容),
 *     一处只许读 `join(root, SHADOW_EXEMPTION_LEDGER)`(D6-c 的具名豁免台账 = **配置面**,与守门
 *     213/225 的具名台账同一条口径,AGENTS.md §0.4 管的是"被审内容取哪个面",不含配置面)。
 *     2026-11-01 本锁第一次翻红就是这一格:它把"配置面读一次"误记成"新增磁盘读",而 2026-11-01 的
 *     装车没同步它 ⇒ 镜像在 HEAD 面长红。修法不是把 1 改成 2 放行,而是**分开数**:被审内容的读取
 *     仍恰为一处(再加一处即翻红),台账读取也恰为一处(两处各读一遍必漂,§0.6)。
 *  ③ 只报数那一族不得被顺手折进判红面(判红与报名是两个出口)。
 */
test('D4 形状锁:不得有第二台解析器 / 不得新增磁盘读 / 只报数不折进判红', () => {
  const src = readFileSync(GUARD, 'utf8')
  const body = /export function auditShadowJs\([\s\S]*?\n}\n/.exec(src)
  assert.ok(body, 'auditShadowJs 必须仍是顶层导出的那一块(拆进别处就要重新配对账)')
  assert.ok(!/parseImports\(/.test(body[0]), 'D4 里又开了一遍 import 解析 ⇒ 两遍解析必然口径分叉')
  const allReads = (src.match(/readFileSync\(/g) || []).length
  const ledgerReads = (src.match(/readFileSync\(join\(root, SHADOW_EXEMPTION_LEDGER\)/g) || []).length
  assert.equal(ledgerReads, 1, 'D6-c 的具名豁免台账(配置面)只许有一处读取 —— 两处各读一遍必漂(§0.6)')
  assert.equal(
    allReads - ledgerReads,
    1,
    `默认面新增了**被审内容**的磁盘读(唯一合法的一处在 --files 逃生舱里),实得内容读 ${allReads - ledgerReads} 处` +
      ' ⇒ 本门会被守门 118 判成按磁盘判',
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

/**
 * D5「同一 barrel 文件内同名显式导出重复」(2026-10-19 立)。
 * 成对钉死票面要求的四格 + 两格防恒红:
 *  ① 阳性:同名 type 转导出两份必拦(`packages/api-client/src/index.ts` 的 FormRequestEvent 事故原形);
 *  ② 反向:只出现一份必绿;
 *  ③ `export *` 重叠 ⇒ **判不出也不得冒红**,更不许装看得见(头注如实写明不在射程,§0.9);
 *  ④ 内容取不到 ⇒ null(未判定;CLI 档折成 exit 2,由形状锁钉);
 *  ⑤/⑥ 合法 TS 声明合并(interface×2、interface+class)与跨声明空间同名(type 别名+const)
 *     **不得误判** —— 判它们红就是逼 --no-verify(§12e)。
 */
const BARREL = 'packages/api-client/src/index.ts'
test('D5 夹具正反成对:双份必拦 / 单份必绿 / export * 判不出不冒红 / 取不到判未判定 / 合法合并不误判', () => {
  const dup = auditDuplicateBarrelExports(BARREL, "export type { FormRequestEvent } from './client.js'\nconst k = 1\nexport type { FormRequestEvent } from './client.js'\n")
  assert.equal(dup.length, 1, `同名 type 转导出两份必须报 1,实得 ${JSON.stringify(dup)}`)
  assert.equal(dup[0].rule, 'D5')
  assert.match(dup[0].raw, /FormRequestEvent\(type 档,第 1 \/ 3 行共 2 次\)/, '必须点名两处的真实行号(修法要在现场找)')
  // ② 反向:同内容只一份 ⇒ 绿(与本席现读的 HEAD 面同形)
  assert.deepEqual(auditDuplicateBarrelExports(BARREL, "export type { A } from './c'\nconst k = 1\n"), [])
  // ③ export * 重叠:判据结构性看不见 ⇒ 候选 0(若哪天有人把它"补成有牙",只能是对 * 的目标枚举,
  //    而不是在这里把重叠假装有牙 —— 这一格钉的是"没判不许写成判过")
  assert.deepEqual(auditDuplicateBarrelExports('packages/x/src/index.ts', "export * from './b'\nexport * from './c'\n"), [])
  // ④ 取不到 ⇒ null:既不记绿([])也不冒红([{...}])
  assert.equal(auditDuplicateBarrelExports(BARREL, null), null)
  assert.equal(auditDuplicateBarrelExports(BARREL, undefined), null)
  // ⑤ 同名 interface 互相合并、interface+class 合并 —— 全部合法 TS,不得判红
  assert.deepEqual(
    auditDuplicateBarrelExports(BARREL, 'export interface A { a: number }\nexport interface A { b: number }\nexport class A {}'),
    [],
    'interface/class 声明合并被误判 ⇒ 门在合法代码上恒红(§12e)',
  )
  // ⑥ 跨声明空间同名(type 别名 + 同名 const)合法,不判
  assert.deepEqual(auditDuplicateBarrelExports(BARREL, 'export type A = 1\nexport const A = 2'), [])
  // value 档重复与多行名单形态也必须有牙
  assert.equal(auditDuplicateBarrelExports(BARREL, 'export const A = 1\nexport const A = 2').length, 1)
  assert.equal(
    auditDuplicateBarrelExports(BARREL, "export {\n  A,\n  B,\n} from './c'\nexport { A } from './d'\n").length,
    1,
    '多行 export 名单是事故的真实形态,漏它等于门对自己立项的形状失明',
  )
  // 注释里的 export 不算导出(门不得读自己的解释文字)
  assert.deepEqual(auditDuplicateBarrelExports(BARREL, "// export type { A } from './c'\nexport type { A } from './c'\n"), [])
  // 射程边界:同内容出现在非 barrel 文件 ⇒ 不判(封闭集合外)
  assert.deepEqual(auditDuplicateBarrelExports('packages/api-client/src/client.ts', 'export const A = 1\nexport const A = 2'), [])
})

/**
 * D5 的**真仓历史 blob 阳性对照**(§22c:只对自己造的夹具有牙等于没有牙)。
 * 2225fccfdb8 那枚"文件面零丢失 union"合并把两侧各自补的条目**都**收了 ⇒ 该面必须被点名;
 * 修复后的 HEAD 面必须干净。这是"单纯删一行必然第五次复发"的机器 proof:再出现同型,
 * 提交口(--staged 棘轮)与落地审面(--rev)两道都会拦。
 */
test('D5 真仓历史对照:2225fccfdb8 那份 union 重复必须被点名,修后 HEAD 面必须干净', () => {
  const show = (rev) => gitRaw(['show', `${rev}:${BARREL}`], ROOT, { timeout: 120000 })
  const merged = show('2225fccfdb8')
  const now = show('HEAD')
  assert.equal((merged.match(/^export type \{ FormRequestEvent \}/gm) || []).length, 2, '历史取样取错了面')
  const hits = auditDuplicateBarrelExports(BARREL, merged)
  assert.equal(hits.length, 1, `union 合并那份双写必须判 1 处,实得 ${JSON.stringify(hits)}`)
  assert.match(hits[0].raw, /FormRequestEvent/)
  assert.equal((now.match(/^export type \{ FormRequestEvent \}/gm) || []).length, 1, 'HEAD 现读应为一份(本席修复已落)')
  assert.deepEqual(auditDuplicateBarrelExports(BARREL, now), [], '修后 HEAD 面不得判红(反向对照)')
})

/**
 * D5 的接线形状锁 —— 判据造好却没接进 auditTree / 未判定没接进 exit 2,都等于没有
 * (守门 89 R4 同型:已接线才叫在;这里钉的是"判据与取材在同一张表、同一套退出码"）。
 */
test('D5 接线形状锁:违规进 auditTree 同一张表 / 未判定进 sink 且 CLI 判死 exit 2', () => {
  const sink = []
  const byFile = auditTree(
    (p) => (p === BARREL ? 'export type { A } from "./c"\nexport type { A } from "./c"' : null),
    [BARREL],
    () => true,
    new Map(),
    null,
    sink,
  )
  assert.ok((byFile.get(BARREL) || []).some((v) => v.rule === 'D5'), 'D5 必须并进 auditTree 的违规表(锚点/打印/退出码只一套)')
  assert.equal(sink.length, 0)
  const sink2 = []
  assert.equal(auditTree(() => null, [BARREL], () => false, new Map(), null, sink2).size, 0)
  assert.deepEqual(sink2, [BARREL], '在射程却取不到内容 ⇒ 必须落"未判定"点名,不得被空表洗成通过')
  const src = readFileSync(GUARD, 'utf8')
  assert.match(src, /D5 未判定/, 'CLI 必须逐枚点名未判定的 barrel')
  assert.match(src, /不记绿也不冒红\(§0\.3\),先修取材通道/, 'D5 未判定必须 exit 2 并自报"无法判定"')
  assert.match(src, /d5Unpending\.length\)\s*\{\s*\n\s*console\.log\('❌ 无法判定/, '判死那一档必须真的挂在计数之后(定义了不挂=没有)')
})

/** 端到端:全量档报告里 D5 那一行必须在,且候选/未判定为 0、在射程枚数为现读正数;
 *  两面旗同给必须 exit 2(面只能有一个,§0.4)。 */
test('D5 端到端计数行与两面旗冲突:候选 0 / 未判定 0 / --staged+--files exit 2', () => {
  const { out } = runGuard()
  const m = /D5 barrel 同名导出重复:HEAD 面在射程 (\d+) 枚 \| 判定面候选 (\d+) 处 \| 未判定 (\d+) 枚/.exec(out)
  assert.ok(m, `报告缺 D5 计数行 ⇒ 这一维没上岗:${out.slice(0, 400)}`)
  assert.ok(Number(m[1]) >= 100, `在射程 barrel 只有 ${m[1]} 枚(2026-10-19 现读 195)⇒ 枚举通道断了,"候选 0"不作数`)
  assert.equal(Number(m[2]), 0, `HEAD 面上出现 ${m[2]} 处 barrel 同名导出重复 ⇒ 第五次复发已落到 HEAD`)
  assert.equal(Number(m[3]), 0, '未判定必须为 0(非零时门已 exit 2,走到这里说明口径分叉)')
  const conflict = runRev(['--staged', '--files', 'a.ts'])
  assert.equal(conflict.rc, 2, `--staged 与 --files 同给应 exit 2:${conflict.out.slice(-400)}`)
  assert.match(conflict.out, /面只能有一个/)
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
  // 〔2026-10-19 就地改判:旧档钉的是 /indexOf\('--rev'\)/ —— G-322 把 CLI 取值迁到
  // requireFlagValue 共享出口后手工 indexOf 已不存在,这条自 HEAD 面起就是**存量红**
  // (断言钉的是已消失的写法,不是已消失的接线)。现钉真正承重的两格:--rev 仍走带坏值
  // 拒绝的取值出口,且取值直连 revMain。〕
  assert.match(src, /requireFlagValue\(argv, '--rev'/, "--rev 必须仍走 flag-value 共享出口(坏值不猜默认面)")
  assert.match(src, /if \(REV\) return revMain\(REV, ANCHOR_OPT/, '取值必须直连 revMain(接线不被摘)')
  assert.match(src, /SELF_SKIP.*在这一档不吃|在这一档不吃.*SELF_SKIP/)
})

/**
 * `--root` 换仓三态(2026-10-23,G-929 同型追单;样板 = check-no-warm-border 的 M16)。
 * 立因(现读复现):落地器 object-space-land 的 runDanglingGate 在换仓通道(LAND_ROOT 指别的仓)
 * 用 `--rev <tree> --anchor <head>` 调本门,而门体缺省按脚本位置自推导 ⇒ 在本仓里问一枚
 * 只有目标仓才有的树 ⇒ exit 2 未判定 ⇒ 落地器 fail-closed 拒绝 ⇒ 换仓通道只剩逐例打桩或
 * IHUI_LAND_SKIP_DANGLING_GATE 跳过两条坏出路,这一道门在该通道等于没装。
 * 三例各钉一格:
 *  ① 换仓不失明:真判 D1 且点名(判据与仓根无关);
 *  ② 被审仓根目录不存在 ⇒ 未判定,且拒绝理由必须点名"--root 目录不存在"本身 ——
 *    只钉 rc=2 分不出"校验拒绝"与"静默回落后树问不到",后者正是要禁的 fail-open 形态;
 *  ③ 不给 --root ⇒ 仍按自推导在主仓问(生产缺省行为一字不变的锁)。
 */
test('--root 换仓三态(G-929 同型票):显式仓根真判点名 / 目录不存在 exit 2 点名理由 / 缺省仍自推导', () => {
  const GIT = resolveGitBin() || 'git'
  const git = (dir, args) =>
    execFileSync(
      GIT,
      ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args],
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 },
    )
  const dir = mkScratch('dg-root-')
  try {
    git(dir, ['init', '-q', '-b', 'main'])
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'keep.ts'), 'export const keep = 1\n')
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'base'])
    const anchor = git(dir, ['rev-parse', 'HEAD']).trim()
    // 第二枚提交:app.ts 具名导入一个从未写下的导出 ⇒ 相对锚点必红(锚点面里没有这两枚文件)
    writeFileSync(join(dir, 'src', 'mod.ts'), 'export const real = 1\n')
    writeFileSync(join(dir, 'src', 'app.ts'), "import { real, Ghost } from './mod'\nexport const y = Ghost\n")
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'dangling'])
    const tree = git(dir, ['rev-parse', 'HEAD^{tree}']).trim()
    // ① 正控:--root 指到夹具仓 ⇒ 照常判红且点名(判据不因换仓失明)
    const withRoot = runRev(['--rev', tree, '--anchor', anchor, '--root', dir])
    assert.equal(withRoot.rc, 1, `换仓后必须照常判红(rc=1),实得 rc=${withRoot.rc}:${withRoot.out.slice(0, 300)}`)
    assert.match(withRoot.out, /src\/app\.ts/, '判红必须点名 app.ts(判据没跑起来就不点名)')
    assert.match(withRoot.out, /\[D1\]/, '必须以 D1 规则点名悬空具名导入')
    // ② 反证:--root 指向不存在的目录 ⇒ 未判定,且点名拒绝理由本身(不静默回落)
    const badRoot = runRev(['--rev', tree, '--anchor', anchor, '--root', join(dir, 'no-such-dir')])
    assert.equal(badRoot.rc, 2, `--root 不存在必须 exit 2(未判定),实得 rc=${badRoot.rc} —— 静默回落=把指错仓读成审过了`)
    assert.match(badRoot.out, /目录不存在/, '拒绝理由必须点名"--root 目录不存在"(靠下游树噪声蒙混 = 校验被绕开)')
    // ③ 方向锁:同一棵树不给 --root(缺省按脚本位置在主仓里问)⇒ 仍 exit 2
    const noRoot = runRev(['--rev', tree, '--anchor', anchor])
    assert.equal(noRoot.rc, 2, `不给 --root 必须仍按自推导(夹具仓的树在主仓问不到 ⇒ exit 2),实得 rc=${noRoot.rc} —— 缺省行为被改坏了`)
    // ④ 配对锁(2026-11-01):① 的 rc=1 之所以成立,是因为换仓面「没有这一族台账」按**零豁免**照判;
    //    而"该仓**有**台账但内容坏"仍必须未判定 —— 缺文件与坏文件两态不得并桶,否则"把台账写成
    //    一堆乱码"就成了让这一维静默放行的出路(§0.10:失效方向只能是多要一次说明,不能是多放一次门)。
    mkdirSync(join(dir, 'scripts', 'data'), { recursive: true })
    writeFileSync(join(dir, 'scripts', 'data', 'dangling-shadow-exemptions.json'), '{ 这不是合法台账\n')
    const corruptLedger = runRev(['--rev', tree, '--anchor', anchor, '--root', dir])
    assert.equal(
      corruptLedger.rc,
      2,
      `换仓台账存在但内容坏必须仍 exit 2(未判定),实得 rc=${corruptLedger.rc} —— 与"缺台账=零豁免"并桶即 fail-open`,
    )
    assert.match(corruptLedger.out, /解析失败|形状坏/, '未判定必须点名"台账内容坏",不得静默回落成没有豁免')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

/**
 * D6「错名 .js 影子架空 .ts 说明符映射」(票面 G-13,2026-10-22 立)的夹具正反成对。
 *
 * 钉的是票面点名的两格:同名并存对**必报**(不管有没有人指向 —— D4 把"无人指向"留作只报数,
 * 而把影子放进 HEAD 的那一刻陷阱已经成立),而 `./x.js`→`x.ts` 的正常约定拼法**不得误报**
 * (本仓 1856 个 `.js` 落点的绝大多数是这一型,误报 = 恒红门 = 逼人 --no-verify,§12e)。
 * 三型反例同样不可省:`.js` 侧消费方的字面导入(eslint-config 族真例 6 枚)、`x.js` + `x.d.ts`
 * 单源形态(design-tokens 真例 2 枚)、`.jsx` 同伴(门体现有口径不算)—— 它们与 D4 头注里
 * "把 2 处真合规判成红"记的是同一批边界。
 */
test('D6 夹具正反成对:同名并存必报,./x.js→x.ts 正常解析与 JS 侧字面导入不得误报', () => {
  const { auditWrongNameShadow, mergeWrongName } = D6KIT
  // ① 正例(判据 a):同名对入库、无人经 `.js` 说明符指向 ⇒ 仍报 —— 与 D4 的 deadPairs 恰成对照
  const pair = auditWrongNameShadow([], new Set(['q/x.js', 'q/x.ts', 'q/i.ts']))
  assert.deepEqual(pair.coexist, ['q/x.js'], '同名并存对必须进形态清单')
  assert.equal(pair.byFile.size, 1, '同名并存必须判红 1 处(不管有没有人指向)')
  assert.equal(pair.byFile.get('q/x.js')[0].rule, 'D6')
  // ①' 同伴口径 = 门体现有口径:`.tsx` 算,`.jsx`/`.d.ts` 不算
  assert.equal(auditWrongNameShadow([], new Set(['t/x.js', 't/x.tsx'])).byFile.size, 1, '.tsx 同伴算并存')
  assert.equal(auditWrongNameShadow([], new Set(['d/x.js', 'd/x.d.ts'])).byFile.size, 0, 'x.js + x.d.ts 是已发布包正常形态,不得误判')
  assert.equal(auditWrongNameShadow([], new Set(['j/x.js', 'j/x.jsx'])).byFile.size, 0, '.jsx 不是门体现有口径的同伴,不得误判')
  // ② 反例(票面点名的正常格):库里只有 x.ts,TS 侧写 `./x.js` ⇒ 解析改写成 .ts,不误报
  const normal = auditWrongNameShadow([{ target: 'n/x.js', by: 'n/i.ts', line: 1, spec: './x.js' }], new Set(['n/x.ts', 'n/i.ts']))
  assert.equal(normal.byFile.size, 0, '正常 ./x.js→x.ts 解析不得误报(本仓绝大多数落点是这一型)')
  assert.deepEqual(normal.literalWin, [])
  assert.deepEqual(normal.coexist, [], 'x.js 未入库 ⇒ 不存在并存对(有向存在性判据,与 D4 同口径)')
  // ③ 正例(判据 b):TS 侧 `./x.js` 解析目标就是入库 .js 自身(无同 stem .ts/.tsx/.d.ts)⇒ 报
  const bare = auditWrongNameShadow([{ target: 'b/x.js', by: 'b/i.ts', line: 3, spec: './x.js' }], new Set(['b/x.js', 'b/i.ts']))
  assert.equal(bare.byFile.size, 1, '错名落点必须判红')
  assert.deepEqual(bare.literalWin, ['b/x.js'])
  assert.match(bare.byFile.get('b/x.js')[0].hint, /b\/i\.ts:3/, '必须点名消费方,否则无人能就地修')
  // ④ 反例(JS 侧消费方):eslint-config 族 —— JS 导 JS 是字面导入,没有 .ts 映射可被架空
  const jsSide = auditWrongNameShadow([{ target: 'e/x.js', by: 'e/i.js', line: 1, spec: './x.js' }], new Set(['e/x.js', 'e/i.js']))
  assert.equal(jsSide.byFile.size, 0, 'JS 侧字面导入不得误报(真仓 8 枚合规命中里 6 枚是这一型)')
  // ⑤ 反例(.d.ts 同伴):解析落在声明文件 ⇒ 约定映射仍在岗(真仓 radius/geometry 的形状)
  const decl = auditWrongNameShadow([{ target: 'r/x.js', by: 'r/i.ts', line: 1, spec: './x.js' }], new Set(['r/x.js', 'r/x.d.ts', 'r/i.ts']))
  assert.equal(decl.byFile.size, 0, '.d.ts 声明同伴是本门既有口径的正常形态')
  // ⑥ 判据与形态清单只许走 __test__ 这一份实现(§22c),且违规并进同一张表(锚点/打印/退出码一套语义)
  assert.deepEqual(D6KIT.SHADOW_PARTNERS, ['.ts', '.tsx'], '同伴清单必须从门体取,镜像不得另抄一份')
  const byFile = new Map([['q/x.js', [{ rule: 'D1' }]]])
  mergeWrongName(byFile, pair)
  assert.deepEqual(byFile.get('q/x.js').map((v) => v.rule), ['D1', 'D6'], 'D6 与 D1..D5 同表追加,不顶掉既有违规')
})

/**
 * D6 的端到端计数行(与 D4/D5 同取向):**覆盖面为 0 必须如实报 0,而不是缺行**。
 * 票面现读(2026-10-22):同名并存对 0、TS 侧说明符解析到入库 .js 自身 0 ⇒ 扩这一维不新增恒红面,
 * HEAD 面整门仍 exit 0。缺行 = 这一维没上岗,"判红候选 0"就成了空话(本门别名表那段记的同一型)。
 *
 * 〔2026-11-01 收成一把尺〕本用例原先**自己抄了一条计数行正则**,而 2026-11-01 票面 G-815915 的
 * 型② 把「正文含 TS 专有语法(型②必炸)扫 N 枚命中 M 枚」插进 b 段与「判红候选」之间 ⇒ 抄的那条
 * 当场失配,本用例在 HEAD 面直接翻红(实跑复现:`报告缺 D6 计数行`,而报告里那行明明在)。
 * 这正是 §0.6/§22c 说的"第二份必然漂移",而漂移的表现是**测试红、判据绿** —— 修法是删副本、
 * 委托给本文件唯一的解析实现 `assertD6cCountLine`,不是把抄的那条正则再补一个字段(补完还是两份)。
 */
test('D6 端到端计数行:HEAD 面三判据均 0 且整门 exit 0(覆盖面 0 不变红)', () => {
  const { rc, out } = runGuard()
  assert.equal(rc, 0, `HEAD 面整门应 exit 0,实得 rc=${rc}:${out.slice(-600)}`)
  const n = assertD6cCountLine(out)
  assert.equal(n.coexist, 0, `HEAD 面出现 ${n.coexist} 对同名并存 ⇒ 影子 .js 又进了库(票面现读为 0,零容忍)`)
  assert.equal(n.literalWin, 0, `HEAD 面出现 ${n.literalWin} 处 TS 侧说明符解析到入库 .js 自身 ⇒ 错名映射已被架空`)
  assert.equal(n.candidates, 0, '判红候选必须为 0(非零时门已 exit 1,走到这里说明口径分叉)')
  assert.ok(n.scanned > 0, '型② 射程为 0 枚 ⇒ 这一维没看过东西,那句"命中 0 枚"不作数(assertD6cCountLine 已拦,此行为读数留痕)')
  // 接线形状锁:D6 必须并进全量/staged/files/--rev 四张同一通道,且 __test__ 出口在入口守卫之后(§22d)
  const src = readFileSync(GUARD, 'utf8')
  assert.match(src, /mergeWrongName\(byPending, wnPending\)/, 'D6 必须并进同一张违规表(锚点/打印/退出码只一套)')
  assert.match(src, /mergeWrongName\(byFile, wrongName\)/, '--rev 两面共用 auditOneFace,D6 必须同表接进去')
  const guardPos = src.search(/if \(isDirectRun\)/)
  const kitPos = src.search(/export const __test__ = \{/)
  assert.ok(guardPos >= 0 && kitPos > guardPos, '§22d:__test__ 的 export 必须在入口守卫之后(位置本身是判据)')
})

/**
 * D7「动态 import 拼扁平命名空间」(2026-10-29 立)。
 *
 * 立项现场是现读的:scripts/local-login.mjs 的 loadExtract() 里 5 个键指向 workbuddy lib
 * 根本没有的成员,而三层防线一起放行 —— parseImports 只认 `^import` 语句(动态 `import(...)`
 * 不在射程)、`.mjs` 不进 tsc、只有真走到那条分支才 TypeError。所以这一族每一臂都必须**成对**:
 * 只造正例,门会在自己的夹具外面把合法写法判红(首跑就中了两枚:TS 侧 `import('./x.js')` 实指 `x.ts`,
 * 以及 `const env = opts.env` 被当成命名空间变量 ⇒ env.APPDATA 报"键集缺格")。
 */
const D7LIB = ['export function alpha() {}', 'export const beta = 1', 'export default null', ''].join('\n')
/**
 * 造一枚聚合器:两个动态 import 槽位(射程要求 ≥2 —— 只有一跳的 Promise.all 根本不拼命名空间,
 * 上一版的夹具恰好踩在这一格上,四臂全空跑而门"判了 0 处",这就是假绿的形状)。
 */
const d7Agg = (member, callMember) =>
  [
    'import path from "node:path"',
    'const HERE = "."',
    'async function loadKit() {',
    '  const [ns, ns2] = await Promise.all([',
    '    import(pathToFileURL(path.join(HERE, "lib", "x.mjs")).href),',
    '    import(pathToFileURL(path.join(HERE, "lib", "y.mjs")).href),',
    '  ])',
    '  return {',
    `    got: ns.${member},`,
    '    wrapped: (n) => ns.alpha(n),',
    '    second: ns2.beta,',
    '  }',
    '}',
    'const kit = await loadKit()',
    `kit.${callMember}(1)`,
    '',
  ].join('\n')
const d7Fs = (extra = {}) => ({ 'p/lib/x.mjs': D7LIB, 'p/lib/y.mjs': D7LIB, ...extra })
const d7Read = (fs) => (p) => (Object.prototype.hasOwnProperty.call(fs, p) ? fs[p] : null)
const d7Has = (fs) => (p) => Object.prototype.hasOwnProperty.call(fs, p)
const d7Run = (rel, fs) => {
  const r = auditNamespaceAggregator(rel, d7Read(fs), d7Has(fs))
  return { rules: r.violations.map((v) => v.raw), files: r.files, blind: r.blind, blindSites: r.blindSites }
}

test('D7-b 主判据:键指向 lib 从未导出的成员 ⇒ 必拦', () => {
  const r = d7Run('p/main.mjs', d7Fs({ 'p/main.mjs': d7Agg('ghost', 'got') }))
  assert.deepEqual(r.rules, ['got: ns.ghost'], `必须点名这一格,实得:${JSON.stringify(r.rules)}`)
  assert.equal(r.files, 1, '命中射程 ⇒ 覆盖面计数必须记 1(否则 d7ChannelBlind 会把它读成"没看过")')
})

test('D7-b 反向对照:成员真在 lib 导出面 ⇒ 一律不判(与上条成对)', () => {
  const r = d7Run('p/main.mjs', d7Fs({ 'p/main.mjs': d7Agg('beta', 'got') }))
  assert.deepEqual(r.rules, [], `合法写法不得判红:${JSON.stringify(r.rules)}`)
  assert.equal(r.files, 1)
})

test('D7-c 调用面:命名空间变量取了键集里没有的一格 ⇒ 必拦', () => {
  const r = d7Run('p/main.mjs', d7Fs({ 'p/main.mjs': d7Agg('alpha', 'nope') }))
  assert.ok(
    r.rules.some((s) => s === 'kit.nope'),
    `必须点名调用面,实得:${JSON.stringify(r.rules)}`,
  )
})

test('D7-c 反向对照:同名透传的局部变量不得当命名空间(env.APPDATA 假红的成因)', () => {
  const fs = d7Fs({
    'p/main.mjs': `${d7Agg('alpha', 'got')}function useEnv(opts) {\n  const env = opts.env\n  return env.APPDATA || env.IHUI_LOCAL_LOGIN_PROC_CONTROL\n}\n`,
  })
  const r = d7Run('p/main.mjs', fs)
  assert.deepEqual(r.rules, [], `env.* 不是命名空间键缺失,一处都不许报:${JSON.stringify(r.rules)}`)
})

test('D7-a 动态说明符指向不存在的模块 ⇒ 必拦', () => {
  const fs = d7Fs({ 'p/main.mjs': d7Agg('alpha', 'got').replace('"x.mjs"', '"gone.mjs"') })
  const r = d7Run('p/main.mjs', fs)
  assert.ok(
    r.rules.some((s) => s.includes('p/lib/gone.mjs')),
    `路径缺失必须点名,实得:${JSON.stringify(r.rules)}`,
  )
})

test('D7-a 反向对照:TS 侧 `import("./x.js")` 实指 x.ts ⇒ 不得判红(首跑造出两枚假红的成因)', () => {
  const fs = {
    'p/t.spec.ts': [
      'async function load() {',
      '  const [a, b] = await Promise.all([import("./routes/auth.js"), import("./routes/auth-extended.js")])',
      '  return { a: a.h1, b: b.h2 }',
      '}',
      'const k = await load()',
      'k.a()',
      '',
    ].join('\n'),
    'p/routes/auth.js': 'export const h1 = 1',
    'p/routes/auth-extended.js': 'export const h2 = 1',
  }
  const r = d7Run('p/t.spec.ts', fs)
  assert.deepEqual(r.rules, [], `字面 .js 与 .ts 候选都得认,一处不报:${JSON.stringify(r.rules)}`)
  // 同一夹具的变异自证:把目标文件真的拿掉 ⇒ 必须立刻红(a 维不是靠"读不到就放过"蒙绿的)
  const broken = { ...fs }
  delete broken['p/routes/auth.js']
  const r2 = d7Run('p/t.spec.ts', broken)
  assert.ok(r2.rules.length >= 1, '拿掉真实模块后 a 维必须翻红')
})

/**
 * 判据自伤锁(2026-10-29 实测):第一版在**原文**上 test、在**遮噪面**上 exec,
 * 于是"注释里写着 `// const [a, b] = await Promise.all([...])`"的文件命中 test 却拿不到 exec ⇒
 * `m[1]` 读 null,整道门 TypeError 崩在 rc=2(全量档现读复现)。
 * test/exec 必须同面(§0.4):注释永远不构成射程。
 */
test('D7 判据自伤锁:形状只出现在注释里 ⇒ files=0 且绝不崩(与代码面那一支成对)', () => {
  const commented = [
    '// const [a, b] = await Promise.all([import("./lib/x.mjs"), import("./lib/y.mjs")])',
    '/* const [c, d] = await Promise.all([require("./lib/x.mjs"), require("./lib/y.mjs")]) */',
    'export const noop = 1',
    '',
  ].join('\n')
  const r = d7Run('p/main.mjs', d7Fs({ 'p/main.mjs': commented }))
  assert.equal(r.files, 0, '注释里的形状不得算"看过"')
  assert.deepEqual(r.rules, [])
  // 反向臂:同样内容挪出注释 ⇒ 必须立刻进射程(证明这一支不是靠"永远返回 0"蒙绿)
  const real = commented
    .split('\n')
    .map((l) => l.replace(/^\/\/\s*/, '').replace(/^\/\*\s*/, '').replace(/\s*\*\/$/, ''))
    .join('\n')
  const r2 = d7Run('p/main.mjs', d7Fs({ 'p/main.mjs': `async function f(){\n${real}\n}\nconst k = await f()\nk.a()\n` }))
  assert.equal(r2.files, 1, `挪出注释后必须进射程,实得 files=${r2.files}`)
})

/**
 * 排除条款必须点名(2026-10-29):展开式命名空间 `return { ...a, ...b }` 收不到键集,
 * 这一维不判 —— 但必须进 blind 逐条报名。静默跳过 = 给这一型留死角,
 * 而"判据的排除条款"本身就是下一次事故的候选根因。
 */
test('D7 排除格:展开式命名空间 ⇒ 不判红也不记绿,如实登记 blind 一格', () => {
  const spread = [
    'import path from "node:path"',
    'async function loadKit() {',
    '  const [a, b] = await Promise.all([',
    '    import(pathToFileURL(path.join(HERE, "lib", "x.mjs")).href),',
    '    import(pathToFileURL(path.join(HERE, "lib", "y.mjs")).href),',
    '  ])',
    '  return { ...a, ...b }',
    '}',
    'const kit = await loadKit()',
    'kit.alpha()',
    '',
  ].join('\n')
  const r = d7Run('p/main.mjs', d7Fs({ 'p/main.mjs': spread }))
  assert.deepEqual(r.rules, [], '键集读不出来时不得凭猜判红(假阳的代价是逼人 --no-verify)')
  assert.equal(r.files, 1, '它确实在射程内')
  assert.ok(r.blind >= 1, `必须登记未判定格,实得 blind=${r.blind}`)
  assert.ok(
    (r.blindSites || []).some((s) => s.includes('键集为空')),
    `排除原因要点名,实得:${JSON.stringify(r.blindSites)}`,
  )
})

test('D7 射程:单跳动态 import 不算聚合器 ⇒ files=0(覆盖面不得被 Promise.all 解构灌水)', () => {  const single = [
    'async function one() {',
    '  const [a] = await Promise.all([import("./lib/x.mjs")])',
    '  return a',
    '}',
    '',
  ].join('\n')
  const r = d7Run('p/main.mjs', d7Fs({ 'p/main.mjs': single }))
  assert.equal(r.files, 0, '只有一跳 ⇒ 这一维不该声称"看过"')
  assert.deepEqual(r.rules, [])
})

test('D7 通道判死:覆盖面为 0 时"悬空 0 处"不作数(§0.3 与 d4ChannelBlind 同语义)', () => {
  assert.equal(d7ChannelBlind([]), true, '一枚聚合器都没扫到 ⇒ 必须判死')
  assert.equal(d7ChannelBlind([{ file: 'p/main.mjs', files: 0, blind: 3 }]), true, 'blind 格不等于看过')
  assert.equal(d7ChannelBlind([{ file: 'p/main.mjs', files: 1, blind: 0 }]), false, '扫到 1 枚 ⇒ 判活')
})

test('D7 接线形状锁:并进同一张违规表、覆盖面取全量 HEAD、runner 里点名(造好没装车 = 没有)', () => {
  const src = readFileSync(GUARD, 'utf8')
  assert.match(src, /const d7 = auditNamespaceAggregator\(f, readFile, hasPath\)/, 'D7 必须住在 auditTree 里(与 D1..D6 同一条采集通道)')
  assert.match(src, /v\.push\(\.\.\.d7\.violations\)/, 'D7 的违规必须并进同一张表(锚点/打印/退出码只一套语义)')
  assert.match(src, /d7ChannelBlind\(d7HeadSink\)/, '判死必须取 HEAD 全量面,不随 --staged/--files 收窄')
  assert.match(src, /auditNamespaceAggregator,/, '__test__ 必须出口本体(镜像测试不得复制判据,§22c)')
  const runner = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  assert.match(runner, /check-dangling-local-imports\.mjs/, '门 98 本体必须仍在 runner 里')
  assert.match(runner, /D7/, 'runner 的 label/onFailHint 必须点名 D7 —— 已接线而文档不点名是门 89 R4 的红')
})

/**
 * D6-c「错名 `.js` 的正文语言维」(2026-11-01 补,票面 G-815915 的型②「该 `.js` 正文含 TS 语法 ⇒
 * 命中即必炸」)。镜像只 import 门体 `__test__` 出口,一个判据常量都不抄(§22c)。
 *
 * 这一维补的是 a/b/D4 都看不见的同一格:a(同名并存)与 b(解析落点)都**只清单不读正文**,
 * D4 的次判据虽读正文,但前置是"已被 `.js` 说明符字面命中" ⇒ 一枚"没有同 stem 同伴、此刻也
 * 没人指向、正文却写着 TS"的入库 `.js` 三判据全瞎 —— 而下一次有人指向它时炸的是运行时。
 */
const C_KIT = D6KIT

/** D6-c 端到端计数行的**唯一实现**(基准断言与变异自证共用,§0.6):
 *  · 行必须存在且五字段齐(缺行/形态坏 = 这一维没上岗);
 *  · `扫 N 枚` 的 N 必须等于**同一面**的入库 `.js` 真数(覆盖面有牙:灌水或漏扫都翻红);
 *  · `命中 M 枚` 的 M 必须为 0(HEAD 面零容忍;立门当天现读 61 枚全扫 0 命中)。 */
function assertD6cCountLine(out, expectScanned) {
  const m =
    /D6 错名影子:同名并存 \.js \+ \.ts\/\.tsx (\d+) 对 \| TS 侧 '\.js' 说明符解析到入库 \.js 自身 (\d+) 处 \| 正文含 TS 专有语法\(型②必炸\)扫 (\d+) 枚命中 (\d+) 枚 \| 判红候选 (\d+) 处/.exec(
      out,
    )
  assert.ok(m, `报告缺 D6-c 计数行 ⇒ 型②这一维没上岗:${out.slice(0, 600)}`)
  for (const [i, name] of [
    [1, '同名并存(a)'],
    [2, '解析落点(b)'],
    [3, '正文语言维射程枚数(scanned)'],
    [4, '正文命中枚数(candidates)'],
    [5, '判红候选'],
  ])
    assert.match(String(m[i] ?? ''), /^\d+$/, `D6 计数行字段「${name}」缺失或非数字形态 ⇒ 计数行形状坏了`)
  if (expectScanned !== undefined)
    assert.equal(
      Number(m[3]),
      expectScanned,
      `D6-c 射程读到 ${m[3]} 枚,同一面 git ls-tree 现读 ${expectScanned} 枚 ⇒ 覆盖面与清单面不一致(漏扫/灌水)`,
    )
  assert.ok(Number(m[3]) > 0, '射程 0 枚 ⇒ 这一维根本没看过东西,那句"命中 0 枚"不作数(门体据此 exit 2)')
  assert.equal(Number(m[4]), 0, `HEAD 面上有 ${m[4]} 枚入库 .js 正文写着 TS 语法 ⇒ 有人把实现写进了错名 .js`)
  assert.ok(!/D6-c 未判定/.test(out), `D6-c 未判定不得常态挂着:${out.slice(0, 800)}`)
  return { coexist: Number(m[1]), literalWin: Number(m[2]), scanned: Number(m[3]), hits: Number(m[4]), candidates: Number(m[5]) }
}

test('D6-c 前置复量(票面"覆盖面为 0"这条前提自己复量,不照抄):HEAD 面入库 .js 逐枚与门体射程一致', () => {
  const trackedJs = listTrackedJs()
  const { out } = runGuard()
  console.log('   D6-c 计数行现读:', JSON.stringify(assertD6cCountLine(out, trackedJs.length)))
  assert.ok(trackedJs.length > 0, '清单面自证:HEAD 面必须列得出入库 .js(列到 0 枚 = 尺子失效,不记绿)')
})

/** 同一取材面的入库 `.js` 清单:过滤判据全部取自门体 `__test__`(§22c:测试里另抄一份必漂移)。 */
function listTrackedJs() {
  return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: 120000 })
    .split('\0')
    .filter(Boolean)
    .filter((p) => C_KIT.SRC_RE.test(p) && !C_KIT.SKIP_DIR.test(p) && !C_KIT.FIXTURE_ROOT.test(p) && C_KIT.JS_SPEC_RE.test(p))
}

test('D6-c 判据本体经 __test__ 出口交付,台账路径只有一份(§22c:镜像不得复制判据常量)', () => {
  for (const fn of [
    C_KIT.auditShadowSyntaxBombs,
    C_KIT.parseShadowExemptionLedger,
    C_KIT.shadowExemptionActive,
    C_KIT.loadShadowExemptionLedger,
    C_KIT.d6cChannelBlind,
  ])
    assert.equal(typeof fn, 'function', 'D6-c 的判据本体必须是可单测的纯函数')
  assert.equal(typeof C_KIT.SHADOW_EXEMPTION_LEDGER, 'string')
  assert.ok(C_KIT.SHADOW_EXEMPTION_REASON_MIN >= 10, '豁免理由下限不得为 0(空口登记不成立)')
  // 台账必须真的存在且是当前形状(取不到时门体 CLI 当场 exit 2,不回落"没有豁免")
  const raw = readFileSync(join(ROOT, C_KIT.SHADOW_EXEMPTION_LEDGER), 'utf8')
  const parsed = C_KIT.parseShadowExemptionLedger(raw)
  assert.equal(parsed.problem, null, `现读台账形状坏:${parsed.problem}`)
  assert.ok(Array.isArray(parsed.entries))
})

test('D6-c 真仓历史 blob 阳性对照:只喂正文(不给同伴、不给消费方)必须点名那枚打崩生产的文件', () => {
  const PRE = '6bf657df86^'
  const SHADOW = 'apps/api/src/services/user-concurrency-service.js'
  const blob = gitRaw(['show', `${PRE}:${SHADOW}`], ROOT, { timeout: 120000 })
  assert.match(blob, /new Map<string, number>/, '历史 blob 取样取错了(阳性对照无从谈起)')
  // a/b 两判据在这一格都是瞎的:没有同 stem 同伴进 trackedSrc,也没有 sites
  const wn = C_KIT.auditWrongNameShadow([], new Set([SHADOW]), (p) => (p === SHADOW ? blob : null), [], '2026-11-01')
  assert.deepEqual(wn.coexist, [], '本夹具刻意不留同伴 ⇒ a 维不该命中(留证:这一格原先三判据全瞎)')
  assert.deepEqual(wn.literalWin, [], '本夹具刻意不留说明符 ⇒ b 维不该命中')
  assert.equal(wn.bombs.bombs.length, 1, 'c 维必须咬住')
  assert.equal(wn.byFile.get(SHADOW)[0].rule, 'D6')
  assert.match(wn.byFile.get(SHADOW)[0].hint, /TS 专有语法/)
  assert.ok(wn.byFile.get(SHADOW)[0].line > 1, '裸影子那一格行号必须是探针命中的真实行,不是占位 1')
  // 反向对照:同一枚文件修好后(HEAD 面只剩 .ts,`.js` 已不在库)⇒ 射程为空,尺子不冒充"看过"
  const after = C_KIT.auditShadowSyntaxBombs(() => null, [], [], '2026-11-01')
  assert.equal(after.scannedFiles, 0)
  assert.equal(C_KIT.d6cChannelBlind(after), true, '一枚都没进射程 ⇒ 判死不记绿')
})

/**
 * D6 **型①(同名并存)的真仓历史清单面阳性对照**(2026-11-01 补,T98 / 票面 G-815915)。
 *
 * 为什么单独一条:上一条历史例**刻意不给同伴**(为的是证明 c 独立有牙),而票面要求"两型都有阳性
 * 对照"——型① 此前只有自造的 `x.js + x.ts` 夹具,夹具只证明"实现按自己的理解会红"。这里把
 * `6bf657df86^` 那棵树的 **git ls-tree 全量清单**当 trackedSrc、三个真实 blob 当内容面,同一判据必须:
 *   · a)点名 `user-concurrency-service.js ⇄ .ts` 这一对(影子陷阱本体,当年就是这样进的 HEAD);
 *   · b)**不**点名 —— 当年 .ts 同伴在库 ⇒ 解析候选首位是 `.ts`,b 打的是"无同伴、映射被错名直接吃掉"
 *     那一型;这一格若命中说明三判据的口径互相分叉(实读与门体 `--rev 6bf657df86^` 计数行同源:
 *     并存 1 对 / 解析落点 0 处 / 必炸 1 枚);
 *   · c)同一枚的"必炸"证据**并进同一行 hint 且计数不翻倍**(§12e 棘轮锚点)。
 * 清单面与内容面同源、过滤判据全部取自门体(§22c:测试里不抄第二份)。
 */
test('D6 型① 真仓历史清单面阳性对照:6bf657df86^ 的同名并存对必须被点名(清单取自 ls-tree,不手写)', () => {
  const PRE = '6bf657df86^'
  const SHADOW = 'apps/api/src/services/user-concurrency-service.js'
  const REAL_TS = 'apps/api/src/services/user-concurrency-service.ts'
  const CONSUMER = 'apps/api/src/routes/v1-public.ts'
  const show = (rev, p) => gitRaw(['show', `${rev}:${p}`], ROOT, { timeout: 120000 })
  // 取样自证(票面要求"自己先 git show 取证确认它确实存在且确实是影子形态",不是凭记忆造夹具)
  const jsBlob = show(PRE, SHADOW)
  const tsBlob = show(PRE, REAL_TS)
  const consumerBlob = show(PRE, CONSUMER)
  assert.match(jsBlob, /new Map<string, number>/, '历史 .js 正文不是 TS 形态 ⇒ 取样取错了,阳性对照无从谈起')
  assert.match(consumerBlob, /from '\.\.\/services\/user-concurrency-service\.js'/, '消费方不是当年那一条 `.js` 说明符')
  assert.ok(jsBlob !== tsBlob, '两份正文必须不同 —— 相同就不是"架空",而是重复登记')
  const treeFiles = new Set(
    gitRaw(['ls-tree', '-r', '--name-only', PRE, '-z'], ROOT, { timeout: 120000 })
      .split('\0')
      .filter(Boolean),
  )
  assert.ok(treeFiles.has(SHADOW) && treeFiles.has(REAL_TS), '历史面自证:影子与 .ts 当年都在库(都进了 HEAD)')

  const files = { [SHADOW]: jsBlob, [REAL_TS]: tsBlob, [CONSUMER]: consumerBlob }
  const read = (p) => (p in files ? files[p] : null)
  const sites = []
  auditFile(CONSUMER, read, (p) => p in files, new Map(), sites)
  const wn = C_KIT.auditWrongNameShadow(sites, treeFiles, read, [], '2026-11-01')
  assert.ok(wn.coexist.includes(SHADOW), `型① 必须点名当年那一对同名并存,实得 coexist=${JSON.stringify(wn.coexist)}`)
  assert.deepEqual(wn.literalWin, [], '当年 .ts 同伴在库 ⇒ 解析候选落在 .ts,b 维不该命中(命中即三判据口径分叉)')
  assert.ok(wn.bombs.candidates.some((c) => c.file === SHADOW), '型② 必须在同一份历史面上点名必炸那枚')
  const row = wn.byFile.get(SHADOW)
  assert.equal((row || []).length, 1, '同一枚 a+c ⇒ 违规表只记 1 处(并句不并数,否则把无关提交顶过自己的 HEAD 锚点)')
  assert.match(row[0].hint, /影子陷阱本体/, 'a 维措辞必须在 —— 删掉它没人知道这一对是什么')
  assert.match(row[0].hint, /TS 专有语法/, 'c 维的"必炸"证据必须并进同一行 hint')
  assert.equal(row[0].line, 29, '行号必须是探针在历史 blob 里命中的真实行(泛型实参第 29 行),不是占位 1')
  // 射程诚实性:历史面 37 枚入库 .js 全进射程,读不到正文的 36 枚逐枚未判定(内容面只有三个 blob)
  assert.equal(wn.bombs.scannedFiles, 37, `射程枚数必须等于该面清单现读,实得 ${wn.bombs.scannedFiles}`)
  assert.equal(wn.bombs.undetermined.length, 36, '取不到正文的每一枚必须逐枚点名(§0.3:不记绿也不冒红)')
  // 反向对照:修好后的 HEAD 清单面里这一对已不存在 ⇒ 同一判据读 0(尺子不靠历史面撑读数)
  const headFiles = new Set(
    gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: 120000 })
      .split('\0')
      .filter(Boolean),
  )
  const after = C_KIT.auditWrongNameShadow([], headFiles, (p) => (p === SHADOW ? jsBlob : null), [], '2026-11-01')
  assert.deepEqual(after.coexist, [], 'HEAD 面已无该 .js ⇒ 并存对必须为 0(与门体计数行现读同源)')
})

test('D6-c 豁免必须"验过才免"且会到期;坏台账整批不生效;登记不再命中 = 清单腐烂', () => {
  const day = '2026-11-01'
  const bomb = (p) => (p === 'z/a.js' ? 'export const m = new Map<string, number>()\n' : null)
  const good = [{ file: 'z/a.js', reason: '上游 vendored 产物,改名会破坏其自更新脚本', ticket: 'G-815915', until: '2026-12-31' }]
  const hit = C_KIT.auditShadowSyntaxBombs(bomb, ['z/a.js'], [], day)
  assert.equal(hit.bombs.length, 1, '基准:无豁免必红')
  const waived = C_KIT.auditShadowSyntaxBombs(bomb, ['z/a.js'], good, day)
  assert.deepEqual(waived.bombs, [], '有效豁免 ⇒ 免判红')
  assert.equal(waived.exempted.length, 1, '免了也必须点名(逐枚进报告,不得静默)')
  const expired = C_KIT.auditShadowSyntaxBombs(bomb, ['z/a.js'], [{ ...good[0], until: '2026-10-31' }], day)
  assert.equal(expired.bombs.length, 1, '到期 ⇒ 立刻回到射程(豁免不会自动续期)')
  const rot = C_KIT.auditShadowSyntaxBombs(() => 'module.exports = 1\n', ['z/a.js'], good, day)
  assert.equal(rot.rot.length, 1, '登记了却被审面不再命中 ⇒ 清单腐烂,调用方判红(§0.7)')
  assert.deepEqual(rot.bombs, [], '腐烂格与真违规分开计数(不得靠并桶消红)')
  for (const bad of [
    [{ file: 'z/a.js', ticket: 'G-1', until: '2026-12-31' }],
    [{ file: 'z/a.js', reason: '顺手', ticket: 'G-1', until: '2026-12-31' }],
    [{ file: 'z/a.js', reason: '够长的理由够长的理由', ticket: 'G-1', until: '2026/12/31' }],
    [{ file: 'z/a.js', reason: '够长的理由够长的理由', ticket: 'G-1' }],
  ]) {
    const r = C_KIT.parseShadowExemptionLedger(JSON.stringify(bad))
    assert.equal(r.entries, null, `坏行必须整批不生效,实得 ${JSON.stringify(r)}`)
    assert.ok(r.problem, '坏行必须给出原因(不得静默当空表)')
    const dead = C_KIT.auditShadowSyntaxBombs(bomb, ['z/a.js'], r.entries, day)
    assert.equal(dead.undetermined.length, 1, '台账坏 ⇒ D6-c 未判定(既不记绿也不冒红,§0.3)')
    assert.equal(dead.bombs.length, 0)
  }
  assert.equal(C_KIT.d6cChannelBlind(hit), false, '扫过且命中 ⇒ 通道活着')
  assert.equal(C_KIT.d6cChannelBlind(C_KIT.auditShadowSyntaxBombs(bomb, ['z/a.js'], null, day)), true, '台账没加载 ⇒ 判死')
  assert.equal(C_KIT.d6cChannelBlind(C_KIT.auditShadowSyntaxBombs(null, ['z/a.js'], [], day)), true, '取材通道没接 ⇒ 判死')
})

test('D6-c 与 a/b 并进同一张表:同枚只并句不并数(棘轮锚点不得被计数虚高顶红,§12e)', () => {
  const day = '2026-11-01'
  const files = { 'z/x.js': 'interface Foo { a: number }\n' }
  const read = (p) => files[p] ?? null
  const tracked = ['z/x.js', 'z/x.ts']
  const base = C_KIT.auditWrongNameShadow([], new Set(tracked), null, [], day)
  const withC = C_KIT.auditWrongNameShadow([], new Set(tracked), read, [], day)
  assert.equal(base.coexist.length, 1, 'a 维基准:同名并存 1 对')
  assert.equal(base.byFile.get('z/x.js').length, 1, '不带正文 ⇒ 该文件 1 处违规')
  assert.equal(withC.byFile.get('z/x.js').length, 1, '带正文命中同一枚 ⇒ 仍然 1 处(并句不并数)')
  assert.match(withC.byFile.get('z/x.js')[0].hint, /TS 专有语法/, 'hint 必须把"必炸"证据并进来')
  assert.notEqual(withC.byFile.get('z/x.js')[0].hint, base.byFile.get('z/x.js')[0].hint)
  // 磁盘残留不算本仓债务:trackedSrc(同一取材面)之外的同名 .js 不进射程
  const notTracked = C_KIT.auditShadowSyntaxBombs(read, ['z/x.ts'], [], day)
  assert.equal(notTracked.scannedFiles, 0)
  assert.deepEqual(notTracked.bombs, [])
})

/**
 * 变异自证(与 D4 那三条同一取向):牙必须长在"形态 + 覆盖面 + 零容忍"上,不能靠一次性读数。
 * 全部在**同一条缓存的门体输出**上做字符串变异,零额外全量扫描;夹具本身摘不到/改不到也当场判失败。
 */
test('D6-c 计数行断言变异自证:摘行/射程归零/命中变红 三型必翻红,只报数维归零必不红', () => {
  const { out } = runGuard()
  const trackedJs = listTrackedJs()
  const N = assertD6cCountLine(out, undefined)
  assert.ok(trackedJs.length > 0, '夹具失效:HEAD 面一枚入库 .js 都列不出来')
  // 变异①:整行摘除 ⇒ 必须翻红("缺行 = 没上岗"有牙)
  const noLine = out.replace(/^.*D6 错名影子:.*\n?/m, '')
  assert.ok(noLine.length < out.length, '夹具失效:没摘到 D6 计数行')
  assert.throws(() => assertD6cCountLine(noLine), /缺 D6-c 计数行/)
  // 变异②:射程读数 → 0 ⇒ 必须翻红(采集口径为 0 = 尺子失效,门体据此 exit 2)
  const zeroScan = out.replace(/(型②必炸\)扫 )\d+( 枚)/, (_, a, b) => `${a}0${b}`)
  assert.match(zeroScan, /型②必炸\)扫 0 枚/, '夹具失效:没把射程改成 0')
  assert.throws(() => assertD6cCountLine(zeroScan), /射程 0 枚|覆盖面/)
  // 变异③:命中读数 → 1 ⇒ 必须翻红(HEAD 面零容忍)
  const oneHit = zeroScan.replace(/(扫 0 枚命中 )\d+( 枚)/, (_, a, b) => `${a}1${b}`)
  assert.match(oneHit, /扫 0 枚命中 1 枚/, '夹具失效:没把命中改成 1')
  assert.throws(() => assertD6cCountLine(oneHit), /射程 0 枚|正文写着 TS/)
  // 变异④(反向防呆):a/b 两格的读数归零**不得**翻红 —— 它们是"现读为 0"的报数格,不是下限
  const zeroAB = out
    .replace(/同名并存 \.js \+ \.ts\/\.tsx (\d+) 对/, '同名并存 .js + .ts/.tsx 0 对')
    .replace(/解析到入库 \.js 自身 (\d+) 处/, '解析到入库 .js 自身 0 处')
  assert.match(zeroAB, /同名并存 \.js \+ \.ts\/\.tsx 0 对/, '夹具失效:没把 a 格改成 0')
  assert.doesNotThrow(() => assertD6cCountLine(zeroAB), 'a/b 归零是本仓常态 ⇒ 断言不得为此翻红(假红 = 挡全仓落地)')
  console.log(`   变异自证基准读数:${JSON.stringify(N)}`)
})

test('D6-c 接线形状锁:三面 + --rev 都吃到正文与台账,判死与出口齐备(造好没装车 = 没有)', () => {
  const src = readFileSync(GUARD, 'utf8')
  assert.match(src, /wnPending = auditWrongNameShadow\(\s*stagedSites,\s*trackedStagedSrc,\s*readPending,/, '--staged 面必须吃到索引正文与台账')
  assert.match(src, /wnPending = auditWrongNameShadow\(\s*filesSites,\s*filesTrackedSrc,\s*wread,/, '--files 面同一条通道')
  assert.match(src, /wnHead = auditWrongNameShadow\(\s*jsSitesHead,\s*new Set\(headFiles\),\s*readHead,/, '全量档必须吃 HEAD 内容')
  assert.match(
    src,
    /auditWrongNameShadow\(\s*jsSites,\s*new Set\(files\),\s*read,/,
    '--rev 面(auditOneFace)必须吃被审树内容,D6-c 不得只在全量档上岗',
  )
  assert.match(src, /const SHADOW_LEDGER = loadShadowExemptionLedger\(\)/, '台账一次加载、三面共用(两处各读一遍必漂,§0.6)')
  assert.match(src, /d6cChannelBlind\(wnPending\.bombs\)/, 'CLI 必须有采集口径判死(不记绿也不冒红)')
  assert.match(src, /wnBombs\.undetermined\.length/, '--rev 档同样必须把未判定折成 exit 2')
  assert.match(src, /wnPending\.bombs\.rot\.length/, '台账腐烂必须判红(§0.7)')
  // 三把"未判定/腐烂"尺必须排在报数行之后、报告收尾之前(装在 main 的计数段,不是死代码)
  const atCountLine = src.indexOf('D6 错名影子:同名并存')
  const atRot = src.indexOf('wnPending.bombs.rot.length')
  const atBlind = src.indexOf('d6cChannelBlind(wnPending.bombs)')
  const atFinalZero = src.indexOf('全量口径为零容忍')
  assert.ok(
    atCountLine > 0 && atCountLine < atRot && atRot < atBlind && atBlind < atFinalZero,
    `D6-c 的判定段必须住在计数区(计数 ${atCountLine} / 腐烂 ${atRot} / 判死 ${atBlind} / 收尾 ${atFinalZero})`,
  )
  assert.match(src, /auditShadowSyntaxBombs,/, '__test__ 必须出口本体(镜像测试不得复制判据,§22c)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
