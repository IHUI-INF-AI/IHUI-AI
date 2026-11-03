// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据 import 源脚本的 __test__,本文件不复制第二份比较逻辑。
// 本票锁四件事:① 定级形状锁 —— 本尺判机器态,guardian-runner 注册表与 .husky 钩子面
//    **绝不得出现本文件名**(挂进提交链即 §12e 恒红门:非生产机上 D:\DevEnv\monitor 不存在);
// ② 文档点名(AGENTS.md 只读尺子族登记在册);③ 三态判定用内存夹具直取门体函数
//    (同形→0、改一字节→点名该对、缺侧→未判定,readFn 注入不落盘);
// ④ 值不落输出的脱敏锁(哨兵字样绝不出现在报告/JSON)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-monitor-runtime-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

test('装车形状锁(反向):guardian-runner 与 .husky 面不得出现本文件名 —— 机器态判据不接提交链', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.ok(!runner.includes('check-monitor-runtime-parity'), '本尺被误接进提交链注册表(恒红门风险)')
  for (const f of ['pre-commit', 'pre-push', 'commit-msg']) {
    let text = ''
    try { text = readFileSync(join(ROOT, '.husky', f), 'utf8') } catch { continue }
    assert.ok(!text.includes('check-monitor-runtime-parity'), `本尺被误接进 .husky/${f}`)
  }
})

test('文档点名:AGENTS.md 的只读对账尺子族登记了本尺', () => {
  const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')
  assert.ok(agents.includes('check-monitor-runtime-parity.mjs'), 'AGENTS.md 未点名本尺(§0.9:已接线而不点名 ⇒ 红;本尺未接线也应登记用途)')
})

test('配对清单形状:现读 ≥4 枚、每条带 owner+reason、id 唯一、路径非空', () => {
  assert.ok(gate.PAIRS.length >= gate.MIN_CONFIG_PAIRS, `配置对 ${gate.PAIRS.length} < ${gate.MIN_CONFIG_PAIRS}`)
  const ids = gate.PAIRS.map((p) => p.id)
  assert.equal(new Set(ids).size, ids.length, '配对清单 id 撞号')
  for (const p of gate.PAIRS) {
    assert.ok(p.owner && p.reason && p.repoRel && p.runtimeAbs, `配对 ${p.id} 登记不齐(owner/reason/两侧路径)`)
  }
  assert.ok(gate.ENV_PAIRS.length >= 1)
})

const mkRead = (files) => (absPath, label) =>
  files[absPath] === undefined ? { ok: false, why: `${label}读不到(${absPath}):ENOENT` } : { ok: true, text: files[absPath] }

test('三态判定(内存夹具):水印+CRLF 同形→same;改一字节→differ 点名该对;缺侧→undetermined', () => {
  const body = 'server:\n  http_listen_port: 3100\nauth_enabled: false\n'
  const banner = '// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top\n// Provenance-watermarked. 未授权商用可被溯源追责。\n// [IHUI-AI-PROVENANCE]:x\n\n'
  const files = {
    '/r/a': banner + body, '/s/a': body.replace(/\n/g, '\r\n'),
    '/r/b': body, '/s/b': body.replace('3100', '3101'),
    // /s/c 故意缺
  }
  const read = mkRead(files)
  const p = (id, repoAbs, runtimeAbs) => gate.comparePair({ id, repoRel: id, runtimeAbs }, read, repoAbs)
  assert.equal(p('a', '/r/a', '/s/a').state, 'same')
  const db = p('b', '/r/b', '/s/b')
  assert.equal(db.state, 'differ')
  assert.ok(db.diffCount > 0 && db.firstDiff.repoLine === 2, '差异必须点名行数与首差行号')
  assert.equal(p('c', '/r/c-nonexistent', '/s/c-nonexistent').state, 'undetermined')
})

test('归一化:水印结构行与零宽族不参与比较;CRLF/行尾空白/首尾空行抹平', () => {
  const lines = gate.normalizeLines('\uFEFF\n// [IHUI-AI-PROVENANCE]:x\nhello  \r\n\r\n')
  assert.deepEqual(lines, ['hello']) // 横幅行由 stripWatermarkStructure 判并剔除(BANNER_TEXT_RE 命中)
  assert.equal(gate.normalizeLines('a\r\nb\n').join('|'), 'a|b')
})

