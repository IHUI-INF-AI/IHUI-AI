// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ─── 绑定形态 ③(模块直取)接线锁 —— check-i18n-keys.mjs ───────────────────
// 背景(2026-11-05 实测):miniapp-taro 在 HEAD 面有 53 个文件用
//   `import { t } from '@/i18n'`(含 `import { t as 别名 }` 1 枚)拿翻译函数,
//   而 extractHookKeys 此前只认 ①`const { t } = useI18n()` 与 ②`const tt = useTt()`
//   两种绑定 ⇒ 这一族调用点的缺键**结构性隐身**(确证样本:
//   apps/miniapp-taro/src/components/TagInput.tsx:19 的 t('TagInput.p1'),五语包与端内
//   兜底词典都没有,用户在界面上看到裸键名)。
// 接线纪律:新纳面只报数、不进 shouldBlock(AGENTS §12e 恒红门禁令:存量未归零不得升档)。
//
// 关于 §22c「import 源脚本 __test__」的如实交代:
//   scripts/check-i18n-keys.mjs 是一枚**顶层线性脚本**(自述:末尾直接 process.exit(0/1/2),
//   全文件零 export)。在测试里 import 它 = 当场跑完整轮扫描并把测试进程按扫描结论 exit 掉
//   ——那正是"把没判写成判过"的反面(进程被截断却像通过)。把它拆成 scripts/lib/* 或加
//   isDirectRun 守卫都不在本票许可的改动面内(本票只许改 check-i18n-keys.mjs + 新建测试)。
//   所以这里的守法是**更强的那一头**:不复制任何判据,直接用真实 CLI 驱动生产判据本身
//   (夹具 = 临时 git 仓外的 scratch,判定面走门自己的 --worktree 人工档),
//   再加一条只判"接线形状"的源码锁(判的是桶有没有进退出码表达式,不重算键)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-i18n-keys.mjs')

// 夹具:5 语言 key 集合一致、只含 login.save / login.title 的基准词典
const TARO_OK = {
  'zh-CN': { login: { save: '保存', title: '登录' } },
  'zh-TW': { login: { save: '儲存', title: '登入' } },
  ko: { login: { save: '저장', title: '로그인' } },
  ja: { login: { save: 'ストック', title: 'ログイン' } },
  en: { login: { save: 'Save', title: 'Login' } },
}

function mkRoot() {
  return mkScratch('ihui-i18n-direct-')
}

function writeTaroMessages(root, msgs) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'miniapp-taro')
  mkdirSync(dir, { recursive: true })
  for (const [lang, content] of Object.entries(msgs)) {
    writeFileSync(join(dir, `${lang}.json`), JSON.stringify(content, null, 2))
  }
}

function writeTaroSource(root, name, body) {
  const dir = join(root, 'apps', 'miniapp-taro', 'src', 'pages', 'login')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), body)
}

