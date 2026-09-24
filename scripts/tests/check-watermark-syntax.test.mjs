// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/check-watermark-syntax.test.mjs
/**
 * 守门「溯源水印语法」的 §22c 镜像测试(2026-09-24 判据缺陷修复配套)。
 *
 * 跑法:node --test scripts/tests/check-watermark-syntax.test.mjs
 *
 * 纪律:
 *  - §22c/§22d:本文件**不复制任何判据实现**,只 import 源脚本的 `__test__`;
 *    源脚本 main() 受 isDirectRun 守护,import 时零副作用(第 0 例即钉这一点)。
 *  - 端到端取证一律在**独立临时 git 仓库**里做,并显式注入 `--root`。
 *    本仓实证教训:自测只 `process.chdir` 会静默扫真仓(14 例 13 红且无人发现)。
 *  - 夹具**不写死任何存量仓库路径**(同一票里删条目会让自测变红)。
 *  - 零宽字符一律由码点构造(`zwOf`),测试源码自身不留 Cf 类不可见字符 ——
 *    否则这份测试自己就是它所验证的那类"会被文本级改写静默损坏"的文件。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as W } from '../check-watermark-syntax.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-watermark-syntax.mjs')
/** 夹具落点:项目内 .ihui-agent/tmp(AGENTS §15,已被 .gitignore 忽略)。 */
const TMP_ROOT = join(REPO, '.ihui-agent', 'tmp', 'wm-syntax')

const ZW_CHARS = W.INVISIBLE_CODEPOINTS.map((c) => String.fromCharCode(c))
/** 一条与 watermark.mjs 同形态的零宽载荷(哨兵 + 载荷 + 哨兵)。 */
const zwOf = () => `${ZW_CHARS[3]}${ZW_CHARS[0]}${ZW_CHARS[1]}${ZW_CHARS[2]}${ZW_CHARS[3]}`
const ZW = zwOf()
const BANNER = '© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top'
const PROVENANCE_LINE = `// [IHUI-AI-PROVENANCE]:${ZW}`

/** 临时 git 仓:自带 HEAD 提交,与真仓完全隔离。 */
function mkRepo() {
  mkdirSync(TMP_ROOT, { recursive: true })
  const dir = mkdtempSync(join(TMP_ROOT, 'repo-'))
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.email', 't@example.invalid'])
  git(dir, ['config', 'user.name', 'fixture'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  return dir
}

function git(cwd, args) {
  return execFileSync(gitBin(), ['-c', 'safe.directory=*', '-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
    timeout: 60000,
    windowsHide: true,
  })
}
let _gitBin
function gitBin() {
  if (_gitBin) return _gitBin
  for (const c of [process.env.GIT_BIN, 'git']) {
    if (!c) continue
    try {
      execFileSync(c, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000, windowsHide: true })
      _gitBin = c
      return c
    } catch {
      /* 试下一个候选 */
    }
  }
  throw new Error('git 不可用,无法做端到端取证')
}

/** 写文件并提交进 HEAD(即"进入版本树")。`--force` 用于把被 gitignore 的路径也纳入。 */
function commitFile(dir, rel, content, { force = false } = {}) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, 'utf8')
  git(dir, ['add', ...(force ? ['-f'] : []), '--', rel])
  git(dir, ['commit', '-q', '-m', `fixture: ${rel}`])
}

/** 跑真 CLI,返回 { code, out }。业务失败(1)/脚本异常(2)都以 exit code 呈现。 */
function run(args, cwd) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 26,
      timeout: 180000,
      windowsHide: true,
      cwd: cwd || REPO,
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e?.status ?? -1, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
  }
}

const judge = (text, ext, rel = `x${ext}`) => W.judgeText(text, W.styleFor(rel), rel)

// ───────────────────────────── 判据单元测试(正反成对) ─────────────────────────────

test('0 __test__ 导出锚点齐全 + import 零副作用(§22c/§22d)', () => {
  for (const key of [
    'INVISIBLE_CODEPOINTS',
    'INVISIBLE_RE',
    'mayCarryMark',
    'isBannerLine',
    'styleFor',
    'isAuditCandidate',
    'maskTokensFor',
    'regexLiteralStarts',
    'maskHidden',
    'visibleSlice',
    'checkMarkedLines',
    'checkXmlDecl',
    'judgeText',
    'headPaths',
    'stagedPaths',
    'readIndexBlob',
    'main',
  ]) {
    assert.ok(key in W, `__test__ 缺少导出键 ${key}`)
  }
  assert.equal(typeof W.main, 'function')
  // 码点集合是判据的唯一真相:四个 Cf 字符,一个不多一个不少
  assert.deepEqual(W.INVISIBLE_CODEPOINTS, [0x200b, 0x200c, 0x200d, 0x2060])
})