test('LCS 预算锁:单侧超 MAX_LCS_LINES ⇒ diffStats 返回未判定而非半比较', () => {
  const big = Array.from({ length: gate.MAX_LCS_LINES + 1 }, (_, i) => `L${i}`)
  const st = gate.diffStats(big, big.slice(0, 5))
  assert.ok(st.undetermined, '超预算必须给未判定字符串')
})

test('env 选择器:COMBO_CHAINS 显式 + *_URL/*_PORT 模式入选;密钥命名族与其余键整体剔除', () => {
  const sel = gate.selectEnvKeys(
    [
      'COMBO_CHAINS=a,b', 'export AI_SERVICE_URL="http://never-print-x"', 'DB_PORT=5432',
      'JWT_SECRET=never-print-s', 'API_KEY_HEADER=x', 'REDIS_URL=never-print-r',
      'LOG_LEVEL=info', '# COMMENT_PORT=not-a-key',
    ].join('\n'),
    { explicitKeys: ['COMBO_CHAINS'], patterns: [/^[A-Z0-9_]*_(?:URL|PORT)$/] },
  )
  assert.deepEqual([...sel.keys()].sort(), ['AI_SERVICE_URL', 'COMBO_CHAINS', 'DB_PORT', 'REDIS_URL'])
  assert.equal(sel.get('AI_SERVICE_URL'), 'http://never-print-x') // 引号剥掉,但值不落输出由下一级锁判
  assert.ok(![...sel.keys()].some((k) => gate.SECRET_NAME_RE.test(k)))
})

test('env 同形判定:顺序不同 ⇒ differ 点名该键;任何值(含哨兵)绝不落输出', () => {
  const files = {
    '/r/e': 'COMBO_CHAINS=step-3.7,agnes-2.5\nAI_SERVICE_URL=http://never-print-u\nSMTP_PASSWORD=never-print-p\n',
    '/s/e': 'COMBO_CHAINS=agnes-2.5,step-3.7\nAI_SERVICE_URL=http://never-print-u\nSMTP_PASSWORD=never-print-q\n',
  }
  const ep = { id: 'e', repoRel: 'e', runtimeAbs: '/s/e', explicitKeys: ['COMBO_CHAINS'], patterns: [/^[A-Z0-9_]*_(?:URL|PORT)$/] }
  const r = gate.compareEnvPair(ep, mkRead(files), '/r/e')
  assert.equal(r.state, 'differ')
  assert.equal(r.keys.find((k) => k.key === 'COMBO_CHAINS').state, 'differ')
  assert.equal(r.keys.find((k) => k.key === 'AI_SERVICE_URL').state, 'same')
  assert.ok(!r.keys.some((k) => /PASSWORD/.test(k.key)), '密码族键不得出现在清单')
  const dump = JSON.stringify(r) + gate.render(gate.runParity([], [ep], mkRead(files), { e: '/r/e' }))
  assert.ok(!dump.includes('never-print'), '任何值字样绝不允许落输出')
})

test('退出码纪律:差异不产生 exit 1;未判定与清单空转 ⇒ exit 2;全量可判定 ⇒ exit 0', () => {
  const body = 'x\ny\n'
  const files = { '/r/1': body, '/s/1': body, '/r/2': body, '/s/2': 'x\nz\n', '/r/3': body, '/s/3': body, '/r/4': body, '/s/4': body }
  const read = mkRead(files)
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, repoRel: `p${i}`, runtimeAbs: `/s/${i + 1}` }))
  const absOverride = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`p${i}`, `/r/${i + 1}`]))
  const allJudged = gate.runParity(mk(4), [], read, absOverride)
  assert.equal(allJudged.exitCode, 0)
  assert.ok(allJudged.buckets.config.differ === 1 && allJudged.buckets.config.same === 3)
  // 2026-10-20 把 MIN_CONFIG_PAIRS 从 4 调到 3 ⇒ 写死的 `mk(3)` 不再低于阈值,"空转"那一支
  // 结构上不触发(本门这 1 红就是它)。阈值本身是从真清单派生的,所以这里跟着**导出的常量**走,
  // 不另拍一个数。
  const empty = gate.runParity(mk(gate.MIN_CONFIG_PAIRS - 1), [], read)
  assert.equal(empty.exitCode, 2)
  assert.ok(empty.warnings.some((w) => w.includes('空转')))
  const undet = gate.runParity([{ id: 'g', repoRel: 'g', runtimeAbs: '/s/missing' }, ...mk(3)], [], read, { g: '/r/missing', ...absOverride })
  assert.equal(undet.exitCode, 2)
  assert.equal(undet.buckets.config.undetermined, 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