// 判定面:夹具没有 .git ⇒ 语言包/源码只存在于磁盘 ⇒ 用门自己的 --worktree 人工档
// (口径与既有镜像 scripts/tests/check-i18n-keys.test.mjs 的 runScript 一致)。
function runTaro(root, extra = []) {
  return spawnSync('node', [SCRIPT_PATH, '--target=miniapp-taro', '--worktree', ...extra], {
    cwd: root,
    encoding: 'utf8',
    // §12g:本机派生必须显式 stdio,否则 EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const BUCKET_HEAD = /本尺新纳面：直取形态 (\d+) 枚/
const SCOPE_HEAD = /绑定形态③[^:]*射程现读:(\d+) 个文件在用 \/ 引用键 (\d+) 枚/

// ─── 1. 正例:直取形态能被认出(只报数,不判红)────────────────────────
test('正例:import { t } from "@/i18n" 的缺键进新纳面,且不参与退出码', () => {
  const root = mkRoot()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'direct.tsx',
      "import { t } from '@/i18n'\nexport const ph = t('login.ghost')\nexport const ok = t('login.save')\n",
    )
    const r = runTaro(root)
    assert.match(r.stdout, SCOPE_HEAD, `射程现读行必须打印(0 命中也要能分清"量到 0"),stdout: ${r.stdout}`)
    const scope = r.stdout.match(SCOPE_HEAD)
    assert.equal(scope[1], '1', '应命中 1 个直取形态文件')
    assert.equal(scope[2], '2', '应量到 2 枚引用键(含词典里有的那枚)')
    const bucket = r.stdout.match(BUCKET_HEAD)
    assert.ok(bucket, `新纳面条必须点名,stdout: ${r.stdout}`)
    assert.equal(bucket[1], '1', '缺键只该有 login.ghost 一枚')
    assert.match(r.stdout, /'login\.ghost' \(无兜底串/, '必须逐键标出「无兜底串」')
    // 升档隔离:该枚只被报数 ⇒ 整轮仍 exit 0(原有档 parity/missing 都没红)
    assert.equal(r.status, 0, `新纳面不参与退出码,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

// ─── 2. 正例:重命名绑定 t as 别名 ──────────────────────────────────
test('正例:import { t as tGlobal } 的重命名绑定必须被认出来', () => {
  const root = mkRoot()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'aliased.tsx',
      "import { t as tGlobal } from '@/i18n'\nexport const ph = tGlobal('login.ghost')\n",
    )
    const r = runTaro(root)
    const bucket = r.stdout.match(BUCKET_HEAD)
    assert.ok(bucket && bucket[1] === '1', `别名形态该量到 1 枚,stdout: ${r.stdout}`)
    assert.equal(r.status, 0, `重命名形态同样只报数,实际 ${r.status}`)
  } finally {
    rmScratch(root)
  }
})

// ─── 3. 误报防线:type 条目不是运行时绑定 / 非 i18n 模块不射 ──────────
test('不误报:import type { TtFn } 不产生绑定;import { t } 取自非 i18n 模块不入围', () => {
  const root = mkRoot()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'types-only.ts',
      "import type { TtFn } from '@/i18n'\nexport const f: TtFn = (k) => k\nexport const g = f('login.ghost', '兜底')\n",
    )
    writeTaroSource(
      root,
      'foreign.ts',
      "import { t } from 'some-other-lib'\nexport const ph = t('login.ghost')\n",
    )
    const r = runTaro(root)
    const scope = r.stdout.match(SCOPE_HEAD)
    assert.ok(scope, `射程行必须打印,stdout: ${r.stdout}`)
    assert.equal(scope[1], '0', '类型导入与外来库的 t 都不该被算成射程内文件')
    assert.equal(scope[2], '0', '既非射程 ⇒ 引用键 0 枚')
    assert.ok(!BUCKET_HEAD.test(r.stdout), `不该有新纳面条,stdout: ${r.stdout}`)
    assert.equal(r.status, 0, `误报防线不得翻红,实际 ${r.status}`)
  } finally {
    rmScratch(root)
  }
})

// ─── 4. 反向对照:①② 两形态的判序一字未变(仍 exit 1 进缺失键档)──────
test('反向对照:const tt = useTt() 的缺键仍走原有档判红,且不落新纳面', () => {
  const root = mkRoot()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'hook.tsx',
      "const tt = useTt()\nexport const a = tt('login.ghost', '邮箱')\nexport const b = tt('login.save', '保存')\n",
    )
    const r = runTaro(root)
    assert.equal(r.status, 1, `② 形态缺键必须照旧 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /缺失键问题\(1个\)/, `原有档计数口径不得被改动,stdout: ${r.stdout}`)
    assert.match(r.stdout, /'login\.ghost'/, '应点名 login.ghost')
    assert.ok(!BUCKET_HEAD.test(r.stdout), `② 形态的存量不许被新纳面重复报一遍,stdout: ${r.stdout}`)
  } finally {
    rmScratch(root)
  }
})

test('反向对照:const { t } = useI18n() 的缺键仍走原有档判红', () => {
  const root = mkRoot()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'destructured.tsx',
      "const { t } = useI18n()\nexport const a = t('login.ghost')\n",
    )
    const r = runTaro(root)
    assert.equal(r.status, 1, `① 形态缺键必须照旧 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /缺失键问题\(1个\)/, `原有档计数口径不得被改动,stdout: ${r.stdout}`)
    assert.ok(!BUCKET_HEAD.test(r.stdout), '同一枚不得在两桶各记一次')
  } finally {
    rmScratch(root)
  }
})

// ─── 5. 去重:同文件同时有 ①②③,重复键只按原有档判一次 ──────────────
test('去重:直取形态与 hook 形态引用同一枚时,不重复报数', () => {
  const root = mkRoot()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'mixed.tsx',
      "import { t } from '@/i18n'\nconst tt = useTt()\nexport const a = tt('login.ghost', '甲')\nexport const b = t('login.ghost')\nexport const c = t('login.ghost2')\n",
    )
    const r = runTaro(root)
    assert.equal(r.status, 1, 'hook 形态那枚仍由原有档判红')
    assert.match(r.stdout, /缺失键问题\(1个\)/, '原有档只该记 login.ghost 一枚')
    const bucket = r.stdout.match(BUCKET_HEAD)
    assert.ok(bucket, '新纳面条应存在(login.ghost2)')
    assert.equal(bucket[1], '1', `重复键不得两桶各记一次,实际 ${bucket[1]}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /'login\.ghost2'/, '新纳面应点名未被原有档覆盖的那枚')
    assert.ok(!/'login\.ghost'/.test(r.stdout.split('本尺新纳面')[1] ?? ''), '已被原有档判过的键不得再进新纳面')
  } finally {
    rmScratch(root)
  }
})

