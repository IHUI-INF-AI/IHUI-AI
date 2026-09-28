// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * §22c 镜像测试:溯源署名 v2(watermark.mjs / watermark-strip-payload.mjs /
 * check-watermark-coverage.mjs 三件套的形态迁移)。
 *
 * 跑法: node --test scripts/tests/watermark-strip-payload.test.mjs
 *
 * 纪律(都是本仓记过账的):
 *  - 本文件**不复制判据实现**:分类/剥离逻辑一律 import 源模块的 `__test__`;端到端一律
 *    spawn 真实 CLI(`--root` 测试通道),这样"函数在但没人调"这一型(守门 70/76/81)会被暴露。
 *  - 端到端取证在**独立临时 git 仓**里做(mkScratch),不 chdir 真仓 —— 只靠 cwd 的夹具
 *    会静默去扫真仓(门 70 那轮 14 例里 13 例就这么废了)。
 *  - **关键断言用一把异形尺子复量**:剥离后的文件用 `git diff --numstat`(git 自己的
 *    diff 引擎)与**字符多重集**两条独立判据复核,不复用 strip 里那条正则。
 *  - 零宽字符一律由码点转义构造,本文件自身不留 Cf 字符 ——
 *    否则这份测试自己就是它要删除的那一类文件(例 13 自查这一点)。
 *  - 反向锁成对出现:"旧格式被静默放过"与"新格式被静默判红"是同一枚硬币的两面,
 *    各有一条断言钉住(例 1 的两支、例 9 的两支)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as STRIP } from '../watermark-strip-payload.mjs'
import { __test__ as WM } from '../watermark.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPTS = join(REPO, 'scripts')
const WM_CLI = join(SCRIPTS, 'watermark.mjs')
const STRIP_CLI = join(SCRIPTS, 'watermark-strip-payload.mjs')
const COV_CLI = join(SCRIPTS, 'check-watermark-coverage.mjs')
const NODE = process.execPath

const ZW = String.fromCharCode(0x2060, 0x200b, 0x200c, 0x200d, 0x200b, 0x2060)
/** 真·可解码载荷:`classifyText` 的 legacy / legacyCorrupt 两档只有拿它才分得开。 */
const PAY = WM.encodePayload(WM.WATERMARK_TEXT)
/** 哨兵成对但解不出明文 ⇒ legacyCorrupt(旧"144 文件载荷被批量改写损坏"那一型)。 */
const BAD_PAYLOAD = WM.encodePayload('IHUI-AI·智汇AI·李春川·XX·aizhs.top·PROVENANCE-2026')
const BOM = String.fromCharCode(0xfeff)
const ZW_RE = /[\u200b\u200c\u200d\u2060]/g
const LEGACY2 = WM.LEGACY_BANNER_LINES[1]
const NEW2 = WM.BANNER_LINES[1]

function zwCount(s) {
  return (s.match(ZW_RE) || []).length
}

function legacyBanner(pre = '// ') {
  return `${pre}${WM.BANNER_LINES[0]}\n${pre}${LEGACY2}\n${pre}[${WM.BANNER_ID}]:${PAY}\n`
}

/**
 * 本测试自带的**独立**剥离尺子(与 strip 的实现形态不同:这里按"剥掉注释符与零宽后是否还剩
 * 可见字符"来判删除行,strip 里是正则类)。仅用于例 2 的多重集复核。
 */