test('1 R1 阳性:源码非注释位的裸零宽载荷必红(本门要防的第一类真问题)', () => {
  const issues = judge(`const a = 1 ${ZW}\nconst b = 2\n`, '.ts')
  assert.equal(issues.length, 1)
  assert.match(issues[0], /:1\s+\[裸零宽载荷行\(未注释包裹\)\]/)
})

test('2 R1 阴性:同一载荷写在行注释里即合法', () => {
  assert.deepEqual(judge(`// ${ZW}\n`, '.ts'), [])
  assert.deepEqual(judge(`# ${ZW}\n`, '.py'), [])
  assert.deepEqual(judge(`-- ${ZW}\n`, '.sql'), [])
})

test('3 阴性:正则字面量内部的零宽不判红(check-gate-wiring.mjs:171 同型假阳性)', () => {
  const src = `const ZERO_WIDTH_RE = /[${ZW}]/g\nconsole.log(ZERO_WIDTH_RE.test('a'))\n`
  assert.deepEqual(judge(src, '.mjs'), [])
  // 且必须是真的"被掩码掉",而不是整行含引号就不判:剥掉正则外壳后同一载荷仍判红
  assert.equal(judge(`const ZERO_WIDTH_RE = [${ZW}]\n`, '.mjs').length, 1)
})

test('4 阴性:测试夹具字符串内部的零宽不判红(check-gate-wiring.test.mjs:137/139 同型)', () => {
  const src = `assert.deepEqual(G.f('集成${ZW}位置: pre-commit'), ['集成位置'])\n`
  assert.deepEqual(judge(src, '.mjs'), [])
  assert.deepEqual(judge(`const s = "载荷 ${ZW} 结尾"\n`, '.js'), [])
})

test('5 阴性:watermark.mjs 注入的 L3 尾行五种风格一律合法', () => {
  const styles = { '.ts': `// ${ZW}`, '.py': `# ${ZW}`, '.sql': `-- ${ZW}`, '.css': `/* ${ZW} */`, '.md': `<!-- ${ZW} -->` }
  for (const [ext, tail] of Object.entries(styles)) {
    assert.deepEqual(judge(`const x = 1\n\n${tail}\n`, ext), [], `${ext} 的 L3 尾行被判红`)
  }
  // 横幅 L1/L2 整块(块注释形态)同样合法
  assert.deepEqual(judge(`/*\n${BANNER}\nProvenance-watermarked. x\n${PROVENANCE_LINE}\n*/\n`, '.css'), [])
})

test('6 阴性:L3 尾行被格式化并到末行代码尾部(} // <载荷>)亦合法', () => {
  assert.deepEqual(judge(`  return parts.join('\\n')\n} // ${ZW}\n`, '.ts'), [])
  assert.deepEqual(judge(`exit 0\n# ${ZW}\n`, '.sh'), [])
})

test('7 阳性对照:同一行少了注释前缀(} <载荷>)必须判红 —— 第 6 例并非整行放过', () => {
  assert.equal(judge(`  return 1\n} ${ZW}\n`, '.ts').length, 1)
})

test('8 阴性:多行模板串内的横幅/载荷合法,且模板串结束后状态机不错位(真仓回归)', () => {
  const src = [
    'const SVG = `<!--',
    `  ${BANNER}`,
    `  ${PROVENANCE_LINE}`,
    '-->',
    '<svg xmlns="http://www.w3.org/2000/svg" />`',
    `const bare = 1 ${ZW}`,
  ].join('\n')
  const issues = judge(src, '.tsx')
  assert.equal(issues.length, 1, `期望只有模板串**外**那一行判红,实得 ${JSON.stringify(issues)}`)
  assert.match(issues[0], /:6 /)
})

test('9 阴性:JSX 文本里的孤立撇号不得吞掉后一行的真违规', () => {
  const src = ["export function T() {", "  return <Text>Don't panic</Text>", `} ${ZW}`, '}'].join('\n')
  assert.equal(judge(src, '.tsx').length, 1)
})