// ─── 6. 兜底串维度:带第二实参的直取调用必须标成「带兜底串」──────────
test('兜底维度:同一形态里带第二实参的调用被单独标档(无兜底=更严重)', () => {
  const root = mkRoot()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'fallback.tsx',
      "import { tt } from '@/i18n'\nexport const a = tt('login.ghost', '邮箱')\n",
    )
    const r = runTaro(root)
    const bucket = r.stdout.match(BUCKET_HEAD)
    assert.ok(bucket && bucket[1] === '1', `应量到 1 枚,stdout: ${r.stdout}`)
    assert.match(r.stdout, /'login\.ghost' \(带兜底串\)/, '带第二实参的该标成「带兜底串」')
    assert.match(r.stdout, /合计:无兜底 0 枚 \/ 带兜底 1 枚/, '合计行须逐档给数')
    assert.equal(r.status, 0, '带兜底同样只报数')
  } finally {
    rmScratch(root)
  }
})

// ─── 7. 阳性对照:同一把尺在已知能判红的键上量得到 ───────────────────
// 夹具把「词典里有」与「词典里没有」两枚放同一文件:射程读数必须是 2 枚、
// 新纳面必须是 1 枚 —— 否则"0 命中"就只是尺没跑起来。
test('阳性对照:同一文件内已知缺键能被量到(0 命中不算结论)', () => {
  const root = mkRoot()
  try {
    writeTaroMessages(root, TARO_OK)
    writeTaroSource(
      root,
      'control.tsx',
      "import { t } from '@/i18n'\nexport const present = t('login.title')\nexport const absent = t('login.ghost')\n",
    )
    const r = runTaro(root)
    const scope = r.stdout.match(SCOPE_HEAD)
    assert.equal(scope[2], '2', '射程应量到 2 枚引用键(含正存的那枚)')
    assert.equal(r.stdout.match(BUCKET_HEAD)[1], '1', '其中恰 1 枚缺键')
    // 把缺的那枚补进五语包 ⇒ 新纳面必须归零,证明报的是键覆盖而非硬编码
    const patched = {
      'zh-CN': { login: { save: '保存', title: '登录', ghost: '幽灵' } },
      'zh-TW': { login: { save: '儲存', title: '登入', ghost: '幽靈' } },
      ko: { login: { save: '저장', title: '로그인', ghost: '유령' } },
      ja: { login: { save: 'ストック', title: 'ログイン', ghost: 'ゴースト' } },
      en: { login: { save: 'Save', title: 'Login', ghost: 'Ghost' } },
    }
    writeTaroMessages(root, patched)
    const r2 = runTaro(root)
    assert.ok(!BUCKET_HEAD.test(r2.stdout), `补齐后新纳面应归零,stdout: ${r2.stdout}`)
    assert.equal(r2.status, 0, '补齐即转绿(不放宽规则)')
  } finally {
    rmScratch(root)
  }
})

// ─── 8. 升档隔离的形状锁:新桶不得进 shouldBlock / 不得改原有档计数 ────
test('形状锁:新纳面不进 shouldBlock,且不改 checkedFiles/checkedKeys 口径', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  const blockExpr = src.match(/const shouldBlock =[\s\S]*?\n/)
  assert.ok(blockExpr, 'shouldBlock 表达式必须仍在(没被顺手删)')
  assert.ok(
    !/directImport/.test(blockExpr[0]),
    `新纳面不得进 shouldBlock:${blockExpr[0].trim()}`,
  )
  assert.match(
    src,
    /return keysForVars\(code, varNames\)/,
    'extractHookKeys 的调用点尺必须与③共用一把(keysForVars),禁止第二份实现',
  )
  assert.match(src, /checkedKeys \+= keys\.length/, '原有档计数口径一字未动')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
