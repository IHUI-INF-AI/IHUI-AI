// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:scripts/check-i18n-duplicate-namespaces.mjs 的 ROOT 定位与 `--root` 测试通道。
// 跑法:node --test scripts/tests/check-i18n-duplicate-namespaces.test.mjs
//
// 本文件 2026-09-26 建,钉的是那一处 **第二类缺陷**:`const ROOT = process.cwd()`。
// 它让"扫哪棵树"由调用者站在哪个目录决定 —— 守门 70(hardcoded-zh)的镜像测试就为此 13/14 恒红
// (测试靠 cwd 定位夹具而脚本按 cwd 扫到了真仓)。那条门后来的修法就是这里用的这个:
// ROOT 由脚本自身位置推导 + 一个**只给测试用**的 `--root <dir>` 通道。
//
// 刻意**没有**把本门迁到 git 判定面(它仍判工作树磁盘,头注已如实登记,守门 118 现归 `loose-fs`)。
// 所以这里也钉一条反向锁:结论行必须说出"判定面:工作树磁盘",免得下一个人以为它已收口。
// 夹具一律落 scripts/lib/scratch-dir.mjs(工作树同盘 DevEnv/Temp),不落 C 盘活 TEMP、不落仓库树内。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-i18n-duplicate-namespaces.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = join(HERE, '..')
const REPO_ROOT = join(SCRIPTS_DIR, '..')
const SCRIPT = join(SCRIPTS_DIR, 'check-i18n-duplicate-namespaces.mjs')