test('10 R2:XML 声明必须仍是首个非空行(判据一字未改)', () => {
  const xml = (lines) => judge(lines.join('\n'), '.xml')
  // 合法:声明在首,注释横幅在后(watermark.mjs 的注入次序正是如此)
  assert.deepEqual(xml(['<?xml version="1.0"?>', '<!--', BANNER, '-->', '<root/>']), [])
  // 违规:声明被挤到第二行(报文按旧约定点名"首个非空行"那一行,即 :1)
  const off = xml(['<root/>', '<?xml version="1.0"?>'])
  assert.equal(off.length, 1)
  assert.match(off[0], /:1\s+\[XML 声明非首个非空行/)
  // 违规:注释块插在声明之前(声明就不再是首个非空行)
  assert.equal(xml(['<!-- x -->', '<?xml version="1.0"?>', '<root/>']).length, 1)
  // 非 .xml 文件不参与 R2
  assert.deepEqual(judge('<root/>\n<?xml version="1.0"?>\n', '.md'), [])
})

test('11 按风格取注释符号:md 正文里的 `#` / `--` 不是注释', () => {
  assert.equal(judge(`标题行\n# 小节 ${ZW}\n`, '.md').length, 1, 'md 的 `#` 是标题不是注释')
  assert.deepEqual(judge(`<!-- 小节 ${ZW} -->\n`, '.md'), [], 'md 只有 html 注释算包裹')
  assert.deepEqual(judge(`SELECT 1 -- 注 ${ZW}\n`, '.sql'), [], 'sql 的 `--` 是行注释')
})

test('12 粗筛 ≠ 精判:正文里的 © 一词不得被判成横幅行(本轮真踩过的假阳)', () => {
  assert.deepEqual(judge(`> © 2026 **IHUI AI (智汇AI)** · 版权所有者\n`, '.md'), [])
  assert.equal(W.mayCarryMark('© 2026 引述'), true, '粗筛应命中(证明下一断言真的走过了筛选)')
  assert.equal(W.isBannerLine('> © 2026 **IHUI AI (智汇AI)**'), false)
})

test('13 isAuditCandidate:清单过滤口径与旧实现一致(锁文件/二进制/无注释风格不参与)', () => {
  assert.equal(W.isAuditCandidate('pnpm-lock.yaml'), false)
  assert.equal(W.isAuditCandidate('apps/web/src/a.ts'), true)
  assert.equal(W.isAuditCandidate('a.json'), false, '.json 无注释风格,不纳入')
  assert.equal(W.isAuditCandidate('node_modules/x/a.ts'), false)
  assert.equal(W.isAuditCandidate('x/dist/a.ts'), false)
})

// ───────────────────────────── 端到端取证(独立临时 git 仓) ─────────────────────────────

test('14 端到端 · 取材面跟随版本树:被 gitignore 的本地产物含裸零宽也不进清单', () => {
  const dir = mkRepo()
  commitFile(dir, 'a.ts', `const a = 1\n`)
  commitFile(dir, '.gitignore', `ignored/\n`)
  // 只落磁盘、不入版本树(与真仓 .trae/bundle-check.js、mobile-cap/_next 同一形态)
  mkdirSync(join(dir, 'ignored'), { recursive: true })
  writeFileSync(join(dir, 'ignored', 'xx.js'), `const dirty = 1 ${ZW}\n`, 'utf8')
  const clean = run(['--root', dir], dir)
  assert.equal(clean.code, 0, `被忽略的本地产物不应计入违规:${clean.out}`)
  assert.match(clean.out, /取材=版本树 HEAD/)
  // 反面对照:同一文件**一旦进入版本树就必须红** —— 证明红点消失源于口径而非"文件不存在"
  git(dir, ['add', '-f', '--', 'ignored/xx.js'])
  git(dir, ['commit', '-q', '-m', 'fixture: 把本地产物纳入版本树'])
  const dirty = run(['--root', dir], dir)
  assert.equal(dirty.code, 1, `纳入版本树后必须判红:${dirty.out}`)
  assert.match(dirty.out, /ignored\/xx\.js:1/)
})

test('15 端到端 · --staged 只判索引 blob:索引干净 + 工作区脏 ⇒ 必绿', () => {
  const dir = mkRepo()
  commitFile(dir, 'b.ts', `const b = 1\n`)
  // 工作区改脏(裸零宽),但**不 git add**
  writeFileSync(join(dir, 'b.ts'), `const b = 1 ${ZW}\n`, 'utf8')
  const stagedClean = run(['--staged', '--root', dir], dir)
  assert.equal(stagedClean.code, 0, `索引干净必须绿:${stagedClean.out}`)
  assert.match(stagedClean.out, /取材=--staged 暂存区 清单=0/, '无暂存内容时必须如实报"清单=0"并绿')
  // 同一时刻的全量模式读**工作区副本**(清单仍取自版本树)⇒ 脏盘即红 ——
  // 这正是 pre-commit 必须走 --staged 的理由:门只为"进入索引的内容"负责。
  assert.equal(run(['--root', dir], dir).code, 1)
  // git add 之后:同一份内容进入索引 ⇒ 必须红
  git(dir, ['add', '--', 'b.ts'])
  const stagedDirty = run(['--staged', '--root', dir], dir)
  assert.equal(stagedDirty.code, 1, `索引里带裸零宽必须红:${stagedDirty.out}`)
  assert.match(stagedDirty.out, /b\.ts:1/)
})

test('16 端到端 · --staged 不"名字叫 staged 其实扫工作树":HEAD 脏而暂存干净 ⇒ 必红的是全量', () => {
  const dir = mkRepo()
  commitFile(dir, 'c.ts', `const c = 1 ${ZW}\n`) // 违规已在 HEAD 里
  git(dir, ['commit', '-q', '--allow-empty', '-m', 'no-op'])
  const staged = run(['--staged', '--root', dir], dir)
  assert.equal(staged.code, 0, `暂存集为空时不得替 HEAD 的存量债负责:${staged.out}`)
  const full = run(['--root', dir], dir)
  assert.equal(full.code, 1, `全量模式必须抓到进入版本树的那处裸零宽:${full.out}`)
  assert.match(full.out, /c\.ts:1/)
})

test('17 端到端 · 无 HEAD / 非 git 目录一律 exit 2,绝不静默报绿', () => {
  const dir = mkRepo() // 有 .git 但零提交
  const noHead = run(['--root', dir], dir)
  assert.equal(noHead.code, 2, `未提交仓库必须异常退出:${noHead.out}`)
  assert.doesNotMatch(noHead.out, /全部通过/)
  mkdirSync(TMP_ROOT, { recursive: true })
  const plain = mkdtempSync(join(TMP_ROOT, 'plain-'))
  writeFileSync(join(plain, 'a.ts'), `const a = 1 ${ZW}\n`, 'utf8')
  assert.equal(run(['--root', plain], plain).code, 2, '非 git 目录同样不得报绿')
})

test('18 端到端 · 真违规进版本树 ⇒ 全量与 --staged 双口径都红(判据强度未退化)', () => {
  const dir = mkRepo()
  writeFileSync(join(dir, 'd.ts'), `const d = 1 ${ZW}\n`, 'utf8')
  git(dir, ['add', '--', 'd.ts'])
  const staged = run(['--staged', '--root', dir], dir)
  assert.equal(staged.code, 1, staged.out)
  git(dir, ['commit', '-q', '-m', 'fixture: 真违规'])
  assert.equal(run(['--root', dir], dir).code, 1)
  // XML 声明被挤离首位同样双口径判红
  commitFile(dir, 'e.xml', `<root/>\n<?xml version="1.0"?>\n`)
  const xml = run(['--root', dir], dir)
  assert.equal(xml.code, 1)
  assert.match(xml.out, /e\.xml:1\s+\[XML 声明非首个非空行/)
})

test('19 源脚本自身与真仓:显式文件模式对四处历史假阳性一律绿', () => {
  for (const rel of [
    'scripts/check-gate-wiring.mjs',
    'scripts/tests/check-gate-wiring.test.mjs',
    'apps/api/src/services/login-anomaly-notifier.ts',
    'apps/mobile-rn/src/screens/LoginScreen.tsx',
    'scripts/check-watermark-syntax.mjs',
  ]) {
    assert.ok(existsSync(join(REPO, rel)), `夹具前提:仓库应有 ${rel}`)
    const r = run([rel], REPO)
    assert.equal(r.code, 0, `${rel} 仍被判红:${r.out}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