function rulerDropSet(lines) {
  return lines.filter((l) => {
    if (/^\s*(?:\/\/|#|--|\*)?\s*\[IHUI-AI-PROVENANCE\]\s*:/.test(l)) return false
    const visible = l
      .replace(ZW_RE, '')
      .replace(/^(?:\/\/|#|--|\/\*|<!--)/, '')
      .replace(/(?:\*\/|-->)$/, '')
    return visible.trim().length > 0
  })
}

function git(cwd, args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
}

function cli(script, args, cwd) {
  let stdout = ''
  let stderr = ''
  let status = 0
  try {
    stdout = execFileSync(NODE, [script, ...args], {
      cwd: cwd ?? REPO,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      timeout: 300_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    status = typeof e?.status === 'number' ? e.status : 1
    stdout = String(e?.stdout ?? '')
    stderr = String(e?.stderr ?? '')
  }
  return { status, stdout, stderr }
}

/** 隔离临时 git 仓(autocrlf=false,免得 EOL 归一污染字节级断言)。 */
function mkRepo(prefix) {
  const dir = mkScratch(prefix)
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.email', 't@example.invalid'])
  git(dir, ['config', 'user.name', 'fixture'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  return dir
}

function writeIn(dir, rel, body) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, body, 'utf8')
}

// ---------------------------------------------------------------- 例 0
test('0 __test__ 导出锚点齐全 + import 零副作用(§22c/§22d)', () => {
  for (const k of [
    'BANNER_ID',
    'BANNER_LINES',
    'LEGACY_BANNER_LINES',
    'SKIP_DIRS',
    'SKIP_FILES',
    'BINARY_EXT',
    'classifyText',
    'hasVisibleBanner',
    'isPureZwLine',
    'zwCount',
  ]) {
    assert.ok(k in WM, `watermark.mjs 的 __test__ 缺锚点 ${k}`)
  }
  for (const k of ['stripText', 'splitLines', 'joinLines', 'isPayloadOnlyLine', 'runStrip']) {
    assert.ok(k in STRIP, `watermark-strip-payload.mjs 的 __test__ 缺锚点 ${k}`)
  }
  // import 到这里没把任一 CLI 跑起来(那会去扫真仓并派生 git)—— 上面若真有产出即错
  assert.equal(zwCount(WM.BANNER_LINES.join('\n')), 0, 'v2 横幅模板自身不得含零宽字符')
  assert.notEqual(LEGACY2, NEW2, '旧措辞必须与新措辞可分,否则升级判据无牙')
})

// ---------------------------------------------------------------- 例 1 兼容矩阵
test('1 兼容矩阵:v2=current / v1=legacy / 损坏=legacyCorrupt / 裸横幅=current(绝不 missing)', () => {
  const body = 'export const x = 1\nconsole.log(x)\n'
  const cases = [
    ['current(仅两行 v2 横幅)', `// ${WM.BANNER_LINES[0]}\n// ${NEW2}\n${body}`, 'current'],
    ['legacy(v1 三行 + L3 尾行)', legacyBanner('// ') + body + `// ${PAY}\n`, 'legacy'],
    ['legacy(只有载荷行、无尾行)', legacyBanner('// ') + body, 'legacy'],
    [
      'current(剥掉载荷后只剩两行 —— v1 眼里的"残迹"在 v2 是合法终态)',
      `// ${WM.BANNER_LINES[0]}\n// ${LEGACY2}\n${body}`,
      'current',
    ],
    ['missing(什么都没有)', body, 'missing'],
  ]
  for (const [name, text, want] of cases) {
    assert.equal(WM.classifyText(text).state, want, `${name} 应判 ${want}`)
  }
  // 载荷损坏档:哨兵成对、解得出字符串,但明文不符
  const corrupt = legacyBanner('// ').replace(
    `[${WM.BANNER_ID}]:${PAY}`,
    `[${WM.BANNER_ID}]:${BAD_PAYLOAD}`,
  )
  assert.notEqual(corrupt, legacyBanner('// '), '夹具必须真的换掉载荷,否则本例什么都没测')
  assert.equal(
    WM.classifyText(corrupt + body).state,
    'legacyCorrupt',
    '损坏载荷必须单独成档(不得并档去决定退出码)',
  )
  // **两种失效都不许出现**:v1 不得被静默放过成 current,也不得被静默判红成 missing
  assert.notEqual(WM.classifyText(legacyBanner('// ') + body).state, 'current')
  assert.notEqual(WM.classifyText(legacyBanner('// ') + body).state, 'missing')
})

// ---------------------------------------------------------------- 例 2 纯函数剥离
test('2 stripText 只动横幅行:非横幅区域字符多重集全等(异形尺子)', () => {
  const src =
    legacyBanner('// ') +
    `const a = 'keep${ZW.slice(1, 2)}this'\n` +
    `} // ${ZW}\n` +
    'function f(){return 2}\n' +
    `// ${ZW}\n`
  const { text, stats } = STRIP.stripText(src)
  // 异形尺子:先把两代措辞归一,再各自按**本测试自己的**判据(剥零宽 + 剥注释符)删行,
  // 然后比字符多重集 —— 全程不复用 strip 里那条正则类。
  const norm = (t) => rulerDropSet(t.replace(LEGACY2, NEW2).split(/[\r\n]+/)).join('|')
  const multiset = (s) => [...s].sort().join('')
  assert.equal(multiset(norm(text)), multiset(norm(src)), '非横幅区域的字符多重集被改动')
  assert.equal(stats.payloadLines, 1)
  assert.equal(stats.tailLines, 1)
  assert.equal(stats.lineRewrites, 1)
  // 内容型 / 尾随在代码后的零宽必须原样活着
  assert.ok(text.includes(`'keep${ZW.slice(1, 2)}this'`), '字符串字面量零宽被误删')
  assert.ok(text.includes(`} // ${ZW}`), '`} // <载荷>` 被整行删除会连带删掉 `}`')
  assert.equal(STRIP.stripText(text).stats.changed, false, '第二次 strip 必须零改动(幂等)')
})

// ---------------------------------------------------------------- 例 3 EOL 与 BOM
test('3 CRLF / 混合 EOL / BOM 一律逐行原样(绝不静默归一)', () => {
  const crlf = (legacyBanner('// ') + 'const a = 1\r\nconst b = 2\r\n' + `// ${ZW}\r\n`).replaceAll(
    '\n',
    '\r\n',
  )
  const { text } = STRIP.stripText(crlf)
  assert.ok(text.endsWith('\r\n'), 'CRLF 文件不得被改成 LF 结尾')
  assert.equal(
    text.split('\n').filter((l) => l.length > 0 && !l.endsWith('\r')).length,
    0,
    '每一行都必须保持 \\r 结尾',
  )
  const mixed = legacyBanner('// ') + 'a\nb\r\nc\n' + `// ${ZW}\n`
  assert.ok(STRIP.stripText(mixed).text.includes('a\nb\r\nc\n'), '混合 EOL 必须逐行保留')
  const bom = BOM + legacyBanner('// ') + 'x\n'
  assert.ok(STRIP.stripText(bom).text.startsWith(BOM), 'BOM 不得被剥离(那是横幅之外的字节)')
})

// ---------------------------------------------------------------- 例 4 端到端
test('4 端到端 --root 临时仓:dry-run 零写盘;apply 后 git 自己的 diff = 每文件 +1/-3', () => {
  const dir = mkRepo('wm-strip-e2e-')
  try {
    const fixtures = {
      'src/a.ts': legacyBanner('// ') + 'export const x = 1\nconsole.log(x)\n' + `// ${ZW}\n`,
      'src/b.py': legacyBanner('# ') + 'x = 1\n' + `# ${ZW}\n`,
      'src/c.css': `/*\n  ${WM.BANNER_LINES[0]}\n  ${LEGACY2}\n  [${WM.BANNER_ID}]:${ZW}\n*/\nbody{margin:0}\n/* ${ZW} */\n`,
      'docs/d.md': `<!--\n  ${WM.BANNER_LINES[0]}\n  ${LEGACY2}\n  [${WM.BANNER_ID}]:${ZW}\n-->\n# T\n<!-- ${ZW} -->\n`,
      'db/e.sql': legacyBanner('-- ') + 'SELECT 1;\n' + `-- ${ZW}\n`,
      [`src/keep.ts`]:
        legacyBanner('// ') + `const s = 'a${ZW.slice(1, 2)}b'\n} // ${ZW}\n` + `// ${ZW}\n`,
      'src/v2.ts': `// ${WM.BANNER_LINES[0]}\n// ${NEW2}\nexport const ok = 1\n`,
    }
    for (const [rel, body] of Object.entries(fixtures)) writeIn(dir, rel, body)
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'fixtures'])

    const dry = cli(STRIP_CLI, ['--root', dir, '--json'])
    assert.equal(dry.status, 0, dry.stderr)
    const rep = JSON.parse(dry.stdout)
    assert.equal(rep.mode, 'dry-run')
    assert.equal(rep.files, 6, `应点名 6 个 v1 夹具(v2 那份不算),实得 ${rep.files}`)
    assert.equal(rep.written, 0)
    for (const [rel, body] of Object.entries(fixtures)) {
      assert.equal(readFileSync(join(dir, rel), 'utf8'), body, `dry-run 改了盘:${rel}`)
    }

    const ap = cli(STRIP_CLI, ['--root', dir, '--apply', '--json'])
    assert.equal(ap.status, 0, ap.stderr)
    const rep2 = JSON.parse(ap.stdout)
    assert.equal(rep2.written, rep2.files)
    assert.equal(rep2.failed, 0)
    // 产出面复量(不是"改前-已删"的恒等式)
    assert.equal(rep2.payloadLinesRemaining, 0, '落地后不得再有载荷行')
    assert.equal(rep2.pureZwLinesRemaining, 0, '落地后不得再有纯零宽行')
    assert.ok(rep2.gluedPayloadLines > 0, '粘在代码行上的载荷必须被单独归桶(否则与内容型混计)')

    // 异形尺子:git 自己的 diff 引擎
    const numstat = git(dir, ['diff', '--numstat'])
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('\t'))
    assert.equal(numstat.length, 6, `diff 应命中 6 个文件:${numstat.map((n) => n[2]).join(',')}`)
    for (const [, , f] of numstat) {
      const row = numstat.find(([, , x]) => x === f)
      assert.deepEqual(
        [Number(row[0]), Number(row[1])],
        [1, 3],
        `${f} 的 diff 规模应为 +1/-3,实得 ${row}`,
      )
    }
    const unified = git(dir, ['diff', '--unified=0', '--', 'src/a.ts']).split('\n')
    const removed = unified.filter((l) => l.startsWith('-') && !l.startsWith('---'))
    const added = unified.filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    assert.equal(added.length, 1, '新增行必须只有新措辞那一条')
    assert.ok(added[0].includes(NEW2), `新行应是 v2 措辞:${added[0]}`)
    assert.equal(removed.length, 3, `删除行应为 旧措辞/载荷行/尾行 三条:${removed.join(' | ')}`)
    assert.ok(
      removed.every((l) => /Provenance-watermarked|IHUI-AI-PROVENANCE/.test(l) || zwCount(l) > 0),
      '被删的行必须全部属于横幅区',
    )
    assert.ok(
      readFileSync(join(dir, 'src/keep.ts'), 'utf8').includes(`'a${ZW.slice(1, 2)}b'`),
      '内容型零宽被删',
    )
    assert.ok(!numstat.some(([, , f]) => f === 'src/v2.ts'), '已是 v2 的文件不得被动')

    const rep3 = JSON.parse(cli(STRIP_CLI, ['--root', dir, '--apply', '--json']).stdout)
    assert.equal(rep3.files, 0, '第二次 apply 必须零改动(幂等)')
  } finally {
    rmScratch(dir)
  }
})

// ---------------------------------------------------------------- 例 5 脏文件
test('5 脏文件保护:批量档跳过工作树≠索引者,点名档才可动在飞文件', () => {
  const dir = mkRepo('wm-strip-dirty-')
  try {
    const body = legacyBanner('// ') + 'export const v = 1\n' + `// ${ZW}\n`
    writeIn(dir, 'src/clean.ts', body)
    writeIn(dir, 'src/dirty.ts', body)
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'fixtures'])
    writeIn(dir, 'src/dirty.ts', body + 'export const addedBySomeoneElse = 2\n')

    const rep = JSON.parse(cli(STRIP_CLI, ['--root', dir, '--json']).stdout)
    assert.ok(rep.skippedDirty >= 1, `脏文件应被计数,实得 ${rep.skippedDirty}`)
    assert.equal(rep.files, 1, `只有干净那份被处理,实得 ${rep.files}`)
    const dirtyNow = readFileSync(join(dir, 'src/dirty.ts'), 'utf8')
    assert.ok(dirtyNow.includes('addedBySomeoneElse'), '脏文件被写了 ⇒ 会连带改写别人的在飞改动')
    assert.ok(dirtyNow.includes(`[${WM.BANNER_ID}]:`), '脏文件按设计保持原样')

    const rep2 = JSON.parse(
      cli(STRIP_CLI, ['--root', dir, '--paths', 'src/dirty.ts', '--apply', '--json']).stdout,
    )
    assert.equal(rep2.files, 1)
    const after = readFileSync(join(dir, 'src/dirty.ts'), 'utf8')
    assert.ok(after.includes('addedBySomeoneElse'), '点名档也不得吃掉别人的在飞行')
    assert.ok(!after.includes(`[${WM.BANNER_ID}]:`))
  } finally {
    rmScratch(dir)
  }
})

// ---------------------------------------------------------------- 例 6 排除面
test('6 第三方排除面优先于 --paths:被台账登记的许可原文不得被"顺手改行"', () => {
  const dir = mkRepo('wm-strip-excl-')
  try {
    const rel = 'vendor/LICENSE.md'
    const body = legacyBanner('// ') + 'Permission is hereby granted, free of charge.\n'
    writeIn(dir, rel, body)
    writeIn(dir, 'src/a.ts', legacyBanner('// ') + 'export const x = 1\n')
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'f'])
    const blocked = { isExcluded: (r) => r === rel }
    const rep = STRIP.runStrip({
      root: dir,
      paths: [rel],
      applied: true,
      exclusion: blocked,
      dirty: null,
    })
    assert.equal(rep.excludedThirdParty, 1)
    assert.equal(rep.files, 0)
    assert.equal(readFileSync(join(dir, rel), 'utf8'), body, '排除面失守:第三方内容被改写')
  } finally {
    rmScratch(dir)
  }
})

