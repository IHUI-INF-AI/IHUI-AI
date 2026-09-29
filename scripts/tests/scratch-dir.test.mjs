// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scratch-dir 回归测试:钉死两条选址不变量(落点在仓库树外 + 不依赖进程 TEMP)。
// 成因见 scripts/lib/scratch-dir.mjs 注释:夹具曾随 os.tmpdir() 把 C 盘当垃圾场,
// 单日 45 个目录;而"非 git 仓库"用例要求夹具必须在任何仓库树之外。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  SCRATCH_DIR_NAME,
  countScratchSegments,
  evaluateDeleteTarget,
  mkScratch,
  rmScratch,
  scanForNestedScratchRoot,
  scratchRoot,
} from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const SCRIPTS_DIR = resolve(HERE, '..')

test('mkScratch 建的目录不在仓库树内(否则"非 git"夹具会逃逸到真仓库)', () => {
  const dir = mkScratch('abspath-')
  try {
    assert.ok(!dir.startsWith(REPO_ROOT + '\\'), `夹具落在仓库内: ${dir}`)
    assert.ok(!dir.startsWith(REPO_ROOT + '/'), `夹具落在仓库内: ${dir}`)
  } finally {
    rmScratch(dir)
  }
})

test('mkScratch 不跟随进程 TEMP(把 TEMP 指向一个钉在 C 盘的旧值也必须不理它)', () => {
  // 旧写法是"夹具落在 process.env.TEMP 之下就算失败"。这句在本机 TEMP **已迁移成功**时
  // 自相矛盾:mkScratch 的锚点按定义就是 `<工作树盘>\DevEnv\Temp\ihui-scratch`,
  // 而 TEMP 现值正是 `D:\DevEnv\Temp` ⇒ 迁移越成功,这条越红(2026-09-24 实测红在此)。
  // 要钉的性质不是"与 TEMP 不同",而是"**不受 TEMP 影响**":所以显式把 TEMP 改成一个
  // 未迁移的 C 盘路径再取证,这才是原意。
  const before = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR }
  const stale = 'C:\\Users\\someone\\AppData\\Local\\Temp'
  process.env.TEMP = stale
  process.env.TMP = stale
  delete process.env.TMPDIR
  try {
    const dir = mkScratch('temp-env-')
    try {
      const r = resolve(dir)
      assert.ok(
        !r.toLowerCase().startsWith(resolve(stale).toLowerCase()),
        `夹具跟随了进程 TEMP ⇒ ${dir}(选址必须与工作树同盘,不看 TEMP 脸色)`,
      )
      assert.ok(
        /^[A-Za-z]:\\DevEnv\\Temp\\ihui-scratch/i.test(r) || !/^[Cc]:\\/.test(r),
        `夹具落点异常(既不在 DevEnv\\Temp\\ihui-scratch,又落在 C 盘):${dir}`,
      )
    } finally {
      rmScratch(dir)
    }
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})

test('rmScratch 真删干净(git 只读对象靠重试兜底)', () => {
  const dir = mkScratch('rmcheck-')
  rmScratch(dir)
  assert.equal(existsSync(dir), false, `rmScratch 之后仍存在: ${dir}`)
})

test('IHUI_SCRATCH_DIR 可覆盖落点(换机/CI 无 D:\\DevEnv 时的逃生舱)', () => {
  const prev = process.env.IHUI_SCRATCH_DIR
  const override = join(REPO_ROOT, '.ihui-agent', 'tmp', 'scratch-override')
  process.env.IHUI_SCRATCH_DIR = override
  try {
    // 覆盖指向仓库内时按硬约束拒建,而不是静默产出会逃逸的夹具
    assert.throws(() => mkScratch('inside-repo-'), /不得在仓库树内/)
  } finally {
    if (prev === undefined) delete process.env.IHUI_SCRATCH_DIR
    else process.env.IHUI_SCRATCH_DIR = prev
    const left = existsSync(override) ? readdirSync(override) : []
    assert.deepEqual(left, [], `覆盖目录留下了残留: ${left.join(', ')}`)
  }
})

