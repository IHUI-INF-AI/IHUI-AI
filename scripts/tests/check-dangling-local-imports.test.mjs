// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 98「HEAD 悬空具名导入对账」镜像测试(§22c:直接 import 源模块,不复制实现)
 *
 * 重点钉三件"本地全绿也发现不了"的事:
 *  1. 判据必须真读 HEAD blob(工作区滞后 HEAD 是本仓常态);
 *  2. 棘轮锚点必须是该文件 HEAD 自身的违规数 —— 否则存量会把每次提交都判红,逼人 --no-verify;
 *  3. 必须装车(guardian-runner 里 id 98 存在、blocking、skipEnv 对得上)。
 */
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auditFile,
  parseExports,
  parseImports,
  templateInteriorLines,
  aliasEntries,
  resolveAliasSpec,
  buildAliasIndex,
  KNOWN_ALIAS_LEDGER,
} from '../check-dangling-local-imports.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(ROOT, 'scripts/check-dangling-local-imports.mjs')

test('源模块导出可单测的纯函数(§22c 前置条件;D3 那三个必须在列,否则判据只能靠端到端摸)', () => {
  for (const fn of [
    parseImports,
    parseExports,
    auditFile,
    templateInteriorLines,
    aliasEntries,
    resolveAliasSpec,
    buildAliasIndex,
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

test('真仓 HEAD:D1/D2 必须为 0,D3 只能是已登记的 G-195 那一处(多一处就是有人又提交了半成品)', () => {
  let out
  try {
    out = execFileSync(process.execPath, [GUARD], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 128 << 20,
      timeout: 420000,
    })
  } catch (e) {
    //  exit 1 时也要把"到底是哪几处"报出来 —— 只说"失败了"等于没有哨兵
    const back = [...((e.stdout || '').toString().matchAll(/^   (\S+):\d+ \[(D\d)\] (.+?)  →/gm))]
    assert.fail(
      `HEAD 上出现 ${back.length} 处未登记的悬空具名导入:\n` +
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