// ---------------------------------------------------------------- 例 7 空枚举 / 未判定
test('7 枚举为空 ⇒ 报 0(与"都干净"可分);非仓库 ⇒ exit 2 未判定,不得报成通过', () => {
  const dir = mkRepo('wm-strip-empty-')
  try {
    const rep = JSON.parse(cli(STRIP_CLI, ['--root', dir, '--json']).stdout)
    assert.equal(rep.enumerated, 0, '空仓枚举必须报 0')
    assert.equal(rep.files, 0)
    const notRepo = mkScratch('wm-strip-notrepo-')
    try {
      const bad = cli(STRIP_CLI, ['--root', notRepo, '--json'])
      assert.equal(bad.status, 2, `非仓库应 exit 2(未判定),实得 ${bad.status}:${bad.stdout}`)
      assert.match(bad.stderr + bad.stdout, /无法判定|拒绝/)
    } finally {
      rmScratch(notRepo)
    }
  } finally {
    rmScratch(dir)
  }
})

// ---------------------------------------------------------------- 例 8 inject 产出面
test('8 inject 产出的 v2 横幅零隐写;v1 文件 inject 即升级(逐码位复量)', () => {
  const dir = mkRepo('wm-inject-')
  try {
    writeIn(dir, 'plain.ts', 'export const p = 1\n')
    const r1 = cli(WM_CLI, ['inject', join(dir, 'plain.ts')])
    assert.equal(r1.status, 0, r1.stderr)
    const body = readFileSync(join(dir, 'plain.ts'), 'utf8')
    assert.equal(zwCount(body), 0, 'v2 注入结果必须一个零宽字符都没有')
    assert.ok(!body.includes(`[${WM.BANNER_ID}]:`), '不得再产出载荷行')
    assert.ok(body.includes(NEW2) && body.includes(WM.BANNER_LINES[0]))
    assert.ok(body.endsWith('export const p = 1\n'), '正文必须原样在后')
    assert.equal((body.match(/Provenance-watermarked/g) || []).length, 1, '不得产出双横幅')
    assert.match(cli(WM_CLI, ['inject', join(dir, 'plain.ts')]).stdout, /skip-done/)
    assert.equal(readFileSync(join(dir, 'plain.ts'), 'utf8'), body, '二次 inject 不得改字节')

    writeIn(dir, 'legacy.ts', legacyBanner('// ') + 'export const y = 2\n' + `// ${ZW}\n`)
    const up = cli(WM_CLI, ['inject', join(dir, 'legacy.ts')])
    assert.match(up.stdout, /upgraded/, up.stdout + up.stderr)
    const after = readFileSync(join(dir, 'legacy.ts'), 'utf8')
    assert.equal(zwCount(after), 0, '升级后仍留零宽 ⇒ 旧格式没被清')
    assert.ok(!after.includes(LEGACY2), '旧措辞必须被换掉')
    assert.ok(after.includes('export const y = 2'))
  } finally {
    rmScratch(dir)
  }
})