/* ── G-286(2026-09-27):scratch 根必须与"脚本被拷进夹具仓"解耦 ────────────────────
 * 成因:scratch-module-closure 会把整条 import 闭包拷进演练仓,而旧 scratchRoot 按
 * 「脚本自身位置向上两级」取盘根 —— 拷进一层深夹具 ⇒ `G:/DevEnv/Temp/DevEnv/Temp/
 * ihui-scratch`,两层深 ⇒ `<scratch 根>/DevEnv/Temp/ihui-scratch`(二阶嵌套,实测在盘)。
 * 两条用例分别锁"拷进夹具后仍落同一个盘根级 scratch 根"与"嵌套守卫会抛"。 ── */

/** 在子进程里跑**被拷进夹具的那份** scratch-dir,把它的落点报回来。 */
function runCopiedModule(copiedLibUrl) {
  const r = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { mkScratch, rmScratch } from ${JSON.stringify(copiedLibUrl)};\n` +
        `const d = mkScratch('g286-copied-');\n` +
        `process.stdout.write(d);\n` +
        `rmScratch(d);\n`,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return {
    status: r.status,
    dir: (r.stdout || '').trim(),
    err: `${r.stdout || ''}${r.stderr || ''}`,
  }
}

test('G-286:被闭包拷进夹具仓(一层与两层深)后,落点仍是同一个盘根级 scratch 根', () => {
  const fix = mkScratch('g286-copy-')
  try {
    // 两种夹具深度都要锁:一层深(<fix>/scripts/lib)旧推导落 G:/DevEnv/Temp/DevEnv/…,
    // 两层深(<fix>/wt/scripts/lib,即 git-backup-refresh.test.mjs makeFixture 的 wt 深度)
    // 旧推导落 <scratch 根>/DevEnv/Temp/ihui-scratch —— 正是本票在盘上量到的那两份嵌套物。
    for (const layout of [['scripts'], ['wt', 'scripts']]) {
      const sdst = join(fix, ...layout)
      copyScriptWithClosure(SCRIPTS_DIR, 'lib/scratch-dir.mjs', sdst, ['lib/scratch-dir.mjs'])
      const copiedUrl = pathToFileURL(join(sdst, 'lib', 'scratch-dir.mjs')).href
      const r = runCopiedModule(copiedUrl)
      assert.equal(r.status, 0, `夹具深度 [${layout.join('/')}] 的子进程失败: ${r.err}`)
      const expected = scratchRoot()
      assert.ok(
        r.dir.toLowerCase().startsWith(expected.toLowerCase()),
        `被拷进夹具([${layout.join('/')}])后落点漂移:${r.dir} 不在真实 scratch 根 ${expected} 之下`,
      )
      const segs = r.dir.split(/[\\/]+/).filter(Boolean)
      assert.equal(
        segs.filter((s) => s.toLowerCase() === 'ihui-scratch').length,
        1,
        `落点出现二阶嵌套(路径里有两层 ihui-scratch 段):${r.dir}`,
      )
    }
  } finally {
    rmScratch(fix)
  }
})

test('G-286:嵌套守卫 —— 落点含第二层 ihui-scratch 段 ⇒ 抛错点名,不静默换路径', () => {
  const prev = process.env.IHUI_SCRATCH_DIR
  // 用逃生舱构造出"嵌套形态"的落点(守卫对任何来源的根一视同仁:推导歪了或 override 指歪都拦)
  process.env.IHUI_SCRATCH_DIR = join(scratchRoot(), 'DevEnv', 'Temp', 'ihui-scratch')
  try {
    assert.throws(
      () => mkScratch('nested-'),
      /二阶嵌套|ihui-scratch/,
      '嵌套落点必须抛错点名,而不是静默换路径或照建',
    )
  } finally {
    if (prev === undefined) delete process.env.IHUI_SCRATCH_DIR
    else process.env.IHUI_SCRATCH_DIR = prev
    // 守卫抛错之后正常落点必须照常可用(守卫不是把 mkScratch 整个废掉)
    const dir = mkScratch('g286-after-guard-')
    rmScratch(dir)
  }
})

/* ── 退出钩子:让"忘了写 finally"在结构上不可能留下残留(2026-09-25 实测一天漏 3 个夹具) ── */

const LIB_URL = pathToFileURL(resolve(HERE, '..', 'lib', 'scratch-dir.mjs')).href

/** 在**子进程**里跑一段用夹具的代码 —— 钩子挂在 `process.on('exit')`,父进程测不出来。 */
function runChild(body) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { mkScratch, rmScratch } from ${JSON.stringify(LIB_URL)};\n${body}`,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

test('断言抛在 rmScratch 之前 ⇒ 进程退出时夹具必须被带走(阳性对照)', () => {
  // 只判**这一次子进程建出来的那一个路径** —— 按"目录名前缀在 scratch 根里计数"的写法
  // 会被上一次运行留下的残留判成假红(实测就是这样红过一次:判据依赖历史,而不是依赖被测行为)。
  const r = runChild(`
process.stdout.write(mkScratch('leak-probe-'));
throw new Error('模拟断言失败(旧写法在这里就永久漏一个目录)');
`)
  assert.notEqual(r.status, 0, '子进程本该失败,否则这条测不到抛路径')
  assert.match(r.stderr, /模拟断言失败/)
  const childDir = r.stdout.trim()
  assert.ok(
    /^leak-probe-/.test(childDir.split(/[\\/]/).pop() ?? ''),
    `子进程没把夹具路径打出来:${childDir}`,
  )
  assert.equal(existsSync(childDir), false, `退出钩子没生效,夹具仍在:${childDir}`)
})

test('退出钩子只回收本进程建的夹具,不得扫掉同目录里别人留下的东西(反向对照)', () => {
  const stranger = mkScratch('stranger-') // 本测试进程建的,但**不**显式删 —— 子进程退出时必须还在
  try {
    assert.ok(existsSync(stranger), '夹具没建出来,反向对照无从谈起')
    const r = runChild(`
process.stdout.write(mkScratch('child-own-'));
`)
    assert.equal(r.status, 0, r.stderr)
    assert.equal(existsSync(r.stdout.trim()), false, '子进程自己的夹具没被回收(钩子正向半边失效)')
    assert.ok(existsSync(stranger), '钩子越界删了别的进程/别的时刻留下的夹具 ⇒ 那是替人做删除决定')
  } finally {
    rmScratch(stranger)
  }
})

/* ── G-286 票一·删除侧(2026-09-27):递归删不得顺着二阶嵌套往下吞 ─────────────────
 * 票面要求先答的那一句:"任何递归枚举/清理会不会顺着自己造出的嵌套无限深入"。
 * 答案是"会,如果删的一侧不设闸":二阶树的父目录里装着**别的落点**(别的进程、别的时刻
 * 建的夹具),rmSync(recursive) 顺着父目录下去就是把它们一起清掉 —— 与 §26 记过的
 * "Get-ChildItem -Recurse 穿过 junction 把 D 盘真实目标清空"是同一型,只是这次的
 * 重解析点不是链接而是"路径自己套了自己"。
 * 下面六条:两条纯函数(三态各有正反例)+ 两条端到端(注入⇒拒绝且现场原样在盘,
 * 抹掉⇒照常回收)+ 一条"紧急出口是真的"(不得只写在文档里)+ 一条"有界枚举会终止"。 ── */

test('G-286:evaluateDeleteTarget 四条分支各有正反例(纯函数,构造面即验)', () => {
  const root = scratchRoot()
  const base = {
    target: join(root, 'fix-1'),
    scratchRoot: root,
    isReparseTarget: false,
    nested: { hits: [] },
  }
  // 放行半边:普通夹具必须能删 —— 否则本守卫会把全仓 30+ 处 rmScratch 一起废掉
  assert.equal(evaluateDeleteTarget(base), null)
  // D1:目标就是 scratch 根本身
  assert.match(evaluateDeleteTarget({ ...base, target: root }), /scratch 根本身/)
  // D2:目标是重解析点
  assert.match(evaluateDeleteTarget({ ...base, isReparseTarget: true }), /符号链接|junction/)
  // D3:子树里藏着第二层 scratch 根
  const d3 = evaluateDeleteTarget({
    ...base,
    nested: { hits: [{ path: join(root, 'fix-1', 'DevEnv'), depth: 3 }] },
  })
  assert.match(String(d3), /第二层/)
  // 反向对照:hits 为空数组(不是 undefined)不得被读成"发现了"—— 空数组是真值,
  // 本仓 A0 分支就因这条栽过("永不执行"那一型),所以它必须有自己的一条断言。
  assert.equal(evaluateDeleteTarget({ ...base, nested: { hits: [] } }), null)
  // 空路径不得被放行成"删根目录"
  assert.match(String(evaluateDeleteTarget({ ...base, target: '' })), /空值/)
})

test('G-286:countScratchSegments 对"一阶/二阶/零阶"分别给对数(嵌套判据只有这一份实现)', () => {
  assert.equal(countScratchSegments('/x/y'), 0)
  assert.equal(countScratchSegments(join('G:', 'DevEnv', 'Temp', 'ihui-scratch', 'fix-1')), 1)
  assert.equal(
    countScratchSegments(
      join('G:', 'DevEnv', 'Temp', 'ihui-scratch', 'DevEnv', 'Temp', 'ihui-scratch'),
    ),
    2,
  )
  // 大小写与分隔符都要认(Windows 盘上两条都会出现)
  assert.equal(countScratchSegments('g:\\DevEnv\\Temp\\IHUI-Scratch\\wt'), 1)
})

test('G-286 端到端反向锁:夹具里注入二阶形态 ⇒ rmScratch 拒绝且**现场原样在盘**;抹掉 ⇒ 照常回收', () => {
  const fix = mkScratch('g286-rm-')
  const nested = join(fix, 'DevEnv', 'Temp', 'ihui-scratch', 'victim')
  mkdirSync(nested, { recursive: true })
  writeFileSync(join(nested, 'keep.txt'), '这份现场不属于本次夹具\n')
  // ① 注入态:必须拒绝,并且一个字节都没删
  let threw = null
  try {
    rmScratch(fix)
  } catch (e) {
    threw = e
  }
  assert.ok(threw, '二阶形态在子树里时 rmScratch 不得静默递归删(那等于替别人的落点做删除决定)')
  assert.match(threw.message, /第二层 scratch 根/)
  assert.ok(existsSync(fix), '被拒绝的删除不得部分执行(删一半比不删更糟)')
  assert.ok(existsSync(join(nested, 'keep.txt')), '被点名的现场必须原样在盘')
  // ② 抹掉自己注入的东西 ⇒ 同一个 target 立刻可删(证明拒的是形态,不是这个目录本身)
  rmSync(join(fix, 'DevEnv'), { recursive: true, force: true })
  rmScratch(fix)
  assert.equal(existsSync(fix), false, '没有嵌套时正常回收必须照常工作')
})

test('G-286:rmScratch(scratchRoot()) 必须被拒(scratch 根不是任何一次夹具的落点)', () => {
  const root = scratchRoot()
  assert.match(String(thrownMessage(() => rmScratch(root))), /scratch 根本身/)
  assert.ok(existsSync(root), '拒绝之后 scratch 根必须仍在 —— 这条判据不许有半边副作用')
})

test('G-286:紧急出口 IHUI_SCRATCH_RM_FORCE=1 是真的(能放行 D3,但绝不放行 D1)', () => {
  // 文档里写一个跑不通的出路,本仓已记过多次(守门 46/11c/50 的假 HUSKY_SKIP_*)——
  // 所以这一条不是可选项:它证明那个环境变量确实改变了行为,并且**没有**把它变成删根的钥匙。
  const prev = process.env.IHUI_SCRATCH_RM_FORCE
  const fix = mkScratch('g286-force-')
  const nested = join(fix, 'DevEnv', 'Temp', 'ihui-scratch')
  mkdirSync(nested, { recursive: true })
  try {
    assert.match(
      String(thrownMessage(() => rmScratch(fix))),
      /第二层 scratch 根/,
      '未开出口时必须拒',
    )
    process.env.IHUI_SCRATCH_RM_FORCE = '1'
    rmScratch(fix)
    assert.equal(existsSync(fix), false, '开了出口仍拒 ⇒ 文档写的出路是假的')
    // D1 不在出口权限内:删共享根从来不是"应急",而是事故
    assert.match(String(thrownMessage(() => rmScratch(scratchRoot()))), /scratch 根本身/)
  } finally {
    if (prev === undefined) delete process.env.IHUI_SCRATCH_RM_FORCE
    else process.env.IHUI_SCRATCH_RM_FORCE = prev
  }
})

test('G-286:scanForNestedScratchRoot 有界(预算耗尽 ⇒ truncated,不是"没有")', () => {
  const fix = mkScratch('g286-bound-')
  try {
    mkdirSync(join(fix, 'a', 'b', SCRATCH_DIR_NAME), { recursive: true })
    const full = scanForNestedScratchRoot(fix)
    assert.ok(full.hits.length >= 1, '默认射程必须看得到 3 层深的二阶根')
    assert.equal(full.truncated, false)
    const tight = scanForNestedScratchRoot(fix, { entryBudget: 2 })
    assert.equal(tight.truncated, true, '预算耗尽要如实标 truncated,否则"少扫"伪装成"干净"')
    assert.equal(tight.hits.length, 0, '极小预算下确实没扫到 —— 这条与上一条合起来才叫有界')
    const shallow = scanForNestedScratchRoot(fix, { maxDepth: 2 })
    assert.equal(shallow.hits.length, 0, '深度闸生效(超出射程不判,报告须写明)')
    // 重解析点不得被穿透(§26):链到一个二阶根 ⇒ 不得算命中
    const real = join(fix, 'outside', 'ihui-scratch')
    mkdirSync(real, { recursive: true })
    try {
      symlinkSync(join(fix, 'outside'), join(fix, 'linked'))
      const r = scanForNestedScratchRoot(fix, { maxDepth: 6 })
      assert.ok(
        !r.hits.some((h) => /linked/.test(h.path)),
        '顺着 junction 判 = 把别人的目标算进本账',
      )
      assert.ok(r.skippedReparse >= 1, '跳过重解析点必须计数并可见')
    } catch (e) {
      if (e && (e.code === 'EPERM' || e.code === 'EEXIST')) {
        console.log(
          `ℹ 本机建不了测试用 junction(${e.code})⇒ 重解析点这一维在本文件未判定,不计为通过`,
        )
      } else throw e
    }
  } finally {
    // 注入的二阶现场必须先自己收掉,再让 rmScratch 回收本夹具 ——
    // 顺序反过来守卫会(正确地)拒绝:它拦的就是"顺着嵌套吞掉别的落点"。
    // 本次自检第一版就是按反序写的,那条红正是删除侧守卫有牙的证明,不是缺陷。
    try {
      rmSync(join(fix, 'linked')) // 只断链,绝不递归穿重解析点(§26)
    } catch {}
    for (const p of ['outside', 'a']) {
      try {
        rmSync(join(fix, p), { recursive: true, force: true })
      } catch {}
    }
    rmScratch(fix)
  }
})

function thrownMessage(fn) {
  try {
    fn()
    return null
  } catch (e) {
    return e && e.message ? e.message : String(e)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
