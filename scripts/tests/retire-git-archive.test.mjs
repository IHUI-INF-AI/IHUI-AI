// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/retire-git-archive.mjs(§22c —— 源 export `__test__`、测试 import,**不得复制判据**)。
 *
 * 为什么这扇必须有(而不只是 `--self-test`):`--self-test` 跑在**同一份实现**上,它绿只证明
 * "函数会给答案";而本工具真正的危险不在算错字节,在**删错对象**——它唯一一次执行 `rmSync`
 * 落在一个指向活 gitdir 的 junction 上,就是 §26 记过的"清理层顺链接把真实目标清空"重演,
 * 而那一步在账面上表现为"回收成功 1 项"。所以本文件的三条锁都是**形状锁**,不是逻辑复读:
 *   R2 删除出口唯一(源里 `rmSync(` 必须恰好一处且在 removeEntry 体内)
 *   R3 默认档零删除(行为 + 源码形状双向)
 *   R4 §5b 名单永不出现在删除路径参数里(注入 spy remove,拿被传的路径做断言)
 *
 * 夹具一律走 mkScratch(§26:不落仓库树、不落可能钉在 C 盘的 os.tmpdir),且**绝不碰真实归档根**。
 */
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, test } from 'node:test'

import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../retire-git-archive.mjs')
const SRC_URL = pathToFileURL(SRC).href
const { __test__ } = await import(SRC_URL)
const {
  DEFAULT_KEEP_GENERATIONS,
  DEFAULT_MAX_TOTAL_BYTES,
  MIN_AGE_MS,
  isInsideRoot,
  stemOf,
  protectedReason,
  hasAccidentSignature,
  measureBytes,
  classifyEntry,
  listEntries,
  planRetirement,
  removeEntry,
  applyPlan,
  runMain,
} = __test__

const made = []
const box = (name) => {
  const d = mkScratch(`retire-${name}-`)
  made.push(d)
  return d
}
after(() => {
  for (const d of made) {
    try {
      rmScratch(d)
    } catch {
      /* Windows 上 junction 目标偶尔持锁;残留由 §26 每日 Temp 体检兜,不得为此改判据 */
    }
  }
})

const mkArch = (parent) => {
  const arch = join(parent, 'git-archive')
  mkdirSync(arch, { recursive: true })
  return arch
}
const putDir = (parent, name, ageMs, bytes = 0) => {
  const p = join(parent, name)
  mkdirSync(p, { recursive: true })
  if (bytes > 0) {
    mkdirSync(join(p, 'sub'), { recursive: true })
    writeFileSync(join(p, 'sub', 'f.bin'), Buffer.alloc(bytes, 0x61))
  }
  const ts = new Date(Date.now() - ageMs)
  utimesSync(p, ts, ts)
  return p
}
const BASE = ['IHUI-AI-git-repo', 'IHUI-AI.git-backup-20260912']
const planFrom = (arch, opts = {}) => {
  const now = Date.now()
  const entries = listEntries(arch).map((n) =>
    classifyEntry({ root: arch, name: n, now, baseNames: opts.baseNames ?? BASE }),
  )
  return { plan: planRetirement({ entries, now, ...opts }), now }
}

test('T1 §22c 成套性:源必须有 __test__ 且本文件是真 import(不是把判据抄进测试)', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /export const __test__ = \{/, '源未 export __test__')
  for (const key of [
    'classifyEntry',
    'planRetirement',
    'removeEntry',
    'applyPlan',
    'measureBytes',
    'isInsideRoot',
    'protectedReason',
  ]) {
    assert.match(
      src,
      new RegExp(`\\b${key}[,:}]`),
      `__test__ 未导出 ${key}(export 漂了就等于测试在跑自己抄的判据)`,
    )
  }
  // 反向锁:测试里不得出现第二份分类/判定实现。
  // ⚠️ 探针必须**拼出来**,不得写成字面量正则:`/function classifyEntry/` 这种写法会被
  // 本文件自己的源码文本命中(第一版就是这样,判据把自己写在数组里的那行判成了违规 ——
  // 与守门 103/D3 记过的"说明性文字也带执行性字符"同一型)。
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  for (const key of [
    'classifyEntry',
    'planRetirement',
    'protectedReason',
    'hasAccidentSignature',
    'removeEntry',
    'applyPlan',
    'measureBytes',
    'isInsideRoot',
  ]) {
    const needle = new RegExp('function\\s+' + key + '\\s*[({]')
    assert.ok(!needle.test(self), `测试里出现被禁止的判据副本:${key}`)
  }
})

