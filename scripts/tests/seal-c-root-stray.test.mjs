// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// seal-c-root-stray 的镜像测试(§22c):直接 import 源脚本,不复制判据实现。
// 本文件的重心不是"封口逻辑对不对"(那由源脚本 --self-test 的 11 例端到端钉),
// 而是**三件只有跨文件才看得见的事**:
//   ① 封口器是否真的被每日维护脚本调用(造好没装车 = 没有,本仓同类事故已第 N 次);
//   ② 守门是否 import 这份清单,而不是自己抄一份名字(两份真相必然漂移);
//   ③ 改道目标是否仍落在 §15b 批准的落点内(清单被人挪去 C 盘就彻底背离初衷)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__, ORPHAN_FILES, SEALED_DIRS, run } from '../seal-c-root-stray.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskComments } from '../lib/code-mask.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { gitRaw } from '../lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')

test('装车证明①:每日维护脚本必须真的调用封口器(--check 与 --apply 两条都在)', () => {
  const ps1 = readFileSync(join(SCRIPTS, 'c-drive-auto-maintain.ps1'), 'utf8')
  assert.ok(
    ps1.includes('seal-c-root-stray.mjs'),
    '维护脚本没引用封口器 ⇒ 门面上写了根治,实际每天无人复检,回潮不可见',
  )
  assert.match(ps1, /--check/, '缺少零副作用的体检调用')
  assert.match(ps1, /--apply/, '缺少自动重封调用(只报不修等于要人天天手动跑)')
})

test('装车证明②:守门必须 import 本清单,不得自己抄一份名字', () => {
  const gate = readFileSync(join(SCRIPTS, 'check-c-drive-pollution.mjs'), 'utf8')
  assert.match(
    gate,
    /import\s*\{[^}]*SEALED_DIRS[^}]*\}\s*from\s*'\.\/seal-c-root-stray\.mjs'/,
    '守门未从封口器 import SEALED_DIRS',
  )
  // 真正该禁的是"import 进来却不用"(= 空门:清单漂了门照样绿),而不是"代码里出现这个名字" ——
  // FOREIGN_ROOT 里本来就该挂着 tmp/tools(含义是"别当成我们的"),按字面量禁会误伤。
  // 第一版就是拿字面量当判据,结果被自己写的自检夹具判红,那是判据问错了问题。
  const selfTestAt = gate.indexOf('function selfTest(')
  assert.ok(selfTestAt > 0, '找不到 selfTest 边界 ⇒ 本断言会退化成空判')
  const judgeCode = gate.slice(0, selfTestAt)
  const body = judgeCode.replace(/import[^\n]*\n/g, '')
  assert.ok(
    /classifySeal|SEALED_DIRS/.test(body),
    'SEALED_DIRS 只在 import 里出现,判决代码没用它 ⇒ 封口判据是空门',
  )
  assert.doesNotMatch(
    body,
    /const\s+SEALED_\w+\s*=\s*\[/,
    '守门自己又定义了一份封口清单 ⇒ 两份真相,清单一改就漂移',
  )
})