function run(args, opts = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 造一份带重复键的 messages 语料(以及一个可选的干净文件,证明"没重复"时确实绿) */
function writeMessages(root, { dup = true, clean = false } = {}) {
  const dir = join(root, 'packages', 'i18n', 'messages', 'web')
  mkdirSync(dir, { recursive: true })
  if (dup) writeFileSync(join(dir, 'en.json'), '{\n "a": "1",\n "a": "2"\n}\n', 'utf8')
  if (clean) writeFileSync(join(dir, 'ko.json'), '{\n "a": "1",\n "b": "2"\n}\n', 'utf8')
  return dir
}

test('R1 ROOT 由脚本自身位置推导:默认根 = 仓库根,与 cwd 无关', () => {
  assert.equal(gate.DEFAULT_ROOT.split('\\').join('/'), REPO_ROOT.split('\\').join('/'))
  assert.equal(gate.rootFromArgv([]).root, gate.DEFAULT_ROOT)
  assert.equal(
    gate.rootFromArgv(['--staged']).root,
    gate.DEFAULT_ROOT,
    'runner 追加的 --staged 本门不认识(它仍判磁盘),但**不得**因此改变扫描根',
  )
  // 独立性由 R2 端到端证明(在仓库外的 cwd 里跑一次),这里只钉纯函数四态:
  // 缺参数值必须判死,而不是静默退回默认根去扫真仓。
  assert.equal(gate.rootFromArgv(['--root', '/tmp/wherever']).root, resolve('/tmp/wherever'))
  assert.equal(gate.rootFromArgv(['--root=inline/x']).root, resolve('inline/x'))
  assert.match(String(gate.rootFromArgv(['--root']).error), /不得静默退回仓库根/)
  assert.match(String(gate.rootFromArgv(['--root=']).error), /目录参数|必须给目录/)
})

test('R2 从仓库外的 cwd 运行仍扫到真仓(改前会打印"未找到 …,跳过"并以 exit 0 假绿)', () => {
  const dir = mkScratch('i18n-dupns-cwd')
  try {
    const r = run([], { cwd: dir })
    assert.doesNotMatch(
      r.stdout,
      /未找到 packages/,
      'cwd 在仓库外时又找不到语料了 ⇒ ROOT 又跟着 cwd 走了。改前实测:此路径 stdout = ' +
        '"⚠ 未找到 packages\\i18n\\messages,跳过" 且 exit 0(门什么都没扫却报通过)',
    )
    assert.match(
      r.stdout,
      /判定面:HEAD blob/,
      '默认档必须如实说出判的是 HEAD blob(2026-09-26 收口)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('R3 --root 只作 --worktree 档的夹具通道:指到夹具 ⇒ 只扫夹具;缺值或错档 ⇒ exit 2', () => {
  const dir = mkScratch('i18n-dupns-fixture')
  try {
    writeMessages(dir, { dup: true })
    const hit = run(['--worktree', '--root', dir])
    assert.equal(hit.status, 1, `夹具里有重复键必须红\n${hit.stdout}`)
    assert.match(hit.stdout, /判定面:工作树/, '换根不换面:这条路径判的仍是磁盘,必须说出来')
    assert.ok(
      !/messages\/(shared|cli|mobile-rn)\//.test(hit.stdout.replace(/\\/g, '/')),
      '只该扫到夹具那一个文件 —— 扫到真仓的端说明 --root 没生效',
    )
    assert.equal(hit.stdout.match(/❌ packages\/i18n\/messages\/web\/en\.json/g)?.length, 1)

    const clean = mkScratch('i18n-dupns-clean')
    try {
      writeMessages(clean, { dup: false, clean: true })
      const ok = run(['--worktree', '--root', clean])
      assert.equal(ok.status, 0, `无重复键必须绿\n${ok.stdout}`)
    } finally {
      rmScratch(clean)
    }

    const noValue = run(['--worktree', '--root'])
    assert.equal(noValue.status, 2, `--root 不给值必须判死,实得 ${noValue.status}`)
    assert.match(noValue.stdout + noValue.stderr, /不得静默退回仓库根/)

    const inline = run([`--worktree`, `--root=${dir}`])
    assert.equal(inline.status, 1, '--root=<dir> 内联形态与分开形态必须同判')

    // 双根分裂锁:换根而面仍是 git 面 ⇒ 会读到"夹具的根 × HEAD 的内容",直接判死
    const wrongFace = run(['--root', dir])
    assert.equal(
      wrongFace.status,
      2,
      `--root 在非 --worktree 档必须判死(实得 ${wrongFace.status}):\n${wrongFace.stdout}`,
    )
    assert.match(wrongFace.stdout + wrongFace.stderr, /只在 --worktree 档有效/)
  } finally {
    rmScratch(dir)
  }
})

test('R4 形状锁:ROOT 不得取 cwd;取材必须走面层的 catBatch(收口不得被悄悄退回去)', () => {
  // 本文件顶部 import 了该模块而测试仍能跑完 —— 这本身就是 §22d 守卫在位的证据:
  // 若仍是顶层裸 main(),import 即执行一次扫描并 process.exit,整个测试文件会无声结束。
  assert.equal(typeof gate.faceFromArgv, 'function')
  const code = readFileSync(SCRIPT, 'utf8')
  // 锚到"语句行"而不是任意子串:本文件头注里就**逐字引用**了那句旧代码当反面教材,
  // 不锚行首的形状锁会被自己的文档判红(= "门让你怎么写,门就看不见怎么写"的同一条教训,
  // 只是这次方向反过来:文档里的反例不能冒充违规)。
  assert.doesNotMatch(
    code,
    /^const ROOT = process\.cwd\(\)/m,
    'cwd 定根那一型又回来了(扫描根又跟着调用者的 cwd 走了)',
  )
  assert.match(
    code,
    /const\s+ROOT\s*=\s*resolve\(\s*dirname\(\s*fileURLToPath\(\s*import\.meta\.url\s*\)\s*\)\s*,\s*'\.\.'\s*\)/,
  )
  // 2026-09-26 收口后方向反过来:本门**必须**走取材层。旧版这里钉的是"没有引 face-reader",
  // 那把锁的作用是让"未收口"看得见 —— 收口之后若继续留着,它就会把已收口的事实反向锁成缺陷。
  assert.match(code, /from '\.\/lib\/face-reader\.mjs'/, '取材必须走面层(引了层却自己读盘=半接线)')
  assert.match(code, /catBatch\(/, '内容必须来自同一次 cat-file --batch(同面同轮)')
  assert.doesNotMatch(
    code,
    /^const\s+\w+\s*=\s*join\(ROOT,/m,
    '又出现以 ROOT 拼磁盘路径的生产常量 ⇒ 收口在退化',
  )
  assert.match(code, /判定面|FACE_TXT/, '面声明必须在位:未说面的门会被读成"当然判磁盘"')
  // 脚本被 import 时不得有副作用(§22d):上面 import 本模块成功即证明 main() 没被执行,
  // 这里再钉一次守卫本身在位,防止有人删掉 isDirectRun 判断让测试 import 就 process.exit。
  assert.match(code, /pathToFileURL\(process\.argv\[1\]\)\.href/)
})

test('R5 faceFromArgv 纯函数四态:默认 HEAD、--staged 索引、--worktree 逃生舱、两旗同给判死', () => {
  assert.equal(gate.faceFromArgv([]).face, 'head')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  assert.match(String(gate.faceFromArgv(['--staged', '--worktree']).error), /不得同用/)
  // runner 会追加的其余旗标不得改变默认面
  assert.equal(gate.faceFromArgv(['--staged', '--quiet', '--exit', '1']).face, 'staged')
})

test('R6 收口的全部意义:同一棵临时仓里 HEAD 干净而索引带重复键 ⇒ 三面三答,互不借面', () => {
  // 为什么走导出的 reader 而不是 CLI:ROOT 由脚本自身位置推导(R1/R4 钉的就是这条),
  // 所以 CLI 永远扫本仓 —— 想拿"另一棵仓的三个面"做构造证明,只能显式喂 repoRoot。
  // (用 cwd 骗它是被禁止的那一型:守门 70 的镜像测试曾因此 13/14 恒红。)
  const dir = mkScratch('i18n-dupns-faces')
  const git = (args) =>
    spawnSync(
      'git',
      ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', ...args],
      {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      },
    )
  try {
    for (const a of [
      ['init', '-q', '-b', 'main'],
      ['config', 'core.autocrlf', 'false'],
      ['config', 'core.quotepath', 'false'],
    ])
      assert.equal(git(a).status, 0)
    writeMessages(dir, { dup: false, clean: true })
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(git(['commit', '-qm', 'clean base']).status, 0)

    // 只把"带重复键"的那一版放进**索引与磁盘** —— HEAD 仍是干净的
    writeMessages(dir, { dup: true })
    assert.equal(git(['add', 'packages/i18n/messages/web/en.json']).status, 0)

    const dupIn = (face) => {
      const rels = gate.listJsonRelPaths(dir, face)
      assert.ok(Array.isArray(rels) && rels.length > 0, `${face} 面枚举为空 ⇒ 判死而不是判绿`)
      const texts = gate.readFaceInputs(dir, face, rels)
      return rels.some((rel) => gate.findDuplicateKeys(texts.get(rel)).length > 0)
    }
    assert.equal(dupIn('head'), false, 'HEAD 面必须干净(它没见过那次 --staged 的编辑)')
    assert.equal(dupIn('staged'), true, '索引面必须脏 —— 这次提交会把它带走')
    assert.equal(dupIn('worktree'), true, '工作树面同样看见磁盘上那份脏内容')

    // 清单与内容同面:索引里已摘除而 HEAD 仍在 ⇒ 索引面枚举不到它(不得借 HEAD 的内容凑数)
    assert.equal(git(['rm', '-r', '--cached', '-q', 'packages/i18n/messages']).status, 0)
    assert.equal(gate.listJsonRelPaths(dir, 'staged').length, 0, '索引面枚举应为 0')
    assert.ok(gate.listJsonRelPaths(dir, 'head').length > 0, 'HEAD 面仍应看得见(两面各自独立)')
    assert.throws(() => gate.readFaceInputs(dir, 'staged', ['packages/i18n/messages/web/en.json']))
  } finally {
    rmScratch(dir)
  }
})

test('R6b CLI 级:枚举到 0 个 .json 必须 exit 2 记"无法判定",而不是"无重复键"的绿', () => {
  const dir = mkScratch('i18n-dupns-empty')
  try {
    // --worktree 档 + --root 指到一棵**没有语料**的树:旧写法在这里打"未找到…跳过"并 exit 0,
    // 那正是"空扫冒充结论"的形态(本仓最高频失效型)。现在要么判死、要么如实说没找到该目录。
    const r = spawnSync(process.execPath, [SCRIPT, '--worktree', '--root', dir], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.match(
      `${r.stdout}${r.stderr}`,
      /无法判定|未找到|0 个 \.json/,
      `空目录必须给出可诊断的结论:\n${r.stdout}`,
    )
    assert.doesNotMatch(
      r.stdout,
      /✅ 无重复命名空间/,
      '什么都没扫到却报"无重复键"= 把"没判"写成"判过了"',
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