test('T2 形状锁:删除出口唯一(代码面 rmSync 恰好一处,且在 removeEntry 体内)', () => {
  const src = readFileSync(SRC, 'utf8')
  // 计数必须走**遮罩后的代码面** —— 本文件头注里就写了"唯一一处 rmSync("这句话,
  // 拿原文计数等于让门把自己解释自己的散文判成违规(守门 131/135 同一课)。
  // 遮罩实现只有一份(scripts/lib/code-mask.mjs),禁止在测试里再抄一份字符串状态机。
  const code = maskCommentsAndStrings(src)
  const calls = code.match(/\brmSync\s*\(/g) || []
  assert.equal(
    calls.length,
    1,
    `代码面 rmSync 出现 ${calls.length} 处 ⇒ 删除长了第二个出口,§5b 名单的复验只覆盖其中一个`,
  )
  const body = /export function removeEntry\([\s\S]*?\n\}/.exec(code)
  assert.ok(body, '解析不出 removeEntry 函数体 ⇒ 唯一性无从判定(不得当成通过)')
  assert.ok(/rmSync\s*\(/.test(body[0]), '唯一的 rmSync 不在 removeEntry 体内')
  // 也不得绕道 shell 删(那会完全跳过三条现场复验)。
  for (const forbidden of [/execFileSync\([^)]*rm\b/, /\bunlinkSync\s*\(/, /shell:\s*true/]) {
    assert.ok(!forbidden.test(code), `代码面出现绕道删除的形态:${forbidden}`)
  }
})

test('T3 形状锁 + 行为锁:默认档零删除', async () => {
  // 源码形状:dry-run 分支必须是"根本不进循环体",而不是"进去了但没删"。
  const src = readFileSync(SRC, 'utf8')
  assert.match(
    src,
    /if \(!apply\) continue/,
    'applyPlan 的 dry-run 早退分支被改写 ⇒ "零删除"退化成一次性判断',
  )
  assert.match(
    src,
    /if \(!apply\) \{[\s\S]{0,600}?return plan\.undetermined\.length \? 2 : 0/,
    'runMain 必须在不 apply 时直接返回,不得触到 applyPlan',
  )
  // 行为:CLI 缺省档跑真夹具 ⇒ 条目一项不少。
  const b = box('t3')
  const arch = mkArch(b)
  for (let i = 1; i <= 13; i++) putDir(arch, `ihui-git-write.lock.stale-3-${3000 + i}-a`, i * 60000)
  const before = listEntries(arch)
  const lines = []
  const code = await runMain({
    argv: ['--root', arch, '--allow-custom-root'],
    stdout: (s) => lines.push(s),
    stderr: () => {},
  })
  assert.equal(code, 0, `缺省档退出码应为 0,实为 ${code}`)
  assert.deepEqual(
    listEntries(arch),
    before,
    '默认档删了东西(即使只"多"一项也算,顺序变了就是被动过)',
  )
  assert.ok(
    lines.some((l) => /dry-run/.test(l)),
    '缺省档必须自报"未发起删除"',
  )
  assert.ok(!existsSync(join(b, '.workbuddy')), '零删除时不得创建留痕文件')
})

test('T4 形状锁:§5b 名单与重解析点永不出现在删除路径参数里(阳性对照:注入指向活 gitdir 的 junction)', (t) => {
  const b = box('t4')
  const arch = mkArch(b)
  const liveGitdir = join(b, 'IHUI-AI-git-repo') // 伪装"活 gitdir"(真实形状,不碰本机真身)
  mkdirSync(join(liveGitdir, 'objects'), { recursive: true })
  writeFileSync(join(liveGitdir, 'HEAD'), 'ref: refs/heads/main\n')
  const scenes = [
    putDir(arch, 'IHUI-AI-git-repo.broken-1790150361407', 3 * 60000),
    putDir(arch, 'IHUI-AI.git-backup-20260912.broken-1790150479288', 4 * 60000),
    putDir(arch, 'bundles', 5 * 60000),
    // 反面项:没有它,本测试的"名单没进删除参数"会因为"什么都不会被删"而恒真 ——
    // 那正是本文件里 `attempted.length > 0` 这条断言存在的全部理由。
    putDir(arch, 'ihui-git-write.lock.stale-0-0-legit', 2 * 60000),
  ]
  const mustNotBeDeleted = scenes.slice(0, 3)
  let linkPath = null
  try {
    linkPath = join(arch, 'ihui-git-write.lock.stale-9-9-jj')
    symlinkSync(liveGitdir, linkPath, 'junction')
  } catch (e) {
    t.diagnostic(`本机建不了 junction(${e.code})⇒ 链接臂降级为源码级锁`)
    const src = readFileSync(SRC, 'utf8')
    assert.match(src, /isSymbolicLink\(\)/)
    assert.match(src, /P-a 重解析点/)
  }
  const { plan, now } = planFrom(arch, { keep: 0, maxTotalBytes: 1 }) // 两条上限都拧到最严
  const attempted = []
  const spyRemove = (arg) => {
    attempted.push(arg.path)
    return { ok: false, why: 'spy 不删' }
  }
  applyPlan({ root: arch, plan, apply: true, remove: spyRemove, now, baseNames: BASE })
  assert.ok(attempted.length > 0, '最严档一项都没尝试 ⇒ 判据没牙(空跑不算证明)')
  for (const s of mustNotBeDeleted)
    assert.ok(!attempted.includes(s), `§5b 名单/未验明项被传给删除出口:${s}`)
  assert.ok(attempted.includes(scenes[3]), '合法项必须真被尝试删除 —— 否则上面三条只是"什么都不做"')
  assert.ok(
    plan.protected.some((e) => /stale-9-9-jj/.test(e.name)) || !linkPath,
    '注入的 junction 必须被点名',
  )
  if (linkPath) {
    assert.ok(
      !attempted.includes(linkPath),
      'junction 被传给删除出口 ⇒ §26 顺链接清空真实目标那一型未被拦住',
    )
    assert.ok(existsSync(join(liveGitdir, 'HEAD')), '活 gitdir 伪装件被清空')
    const named = plan.protected.find((e) => e.path === linkPath)
    assert.ok(
      named && /fake|IHUI-AI-git-repo|重解析点/.test(named.reason),
      'junction 必须被点名,不是被静默过滤',
    )
  }
  assert.ok(
    plan.protected.some((e) => /\.git-backup-/.test(e.name)),
    '恢复源现场未被挡',
  )
})

test('T5 双上限:11 项恰好删最旧 1 项;字节档独立生效', () => {
  const b = box('t5')
  const arch = mkArch(b)
  for (let i = 1; i <= 11; i++)
    putDir(arch, `ihui-git-write.lock.stale-5-${5000 + i}-g${i}`, i * 60000)
  const p1 = planFrom(arch, { keep: DEFAULT_KEEP_GENERATIONS }).plan
  assert.equal(p1.retire.length, 1, `keep=10 时 11 项应删 1,实删 ${p1.retire.length}`)
  assert.equal(DEFAULT_KEEP_GENERATIONS, 10, '用户拍板的"保留最近 10 代"被改了')
  assert.equal(
    DEFAULT_MAX_TOTAL_BYTES,
    2 * 1024 * 1024 * 1024,
    '第二上限默认值不再是 2GB(票面要求:我替用户定的档位)',
  )

  const b2 = box('t5b')
  const arch2 = mkArch(b2)
  putDir(arch2, 'ihui-git-write.lock.stale-5-1-a', 30 * 60000, 5 * 1048576)
  putDir(arch2, 'ihui-git-write.lock.stale-5-2-b', 20 * 60000, 5 * 1048576)
  const gen = planFrom(arch2, { keep: 10, maxTotalBytes: DEFAULT_MAX_TOTAL_BYTES }).plan
  assert.equal(gen.retire.length, 0, '世代与字节都没超时不得判删')
  const by = planFrom(arch2, { keep: 10, maxTotalBytes: 6 * 1048576 }).plan
  assert.equal(by.retire.length, 1, '仅超字节时必须删 1 项')
  assert.match(by.retire[0].retireReason, /bytes>cap/)
  assert.ok(
    by.keepSet.some((e) => /-b$/.test(e.name)),
    '字节档必须留**最新**那件;留了旧的说明退场顺序反了',
  )
})

test('T6 mtime 稳定窗:1 秒内的条目永不回收,过期项照删', () => {
  const b = box('t6')
  const arch = mkArch(b)
  const old = putDir(arch, 'ihui-git-write.lock.stale-6-1-old', 9 * 60000)
  const fresh = putDir(arch, 'ihui-git-write.lock.stale-6-2-fresh', 0)
  const { plan } = planFrom(arch, { keep: 0, maxTotalBytes: 1 })
  assert.equal(plan.inFlight.length, 1)
  assert.equal(plan.inFlight[0].path, fresh)
  assert.ok(!plan.retire.some((e) => e.path === fresh), '稳定窗内的项进了将删清单')
  assert.ok(plan.retire.some((e) => e.path === old))
  assert.equal(MIN_AGE_MS, 1000, '稳定窗档位漂了')
})

test('T7 measureBytes 不跟随重解析点(跟随会把 D 盘真实目标算进候选体积)', (t) => {
  const b = box('t7')
  const arch = mkArch(b)
  const inside = putDir(arch, 'ihui-git-write.lock.stale-7-1-real', 60 * 60000, 3 * 1048576)
  let link = null
  try {
    link = join(arch, 'ihui-git-write.lock.stale-7-2-link')
    symlinkSync(inside, link, 'junction')
  } catch (e) {
    t.diagnostic(`建 junction 失败(${e.code})⇒ 退化为源码锁`)
    assert.match(readFileSync(SRC, 'utf8'), /isSymbolicLink\(\)/)
    return
  }
  const row = classifyEntry({
    root: arch,
    name: 'ihui-git-write.lock.stale-7-2-link',
    baseNames: BASE,
  })
  assert.equal(row.kind, 'protected')
  assert.match(row.reason, /重解析点/)
  assert.equal(measureBytes(link).bytes, null, '链接本体被量了体积')
  assert.equal(
    measureBytes(inside).bytes,
    3 * 1048576,
    '真身量不到 ⇒ 候选合计会偏小到伪装成"没超上限"',
  )
})

test('T8 removeEntry 的三条现场复验各自独立成立', () => {
  const b = box('t8')
  const arch = mkArch(b)
  const now = Date.now()
  // ① 越界
  const outside = putDir(b, 'IHUI-AI-git-repo', 50 * 60000)
  const r1 = removeEntry({
    root: arch,
    path: outside,
    name: 'IHUI-AI-git-repo',
    now,
    baseNames: BASE,
  })
  assert.ok(!r1.ok && /越界/.test(r1.why), `越界未拒收:${JSON.stringify(r1)}`)
  assert.ok(existsSync(outside), '拒收却仍删了')
  // ② §5b 名单(即便路径在根内)
  const inRoot = putDir(arch, 'IHUI-AI.git-backup-20260912.broken-1', 50 * 60000)
  const r2 = removeEntry({
    root: arch,
    path: inRoot,
    name: 'IHUI-AI.git-backup-20260912.broken-1',
    now,
    baseNames: BASE,
  })
  assert.ok(!r2.ok && /§5b/.test(r2.why), `恢复源现场未拒收:${JSON.stringify(r2)}`)
  // ③ 稳定窗
  const fresh = putDir(arch, 'ihui-git-write.lock.stale-8-3-fresh', 0)
  const r3 = removeEntry({
    root: arch,
    path: fresh,
    name: 'ihui-git-write.lock.stale-8-3-fresh',
    now,
    baseNames: BASE,
  })
  assert.ok(!r3.ok && /正在写/.test(r3.why), `在写项未拒收:${JSON.stringify(r3)}`)
  // 反面:合规项必须真能删(否则上面三条可能只是"什么都不做")
  const ok = putDir(arch, 'ihui-git-write.lock.stale-8-4-legit', 60 * 60000)
  const r4 = removeEntry({
    root: arch,
    path: ok,
    name: 'ihui-git-write.lock.stale-8-4-legit',
    now,
    baseNames: BASE,
  })
  assert.ok(r4.ok, `合法项删不掉:${JSON.stringify(r4)}`)
  assert.ok(!existsSync(ok))
})

test('T9 判定辅助函数的形状(名字/签名识别、大小写、祖先滚量)', () => {
  assert.equal(stemOf('IHUI-AI-git-repo.broken-1790150361407'), 'IHUI-AI-git-repo')
  assert.equal(stemOf('ihui-git-write.lock.stale-1-2-ab'), 'ihui-git-write.lock')
  assert.ok(hasAccidentSignature('a.lock.stale-1-2-x'))
  assert.ok(!hasAccidentSignature('bundles'))
  assert.ok(
    protectedReason('IHUI-AI-git-repo.broken-1', []),
    '-git-repo 形态必须由通用规则也挡住(派生名单不是唯一凭据)',
  )
  assert.equal(protectedReason('ihui-git-write.lock.stale-1-2-x', []), null)
  assert.ok(
    !isInsideRoot(
      'G:/DevEnv/backups/git',
      'G:/DevEnv/backups/git/IHUI-AI-git-repo'.toLowerCase() + '/../..',
    ),
  )
  assert.ok(
    isInsideRoot('G:/DevEnv/Backups/Git', 'g:/ihui-ai/../DevEnv/backups/git/x'),
    '大小写不同应仍在根内(Windows 路径不分大小写)',
  )
})

test('T10 换根必须显式声明(拿"未声明"当默认去删别的目录 = 越界)', async () => {
  const b = box('t10')
  const arch = mkArch(b)
  putDir(arch, 'ihui-git-write.lock.stale-10-1-a', 60 * 60000)
  const errs = []
  const code = await runMain({
    argv: ['--root', arch, '--apply'],
    stdout: () => {},
    stderr: (s) => errs.push(s),
  })
  assert.equal(code, 2, `未带 --allow-custom-root 却继续跑了(退出码 ${code})`)
  assert.ok(
    errs.some((l) => /越界|allow-custom-root/.test(l)),
    '拒绝时未给出出路',
  )
  assert.ok(existsSync(join(arch, 'ihui-git-write.lock.stale-10-1-a')), '拒绝前已经删了')
})

test('T11 挂点未落地必须写明,且写明的是可判条件(不是"以后再说")', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(
    src,
    /git diff --quiet HEAD -- scripts\/git-guardian\.mjs/,
    '解阻条件必须是一条可判命令,不能是"等他人收尾"',
  )
  assert.match(src, /!CHECK_ONLY/, '挂点位置必须写死在 !CHECK_ONLY 分支(挂错等于永不执行)')
  // 三条装车锁都得在头注里点名(后人按这段落地,漏一条就是"造好没装车")
  for (const probe of [/grep -c retire-git-archive/, /apply:false/, /摘掉挂点/]) {
    assert.ok(probe.test(src), `解阻说明缺了这一条锁:${probe}`)
  }
  // 且当前确实**没有**挂点 —— 若哪天有人偷偷挂了却没同步这三条,这条会红,那时补锁而不是删测试。
  const guardian = readFileSync(resolve(dirname(SRC), 'git-guardian.mjs'), 'utf8')
  if (/retire-git-archive/.test(guardian)) {
    const branch = /if \(!CHECK_ONLY\)[\s\S]*?\n  \}/.exec(guardian)
    assert.ok(
      branch && /retire-git-archive|retireGitArchive/.test(branch[0]),
      '挂点落在 CHECK_ONLY 路径 ⇒ 永不执行',
    )
  }
})

test('T12 反向对照:归档根取不到时不得冒绿也不得冒删', async () => {
  const { gitArchiveDir } = await import(
    pathToFileURL(resolve(dirname(SRC), 'lib/gitdir.mjs')).href
  )
  assert.ok(
    typeof gitArchiveDir() === 'string' || gitArchiveDir() === null,
    'gitArchiveDir 出口形状变了',
  )
  const b = box('t12')
  const errs = []
  const code = await runMain({
    argv: ['--root', join(b, 'nope'), '--allow-custom-root'],
    stdout: () => {},
    stderr: (s) => errs.push(s),
  })
  assert.equal(code, 2, `根不存在必须"无法判定",实为退出码 ${code}`)
  assert.ok(
    errs.some((l) => /无法判定/.test(l)),
    '未喊"无法判定" ⇒ 会把取数失败读成"无可删"',
  )
})