test('清单卫生:名字必须是单段、非空、不重复', () => {
  assert.ok(SEALED_DIRS.length >= 3, '封口清单被清空 ⇒ BROKEN 判据永不触发')
  const names = SEALED_DIRS.map((e) => e.name.toLowerCase())
  assert.equal(new Set(names).size, names.length, '清单有重名')
  for (const e of SEALED_DIRS) {
    assert.doesNotMatch(e.name, /[\\/:*?"<>|]/, `name 必须是单段目录名:${e.name}`)
    assert.ok(e.owner && e.evidence, `${e.name} 缺 owner/evidence —— 无取证的条目不该进清单`)
  }
  assert.ok(ORPHAN_FILES.length >= 1 && ORPHAN_FILES.every((o) => o.reason), '孤儿清单须带定性依据')
})

test('改道目标必须落在 §15b 批准的外置根下,且不得回到 C 盘', () => {
  const allowed = ['cache/', 'Temp/', 'tools/']
  for (const e of SEALED_DIRS) {
    assert.ok(
      allowed.some((p) => e.target.startsWith(p)),
      `${e.name} 的目标 ${e.target} 不在批准的三类落点内`,
    )
    assert.doesNotMatch(e.target, /^[cC]:/, `${e.name} 的目标写死在 C 盘,改道失去意义`)
    assert.doesNotMatch(e.target, /\.\./, `${e.name} 的目标含上跳`)
  }
})

test('端到端:真目录改道后,同一路径仍可读且源变成链接', () => {
  const base = mkScratch('seal-mirror-')
  try {
    const root = join(base, 'root')
    const devEnv = join(base, 'devenv')
    const entry = SEALED_DIRS[0]
    const stray = join(root, entry.name)
    mkdirSync(stray, { recursive: true })
    writeFileSync(join(stray, 'payload.txt'), 'abc')

    assert.equal(run({ root, devEnv, mode: 'apply' }).sealed[0].ok, true, 'apply 失败')
    assert.equal(existsSync(join(stray, 'payload.txt')), true, '改道后经原路径读不到内容')
    // 夹具隔离证明:链接必须指向**夹具内**的目标。指向真实 D:\DevEnv ⇒ devEnv 没传进去。
    // 第一版就是把它写成 `dev`,默认值静默生效 ⇒ 3 字节夹具文件被写进生产目标而断言全绿。
    assert.ok(realpathSync(stray).startsWith(devEnv), `链接指向夹具外:${realpathSync(stray)}`)
    // 第二次必须全 skip —— 不幂等的封口器会在每日任务里反复搬同一批文件
    const again = run({ root, devEnv, mode: 'apply' })
    assert.deepEqual(
      again.sealed.map((s) => s.action),
      SEALED_DIRS.map(() => 'skip'),
      '二次运行仍在动东西 ⇒ 不幂等',
    )
    // 已封口时 check 必须给绿,否则每日巡检天天红,结论会被习惯性地忽略
    assert.equal(run({ root, devEnv, mode: 'check' }).needsAction, false, '已封口却报待处置')
  } finally {
    rmScratch(base)
  }
})

test('选项键写错必须抛错(不许静默改用生产外置根)', () => {
  const base = mkScratch('seal-mirror-keys-')
  try {
    assert.throws(
      () => run({ root: join(base, 'root'), dev: join(base, 'devenv'), mode: 'apply' }),
      /不认识的选项/,
      '把 devEnv 写成 dev 竟未抛错 ⇒ 夹具会静默写进生产目标(本仓实测踩过)',
    )
  } finally {
    rmScratch(base)
  }
})

test('反向对照:把链接换成真目录,check 必须立刻判待处置', () => {
  const base = mkScratch('seal-mirror-neg-')
  try {
    const root = join(base, 'root')
    const devEnv = join(base, 'devenv')
    mkdirSync(join(root, SEALED_DIRS[0].name, 'sub'), { recursive: true })
    const r = run({ root, devEnv, mode: 'check' })
    assert.equal(r.sealed[0].state, 'REAL-DIR', '真目录没被判回潮')
    assert.equal(r.needsAction, true, '回潮却报无需处理 ⇒ 判据给了假绿灯')
    assert.equal(existsSync(devEnv), false, 'check 模式不该创建外置目标')
  } finally {
    rmScratch(base)
  }
})

test('隐藏必须走"链接本体 + 父目录枚举"口径,不得用 attrib(它改的是目标)', () => {
  // 实测:`attrib +h <junction>` 把 Hidden 设到**目标**上,链接本体不动,而 attrib 回显又顺着
  // 链接读目标 ⇒ 看着像成功。第一版就因此"隐藏了 4 次",C 盘名字一个没藏住、D 盘数据目录反被藏。
  const src = readFileSync(join(SCRIPTS, 'seal-c-root-stray.mjs'), 'utf8')
  assert.doesNotMatch(src, /attrib\.exe|'attrib'/, '仍在调用 attrib 设隐藏 ⇒ 会改到目标那侧')
  assert.match(src, /Get-ChildItem/, '未使用父目录枚举做复核(不得把"没抛错"当成成功)')
  assert.match(src, /FileAttributes\]::Hidden/, '未走 PowerShell 提供器的位或设法')
})

test('装车证明③:git 守护必须真的调封口自愈(重启会清掉 junction,日检最长空窗 23h)', () => {
  const g = readFileSync(join(SCRIPTS, 'git-guardian.mjs'), 'utf8')
  assert.match(g, /seal-c-root-stray\.mjs/, '守护未引用封口器 ⇒ 重启后改道点无人补')
  assert.match(g, /function\s+healRootSeal/, '缺 healRootSeal 这一层')
  assert.match(g, /call\(\['--check'\]\)/, '体检调用缺失')
  assert.match(g, /call\(\['--apply'\]\)/, '重封调用缺失(只报不修 = 每天要人手动跑)')
  // 挂点必须在"真巡检"分支里:挂在 CHECK_ONLY 路径上等于永不执行(工作区自愈层踩过同一坑)
  assert.match(g, /if \(!CHECK_ONLY\) healRootSeal\(\)/, '未挂在 !CHECK_ONLY 分支 ⇒ 永不触发')
  // 挂点必须落在 daemon tick 的巡检 try 里。旧写法判「healRootSeal() 之后 80 字符内必须出现
  // } catch」——任何人往它下面新增一个兄弟自愈(实际就新增了 healHomeJunctions)就会把窗口
  // 撑破,于是**接线完好而断言恒红**。现改问结构:取该 try 到其 catch 之间的区间再要求内含调用。
  const catchAt = g.indexOf("log('巡检异常")
  assert.ok(catchAt > 0, '未定位到 tick 的巡检 catch —— 判据失效不得当成"没接线"')
  const tryAt = g.lastIndexOf('try {', catchAt)
  assert.ok(tryAt > 0 && tryAt < catchAt, '未定位到巡检 try 起点(同上,宁红不误绿)')
  assert.match(
    g.slice(tryAt, catchAt),
    /healRootSeal\(\)/,
    'healRootSeal 未挂在 tick 的 try 里 ⇒ 永不触发(挂在 CHECK_ONLY 路径同样等于没有)',
  )
  // 派生一律带超时与 windowsHide(守门 52/80)
  const body = g.slice(
    g.indexOf('function healRootSeal'),
    g.indexOf('function healRootSeal') + 2200,
  )
  assert.match(body, /windowsHide: true/, 'healRootSeal 缺 windowsHide ⇒ 守护下必弹控制台窗')
  assert.match(body, /timeout: \d+/, 'healRootSeal 缺 timeout ⇒ 一次挂起拖死整轮巡检')
})

test('__test__ 出口齐备(§22c:缺出口即红,防"测试悄悄测镜像实现")', () => {
  // `sameFingerprint` 自 G-1018197 起不在本模块出口里了:它在生产面**零调用**,且与共用层
  // 那个同名函数**同词不同义**(本模块比 {count,bytes,files} 清单,共用层比 Map<rel,size>)。
  // 把两种契约挤在一个名字下 = 下一个人按错的那份语义调用它。
  for (const fn of ['classifyEntry', 'fingerprint', 'pathsFor', 'devEnvRoot']) {
    assert.equal(typeof __test__[fn], 'function', `__test__.${fn} 缺失`)
  }
  assert.equal(
    __test__.sameFingerprint,
    undefined,
    '本模块不得再挂一份同名的清单式 sameFingerprint',
  )
  assert.ok(Array.isArray(__test__.SEALED_DIRS) && Array.isArray(__test__.ORPHAN_FILES))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* ─────────────────────────────────────────────────────────────────────────────
 * G-345 第④格(2026-09-29):`devEnvRoot()` 原先"仓根向上数两级",只在"工作树恰好挂在
 * 盘根下一层"时凑巧正确。本仓有次级 worktree 与 mkScratch 夹具两种**两层深**形态,那时它把
 * `DevEnv` 推进别人正在写的父目录 —— 而守门 92、PG 备份审计、恢复演练全吃这一个出口。
 * 三条锁互相不重复:跨深度不变性(行为)、夹具内必须喊(失效方向)、源码不得再数层(反向锁)。
 * ─────────────────────────────────────────────────────────────────────────── */

test('G-345④ 跨深度不变性:深层与浅层工作树必须推出同一个盘根 DevEnv', () => {
  // 夹具刻意用**两个假想的工作树路径**(都不存在、也不去创建),而不是拿真仓根当"浅层":
  // 真仓根 <drive>/IHUI-AI 在本机就是仓库本身,而 devEnvRoot 有一条"存在 <repoRoot>/.DevEnv
  // 就选项目内形态"的分支(G-814433 搬迁前置)—— 用它当浅层样本,这条断言比的其实是
  // "项目内形态 vs 盘根形态",深度根本不是变量(G-1018199 实测:本条在真仓上必红,
  // 而红的内容与"数层数会不会漂"无关)。判据要问的那个问题,样本必须只让它变一次。
  const ROOT = parse(resolve(SCRIPTS, '..')).root
  const shallow = join(ROOT, 'ihui-hypothetical-shallow')
  const deep = join(ROOT, 'a', 'b', 'ihui-hypothetical-shallow')
  const a = __test__.devEnvRoot(shallow)
  const b = __test__.devEnvRoot(deep)
  assert.equal(b, a, `数两级推导会随深度漂移(浅=${a} 深=${b})⇒ 深层工作树会把 DevEnv 建进别人目录`)
  assert.ok(!resolve(deep).startsWith(resolve(a) + sep), 'DevEnv 不得落在被推导的工作树内部')
  // 反向对照:两条假想路径若都带 .DevEnv,应各自落在自己项目内(证明选的是形态而不是层数)
  assert.ok(existsSync(a) || a === join(ROOT, 'DevEnv'), `盘根形态必须是 <drive>/DevEnv,实际 ${a}`)
})

test('G-345④ 仓根本身在夹具里 ⇒ 必须抛错点名,不得安静返回一个落在夹具内的"外置根"', () => {
  const dir = mkScratch('seal-root-')
  try {
    assert.throws(() => __test__.devEnvRoot(dir), /scratch|夹具/)
  } finally {
    rmScratch(dir)
  }
})

test('G-345④ 反向锁(源码级)：不得再出现"向上数两级"的推导写法', () => {
  // 判**代码面**:本票那条注释里原样引用了旧写法(说明性文字也带执行性字符,守门 O81/D3 同一条教训),
  // 不剥注释就会把"解释缺陷的散文"判成缺陷本身 —— 遮罩只有 lib/code-mask.mjs 一份实现,不得自写。
  const src = maskComments(readFileSync(join(SCRIPTS, 'seal-c-root-stray.mjs'), 'utf8'))
  assert.doesNotMatch(
    src,
    /resolve\(\s*REPO\s*,\s*'\.\.'\s*,\s*'\.\.'\s*\)/,
    '盘根必须问 path.parse 要,数层数在深层工作树下必歪(本票立因)',
  )
  assert.match(
    src,
    /import\s*\{\s*countScratchSegments\s*\}\s*from\s*'\.\/lib\/scratch-dir\.mjs'/,
    '夹具判定必须复用 scratch-dir 那一份出口,不得再写第二个"什么算夹具段"',
  )
})

/* ─────────────────────────────────────────────────────────────────────────────
 * G-1018197(2026-10-02):删源前的**内容闸**。
 * 病灶三段合起来是"用户目录里只存在于源侧的内容被销毁":cpSync(force:false) 在目标已有
 * 同名文件时保留目标字节(源内容根本没搬过去)→ 对账只看路径清单 → rmSync 删源。
 * 这一族只能靠 A/B 证明:拿"改道前的实现"与"现在的实现"喂**同一份夹具**,
 * 旧臂必须当场把源删掉(否则病灶是叙述出来的),新臂必须拒绝(否则闸没牙)。
 * ───────────────────────────────────────────────────────────────────────────── */

const REPO = resolve(SCRIPTS, '..')
// 出处钉 ref,不钉 HEAD(§"阳性对照必须钉出处"):账修好那天,"HEAD 上还量得到旧写法"当场失效。
const LEGACY_REF = 'fffadaef46'

function legacySeal(dir) {
  const text = gitRaw(['show', `${LEGACY_REF}:scripts/seal-c-root-stray.mjs`], REPO)
  if (!text || !text.includes('before.files.filter'))
    throw new Error(
      `对照臂取到的不是改道前那份实现(应含路径清单式对账)⇒ ref ${LEGACY_REF} 已失效,` +
        '必须换 ref,不得放宽这条(放宽就等于取消阳性对照)',
    )
  const destScripts = join(dir, 'scripts')
  mkdirSync(destScripts, { recursive: true })
  writeFileSync(join(destScripts, 'seal-c-root-stray.mjs'), text)
  // 闭包必须拷全:legacy 那份 import ./lib/scratch-dir.mjs,少一跳就是 ERR_MODULE_NOT_FOUND,
  // 而它读起来像"对照跑不动",不是"对照没命中"(本仓记过的那一型)。
  copyScriptWithClosure(SCRIPTS, 'lib/scratch-dir.mjs', destScripts, ['lib/scratch-dir.mjs'])
  return import(pathToFileURL(join(destScripts, 'seal-c-root-stray.mjs')).href)
}

/** 造一份"目标已有同名文件"的冲突夹具:srcBytes 只存在于源侧。 */
function clashFixture(dir, srcBytes, dstBytes, entryName = 'common_attachment') {
  const entry = SEALED_DIRS.find((e) => e.name === entryName)
  const root = join(dir, 'root')
  const devEnv = join(dir, 'devenv')
  const stray = join(root, entry.name)
  const target = __test__.pathsFor(entry, root, devEnv).target
  mkdirSync(join(stray, 'sub'), { recursive: true })
  mkdirSync(join(target, 'sub'), { recursive: true })
  writeFileSync(join(stray, 'sub', 'dup.bin'), srcBytes)
  writeFileSync(join(target, 'sub', 'dup.bin'), dstBytes)
  return { root, devEnv, stray, target, entry, idx: SEALED_DIRS.indexOf(entry) }
}

test('A/B 阳性对照:同路径同尺寸而内容不同 ⇒ 改道前的实现确实把只存在于源侧的字节删掉了', async () => {
  const dir = mkScratch('seal-ab-legacy-')
  try {
    const legacy = await legacySeal(dir)
    const fx = clashFixture(dir, 'AAAAAAAA', 'BBBBBBBB')
    const ent = legacy.run({ root: fx.root, devEnv: fx.devEnv, mode: 'apply' }).sealed[fx.idx]
    // 旧臂"成功"封口 = 它认为对账通过了;而此刻源已变 junction ⇒ 'AAAAAAAA' 无处可寻。
    assert.ok(ent.ok, `旧臂本该通过(它只看路径清单),实际:${ent.note}`)
    assert.ok(
      lstatSync(fx.stray).isSymbolicLink(),
      '旧臂没把源换成 junction ⇒ 夹具没命中那条删除路径',
    )
    assert.equal(
      readFileSync(join(fx.target, 'sub', 'dup.bin'), 'utf8'),
      'BBBBBBBB',
      '目标侧留的是它自己的旧字节 —— 这正是"源内容被销毁"的形状',
    )
  } finally {
    rmScratch(dir)
  }
})

test('A/B 现实现:同一份夹具必须拒绝删源,源仍是真目录且字节完好', () => {
  const dir = mkScratch('seal-ab-new-')
  try {
    const fx = clashFixture(dir, 'AAAAAAAA', 'BBBBBBBB')
    const ent = run({ root: fx.root, devEnv: fx.devEnv, mode: 'apply' }).sealed[fx.idx]
    assert.ok(!ent.ok, '内容闸放行 ⇒ 闸没牙')
    assert.equal(ent.action, 'move')
    assert.ok(!lstatSync(fx.stray).isSymbolicLink(), '拒绝删源却还是建了 junction')
    assert.equal(readFileSync(join(fx.stray, 'sub', 'dup.bin'), 'utf8'), 'AAAAAAAA')
    assert.equal(
      readFileSync(join(fx.target, 'sub', 'dup.bin'), 'utf8'),
      'BBBBBBBB',
      '目标侧字节不得被动',
    )
  } finally {
    rmScratch(dir)
  }
})

test('合法合并形态不得被闸死:目标多出源没有的文件 ⇒ 照旧封口', () => {
  const dir = mkScratch('seal-ab-merge-')
  try {
    const fx = clashFixture(dir, 'AAAAAAAA', 'AAAAAAAA')
    writeFileSync(join(fx.target, 'sub', 'other.bin'), 'belongs-to-target')
    const ent = run({ root: fx.root, devEnv: fx.devEnv, mode: 'apply' }).sealed[fx.idx]
    assert.ok(ent.ok, `正当改道被拦:${ent.note}`)
    assert.ok(lstatSync(fx.stray).isSymbolicLink())
    assert.equal(readFileSync(join(fx.target, 'sub', 'other.bin'), 'utf8'), 'belongs-to-target')
  } finally {
    rmScratch(dir)
  }
})

test('唯一实现形状锁:走树枚举与内容摘要在 scripts 下各只有一份定义', () => {
  // -co:共用层那份此刻可能"已写入而未入库",按纯 ls-files 枚举会把"文件不存在"读成
  // "定义 0 份 ⇒ 通过",那正是本锁要防的假绿(取不到与没有是两件事)。
  const files = gitRaw(['ls-files', '-co', '--exclude-standard', 'scripts'], REPO)
    .split('\n')
    .filter((l) => l.trim())
  const defs = []
  for (const full of files) {
    if (!full.endsWith('.mjs') || full.startsWith('scripts/tests/')) continue
    const rel = full.slice('scripts/'.length)
    const p = join(REPO, full)
    if (!existsSync(p)) continue
    const src = maskComments(readFileSync(p, 'utf8'))
    if (/function\s+fingerprintTree\s*\(/.test(src)) defs.push([rel, 'fingerprintTree'])
    if (/function\s+digestFile\s*\(/.test(src)) defs.push([rel, 'digestFile'])
    if (/function\s+firstContentMismatch\s*\(/.test(src)) defs.push([rel, 'firstContentMismatch'])
  }
  const byName = new Map()
  for (const [rel, n] of defs) byName.set(n, [...(byName.get(n) ?? []), rel])
  for (const n of ['fingerprintTree', 'digestFile', 'firstContentMismatch']) {
    const where = byName.get(n) ?? []
    assert.equal(
      where.join(','),
      'lib/mirror-verify.mjs',
      `${n} 的定义必须只在共用层一份(两处各写一遍必漂移,而漂移的表现是安静)`,
    )
  }
})

test('封口器形状锁:必须 import 共用层,且不得再自带一份走树枚举', () => {
  const src = maskComments(readFileSync(join(SCRIPTS, 'seal-c-root-stray.mjs'), 'utf8'))
  assert.match(
    src,
    /import\s*\{[^}]*fingerprintTree[^}]*\}\s*from\s*'\.\/lib\/mirror-verify\.mjs'/,
    '封口器没从共用层取指纹 ⇒ 它又在判"路径清单"那一层',
  )
  assert.doesNotMatch(
    src,
    /const\s+stack\s*=\s*\[\s*\[\s*dir\s*,\s*''\s*\]\s*\]/,
    '封口器里不得再出现自己走树的枚举(那是第二份"什么算一致")',
  )
  // 三条闸都在:源没复制过去 / 尺寸不同 / 同尺寸内容不同 —— 少一条就是"看着有闸实则放行"
  assert.match(src, /d\.onlyA\.length/, '缺"目标仍缺文件"那一闸')
  assert.match(src, /d\.differ\.length/, '缺"同路径不同尺寸"那一闸(G-1018197 病灶②)')
  assert.match(src, /firstContentMismatch\(/, '缺"同尺寸不同内容"那一闸(病灶③的前置)')
  // 闸必须排在 rmSync(link) 之前,顺序判据用行为而不是文本位置会漂,这里判的是结构位置
  const rmAt = src.indexOf('rmSync(link,')
  const gateAt = src.indexOf('firstContentMismatch(')
  assert.ok(gateAt > 0 && rmAt > 0 && gateAt < rmAt, '内容闸排在删源之后 = 没有闸')
})