// ---------------------------------------------------------------- 例 9 两份清单互补
test('9 list-uncovered 只含缺口(不含待升级)+ list-legacy 互补 + 统计行同轮产出', () => {
  const dir = mkRepo('wm-list-')
  try {
    writeIn(dir, 'plain.ts', 'export const p = 1\n')
    writeIn(dir, 'legacy.ts', legacyBanner('// ') + 'export const l = 1\n')
    writeIn(dir, 'v2.ts', `// ${WM.BANNER_LINES[0]}\n// ${NEW2}\nexport const v = 1\n`)
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'f'])
    // 用**显式 scope**(绝对路径点名)而不是全量扫:全量档的 ROOT 是本脚本所在仓,
    // 拿它去验临时夹具会静默扫真仓(守门 70 那 13/14 恒红的同一型)。
    const abs = ['plain.ts', 'legacy.ts', 'v2.ts'].map((f) => join(dir, f))

    const lines = cli(WM_CLI, ['list-uncovered', ...abs])
      .stdout.split('\n')
      .filter(Boolean)
    const statLine = lines.find((l) => l.startsWith('#watermark-stats '))
    const gaps = lines.filter((l) => !l.startsWith('#'))
    assert.ok(statLine, '必须同轮输出统计行(否则门禁要为它再全量扫一遍)')
    const stats = JSON.parse(statLine.slice('#watermark-stats '.length))
    assert.equal(stats.total, 3, `scope 应恰含 3 个夹具,实得 ${stats.total}`)
    assert.ok(stats.legacy >= 1, '待升级数必须可见')
    assert.ok(
      !gaps.some((g) => g.includes('legacy.ts')),
      'v1 待升级不得进自愈清单 —— 否则 11k 文件同时落进一次提交(顶爆 MAX_AUTOFIX ⇒ 恒红)',
    )
    const legacyList = cli(WM_CLI, ['list-legacy', ...abs])
      .stdout.split('\n')
      .filter(Boolean)
    assert.ok(
      legacyList.some((l) => l.includes('legacy.ts')),
      'list-legacy 与 list-uncovered 必须互补',
    )
    assert.ok(!legacyList.some((l) => l.includes('plain.ts')))
    assert.ok(!gaps.some((g) => g.includes('v2.ts')), 'v2 已达标不得被算成缺口(新格式不得判红)')
    assert.ok(
      gaps.some((g) => g.includes('plain.ts')),
      `真缺口必须被点名:${JSON.stringify(gaps)}`,
    )
    // 缺口档判红、待升级档不判红:退出码是这两句话的唯一差别
    assert.equal(
      cli(WM_CLI, ['verify', join(dir, 'legacy.ts'), join(dir, 'v2.ts')]).status,
      0,
      '只有待升级 ⇒ verify 不得红',
    )
    assert.equal(cli(WM_CLI, ['verify', join(dir, 'plain.ts')]).status, 1, '真缺口 ⇒ verify 必须红')
  } finally {
    rmScratch(dir)
  }
})

// ---------------------------------------------------------------- 例 10 真仓不恒红
test('10 真仓现读:verify 与覆盖守门都不得因"待升级存量"变红,且必须把数量喊出来', () => {
  const v = cli(WM_CLI, ['verify'])
  assert.match(v.stdout, /待升级/)
  assert.match(v.stdout, /零宽字符实数/)
  // 工作树里仍大面积存在 v1 ⇒ 这里 exit 1 就是一台与任何提交无关的恒红门(§12e)。
  assert.equal(v.status, 0, `verify 因存量判红 ⇒ 恒红门:\n${v.stdout.slice(-1500)}`)
  const cov = cli(COV_CLI, ['--no-fix'])
  assert.equal(
    cov.status,
    0,
    `覆盖守门判红:\n${cov.stdout.slice(-1200)}\n${cov.stderr.slice(-600)}`,
  )
  assert.match(cov.stdout, /待升级|未判定/)
})

// ---------------------------------------------------------------- 例 11 装车与反向锁
test('11 装车证明:覆盖守门仍在提交链;剥离器刻意不接提交链', () => {
  const runner = readFileSync(join(SCRIPTS, 'guardian-runner.mjs'), 'utf8')
  assert.match(runner, /check-watermark-coverage\.mjs/, '覆盖守门被摘线 ⇒ 其余断言都无意义')
  assert.equal(
    /watermark-strip-payload/.test(runner),
    false,
    '剥离器不得出现在 guardian-runner(它是一次性人工工具,挂每次提交就是恒红门)',
  )
  assert.ok(existsSync(STRIP_CLI), '剥离器脚本本体必须在位')
  const wmSrc = readFileSync(WM_CLI, 'utf8')
  assert.match(
    wmSrc,
    /export const __test__ = \{[\s\S]*classifyText,/,
    'classifyText 必须 export 给镜像测试',
  )
  assert.match(wmSrc, /list-legacy/, 'list-legacy 出口必须在位(否则待升级没有可消费的清单)')
  assert.match(wmSrc, /#watermark-stats/, '统计行必须与缺口清单同轮产出')
  const covSrc = readFileSync(COV_CLI, 'utf8')
  assert.match(covSrc, /MAX_AUTOFIX/, '单次缺口安全闸不得被摘')
  assert.match(covSrc, /#watermark-stats/, '守门必须解析统计行,而不是再扫一遍')
})

// ---------------------------------------------------------------- 例 12 措辞与许可证一致
test('12 v2 横幅不再宣称"可被溯源追责"(纯 Apache-2.0 口径),旧措辞只留在识别表里', () => {
  assert.doesNotMatch(WM.BANNER_LINES.join('\n'), /追责/)
  assert.match(WM.BANNER_LINES.join('\n'), /Apache-2\.0/)
  assert.match(WM.BANNER_LINES.join('\n'), /aizhs\.top/, '归属 URL 必须在可见横幅里')
  assert.match(WM.LEGACY_BANNER_LINES[1], /溯源追责/)
  const src = readFileSync(WM_CLI, 'utf8')
  const arr = (name) => {
    const i = src.indexOf(`const ${name} = [`)
    assert.ok(i > 0, `源里必须存在 const ${name} = [`)
    return src.slice(i, src.indexOf('\n]', i))
  }
  assert.doesNotMatch(arr('BANNER_LINES'), /溯源追责/, '生成模板里不得再写回旧措辞')
  assert.match(
    arr('LEGACY_BANNER_LINES'),
    /溯源追责/,
    '识别表必须仍留着旧措辞,否则 v1 文件会被判成"无横幅"缺口',
  )
})

// ---------------------------------------------------------------- 例 13 测试自身卫生
test('13 反向自证:本测试文件与两份源文件自身都不含 Cf 零宽字符', () => {
  for (const f of [fileURLToPath(import.meta.url), WM_CLI, STRIP_CLI, COV_CLI]) {
    const n = zwCount(readFileSync(f, 'utf8'))
    assert.equal(n, 0, `${f} 里仍有 ${n} 个零宽字符 —— 工具与它的测试不得自带要删的东西`)
  }
})
