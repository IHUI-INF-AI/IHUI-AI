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
import { basename, dirname, join, resolve } from 'node:path'
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

// ─────────────────── 冷存储层(G-264)───────────────────
const {
  DEFAULT_COLD_AGE_DAYS,
  DEFAULT_COLD_AGE_MS,
  COLD_DIR_NAME,
  COLD_LEDGER_FILE,
  IN_USE_SUBPATHS,
  coldDirOf,
  coldDiskGate,
  planColdStorage,
  makeColdLedger,
  moveEntryToCold,
  applyColdPlan,
  restoreFromCold,
  treeManifest,
  verifyCopy,
  surveyBundles,
  runColdMain,
} = __test__

const putTree = (parent, name, ageMs, spec) => {
  const p = join(parent, name)
  mkdirSync(p, { recursive: true })
  for (const [rel, bytes] of Object.entries(spec)) {
    const f = join(p, rel)
    mkdirSync(dirname(f), { recursive: true })
    writeFileSync(f, Buffer.alloc(bytes, 0x7a))
  }
  const ts = new Date(Date.now() - ageMs)
  utimesSync(p, ts, ts)
  return p
}

test('T13 冷层 CLI:默认零移动;--cold --apply 动的是"搬"不是"删"(两种少东西的形态不得互相冒充)', async () => {
  const b = box('t13')
  const arch = mkArch(b)
  const DAY = 86400000
  // 12 项超龄现场:最近 10 代被同一把尺子扣住 ⇒ 只有最旧 2 项可转(这条断言同时在测
  // "冷层不得绕过世代档"——绕过就是 12 项全搬,账面仍然是"没删任何东西",看不出来)。
  const aged = []
  for (let i = 1; i <= 12; i++)
    aged.push(
      putTree(arch, `ihui-git-write.lock.stale-13-${String(i).padStart(2, '0')}`, (40 + i) * DAY, {
        'a.bin': 4096,
      }),
    )
  const scene = putTree(arch, 'IHUI-AI-git-repo.broken-1790150361407', 500 * DAY, { 'x.bin': 10 })
  const out = []
  const errs = []
  const dry = await runMain({
    argv: ['--cold', '--root', arch, '--allow-custom-root', '--min-free-mb', '0'],
    stdout: (s) => out.push(String(s)),
    stderr: (s) => errs.push(String(s)),
  })
  assert.equal(dry, 0, `冷层 dry-run 退出码应为 0,实为 ${dry}:${errs.join('|')}`)
  for (const p of [...aged, scene]) assert.ok(existsSync(p), `dry-run 动了源:${p}`)
  assert.ok(!existsSync(coldDirOf(arch)), 'dry-run 建出了 cold/ ⇒ 只读档有副作用')
  assert.ok(
    out.some((l) => /dry-run/.test(l)),
    '冷层缺省档必须自报"未发起移动"',
  )
  assert.ok(
    out.some((l) => /超龄可转 = 2/.test(l)),
    `计划应恰好认 2 项,报告:${out.join('\n')}`,
  )
  const wet = await runMain({
    argv: ['--cold', '--apply', '--root', arch, '--allow-custom-root', '--min-free-mb', '0'],
    stdout: () => {},
    stderr: () => {},
  })
  assert.equal(wet, 0, `冷层 apply 退出码应为 0,实为 ${wet}`)
  const cd = coldDirOf(arch)
  // 名单后缀就是年龄序(-01 = 41 天 … -12 = 52 天)。最近 10 代 = 年龄最小的 10 项(-01…-10)
  // 必须留着 ⇒ 可转的只能是**最旧两项** -11/-12。写成 slice(0,2) 会把"尺子用反了"读成通过。
  const movedNames = aged.slice(10).map((p) => basename(p))
  assert.deepEqual(
    movedNames,
    ['ihui-git-write.lock.stale-13-11', 'ihui-git-write.lock.stale-13-12'],
    'fixture 的年龄序漂了 ⇒ 本用例判据失去意义(不得当成通过)',
  )
  for (const n of movedNames) assert.ok(existsSync(join(cd, n)), `可转项没落到 cold/:${n}`)
  for (const p of aged.slice(0, 10)) assert.ok(existsSync(p), `最近 10 代之内的项被搬走:${p}`)
  assert.ok(!existsSync(join(cd, 'IHUI-AI-git-repo.broken-1790150361407')), '§5b 现场被搬进冷层')
  assert.ok(existsSync(scene), '§5b 现场被动过')
  const ledger = readFileSync(join(cd, COLD_LEDGER_FILE), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
  assert.equal(ledger.length, 2, `台账应恰好 2 条,实为 ${ledger.length}`)
  for (const r of ledger) {
    assert.equal(r.op, 'cold-move')
    for (const f of ['ts', 'name', 'from', 'to', 'files', 'bytes', 'verifiedAt', 'ok'])
      assert.ok(r[f] !== undefined, `台账缺字段 ${f}:${JSON.stringify(r)}`)
    assert.equal(r.bytes, 4096, `台账字节数不对:${JSON.stringify(r)}`)
    assert.ok(
      /cold\/.+stale-13/.test(r.to) && /git-archive.+stale-13/.test(r.from),
      `台账路径不对:${r.from}→${r.to}`,
    )
  }
  // 关键区分:冷层 apply 之后归档根里**没有任何一项凭空消失**(东西只是换了个文件夹待着)
  const inRoot = listEntries(arch).filter((n) => n !== COLD_DIR_NAME)
  assert.equal(
    inRoot.length,
    11,
    `根里应剩 10 项现场 + 1 项 §5b 现场,实为 ${inRoot.length}:${inRoot}`,
  )
  const inCold = listEntries(cd).filter((n) => n !== COLD_LEDGER_FILE)
  assert.equal(inCold.length, 2, `cold/ 里应恰好 2 项,实为 ${inCold.length}`)
})

test('T14 模式互斥与越界:--cold 同时给 --restore 必须拒;换根未声明不得搬;取不到根不得冒绿', async () => {
  const b = box('t14')
  const arch = mkArch(b)
  putTree(arch, 'ihui-git-write.lock.stale-14-1', 40 * 86400000, { 'a.bin': 10 })
  const errs = []
  const clash = await runMain({
    argv: ['--cold', '--restore', 'x', '--root', arch, '--allow-custom-root'],
    stdout: () => {},
    stderr: (s) => errs.push(String(s)),
  })
  assert.equal(clash, 2, '两种模式同给必须判死,不得挑一个执行')
  assert.ok(
    errs.some((l) => /不得同给/.test(l)),
    `未给出路:${errs.join('|')}`,
  )
  assert.ok(existsSync(join(arch, 'ihui-git-write.lock.stale-14-1')), '拒了却还是动了源')
  // 换根未声明 ⇒ 冷层也不许动(与删除档同一条)
  const errs2 = []
  const code = await runMain({
    argv: ['--cold', '--apply', '--root', arch],
    stdout: () => {},
    stderr: (s) => errs2.push(String(s)),
  })
  assert.equal(code, 2, `未带 --allow-custom-root 却继续搬了(退出码 ${code})`)
  assert.ok(existsSync(join(arch, 'ihui-git-write.lock.stale-14-1')), '拒绝前已经搬走')
  assert.ok(
    errs2.some((l) => /allow-custom-root|越界/.test(l)),
    `拒绝时未给出路:${errs2.join('|')}`,
  )
  // 根不存在 ⇒ 无法判定(不得读成"无项可转" = 通过)
  const errs3 = []
  const code3 = await runMain({
    argv: ['--cold', '--root', join(b, 'nope'), '--allow-custom-root'],
    stdout: () => {},
    stderr: (s) => errs3.push(String(s)),
  })
  assert.equal(code3, 2, `冷层根取不到必须"无法判定",实为 ${code3}`)
  assert.ok(
    errs3.some((l) => /无法判定/.test(l)),
    '未喊"无法判定"',
  )
  // 阈值非法 ⇒ 判死,不得回落到默认值偷偷跑
  const code4 = await runMain({
    argv: ['--cold', '--cold-days', '0', '--root', arch, '--allow-custom-root'],
    stdout: () => {},
    stderr: () => {},
  })
  assert.equal(code4, 2, 'cold-days=0 会让"一切现场立刻可转" ⇒ 必须拒')
  assert.equal(DEFAULT_COLD_AGE_DAYS, 30, '用户拍板的 30 天阈值被改了')
  assert.equal(DEFAULT_COLD_AGE_MS, 30 * 86400000, '阈值换算漂了')
})

test('T15 反向命令:restore 逐字节回位、拒绝覆盖、拒绝越界名、找不到项不得记通过', () => {
  const b = box('t15')
  const arch = mkArch(b)
  const coldDir = coldDirOf(arch)
  mkdirSync(coldDir, { recursive: true })
  const name = 'ihui-git-write.lock.stale-15-1'
  const src = putTree(arch, name, 40 * 86400000, { 'a.bin': 4000, 'sub/b.bin': 900 })
  const before = treeManifest(src)
  const ledger = makeColdLedger(coldDir)
  const now = Date.now()
  const entry = classifyEntry({ root: arch, name, now, baseNames: BASE })
  const mv = applyColdPlan({
    root: arch,
    coldDir,
    cold: { move: [entry] },
    now,
    apply: true,
    ledger,
    baseNames: BASE,
  })
  assert.equal(mv.moved.length, 1, `前置:转冷未成:${JSON.stringify(mv)}`)
  const dry = restoreFromCold({ root: arch, coldDir, name, now, ledger, baseNames: BASE })
  assert.ok(dry.dryRun === true && !existsSync(src), 'restore 缺省档必须零副作用')
  assert.ok(existsSync(join(coldDir, name)), 'dry-run 却把冷侧清了两')
  const rs = restoreFromCold({
    root: arch,
    coldDir,
    name,
    now: Date.now(),
    apply: true,
    ledger,
    baseNames: BASE,
  })
  assert.ok(rs.restored, `回位失败:${JSON.stringify(rs)}`)
  const after = treeManifest(src)
  assert.ok(verifyCopy(before, after).ok, '回位后的字节与转冷前那一份不等 ⇒ 往返不闭合')
  assert.equal(after.bytes, 4900)
  assert.equal(after.files.size, 2)
  // 冷层里的 junction(注入"当前被引用"的对象)必须拒收且不跟随
  const live = join(b, 'IHUI-AI-git-repo')
  mkdirSync(join(live, 'objects'), { recursive: true })
  writeFileSync(join(live, 'HEAD'), 'ref: refs/heads/main\n')
  let linkNote = '本机建不了 junction ⇒ 链接臂降级为源码锁'
  try {
    symlinkSync(live, join(coldDir, 'ihui-git-write.lock.stale-15-link'), 'junction')
    const r = restoreFromCold({
      root: arch,
      coldDir,
      name: 'ihui-git-write.lock.stale-15-link',
      now: Date.now(),
      apply: true,
      ledger,
      baseNames: BASE,
    })
    assert.ok(!r.restored && /重解析点/.test(r.why), `冷侧 junction 未拒收:${JSON.stringify(r)}`)
    assert.ok(existsSync(join(live, 'HEAD')), '跟随 junction 伤了活 gitdir 伪装件')
    assert.ok(existsSync(join(coldDir, 'ihui-git-write.lock.stale-15-link')), '链接本体被代断')
    linkNote = 'cold/ 内 junction 已注入并拒收'
  } catch (e) {
    const why = `${e?.code ?? ''} ${e?.message ?? ''}`
    if (!/EPERM|ENOSYS|EBUSY|EACCES|symlink|junction/i.test(why)) throw e
  }
  // 源码锁与行为断言**各自独立成立**:上一条 catch 只兜"本机造不出 junction"这一种
  // 环境失败,判据本身不得当错误出口(否则行为断言一挂就顺着 catch 走,而正则恒真 ⇒ 恒绿)。
  assert.match(readFileSync(SRC, 'utf8'), /isSymbolicLink\(\)/)
  console.info(`  · 链接臂:${linkNote}`)
  // 原位有同名 ⇒ 拒绝覆盖(绝不静默选边)
  const name2 = 'ihui-git-write.lock.stale-15-2'
  putTree(arch, name2, 40 * 86400000, { 'a.bin': 10 })
  applyColdPlan({
    root: arch,
    coldDir,
    cold: { move: [classifyEntry({ root: arch, name: name2, now: Date.now(), baseNames: BASE })] },
    now: Date.now(),
    apply: true,
    ledger,
    baseNames: BASE,
  })
  putTree(arch, name2, 1000, { 'collision.bin': 7 })
  const clash = restoreFromCold({
    root: arch,
    coldDir,
    name: name2,
    now: Date.now(),
    apply: true,
    ledger,
    baseNames: BASE,
  })
  assert.ok(!clash.restored && /拒绝覆盖/.test(clash.why), `同名冲突未拒:${JSON.stringify(clash)}`)
  assert.ok(existsSync(join(arch, name2, 'collision.bin')), '别人的在途同名件被冲掉')
  assert.ok(existsSync(join(coldDir, name2)), '被拒却清了冷侧')
  for (const bad of ['../escape', 'a/b', '.', '..']) {
    const r = restoreFromCold({ root: arch, coldDir, name: bad, apply: true, ledger })
    assert.ok(!r.restored, `越界名字被接受:${bad}`)
    assert.ok(/单个路径段|cold\/ 里没有/.test(r.why), `越界名理由不明确:${bad}::${r.why}`)
  }
  const miss = restoreFromCold({ root: arch, coldDir, name: 'nope', apply: true, ledger })
  assert.ok(miss.missing && !miss.restored, '找不到项必须单独成态(不得记通过)')
})

test('T16 形状锁 + 行为锁:冷层不得长出第二个删除出口,且"校验先于动源"的次序不得漂', async () => {
  const src = readFileSync(SRC, 'utf8')
  const code = maskCommentsAndStrings(src)
  // ① 唯一删除出口这条锁对冷层同样成立:移动的实现里不得出现第二个 rmSync / 不得借 renameSync 跳校验
  const calls = code.match(/\brmSync\s*\(/g) || []
  assert.equal(calls.length, 1, `代码面 rmSync 出现 ${calls.length} 处 ⇒ 冷层长了第二个删除出口`)
  assert.ok(!/\brenameSync\s*\(/.test(code), '冷层不得用 rename 绕过"copy + 逐文件校验"')
  // 取函数体:从 `export function 名字(` 到**顶格且后面紧跟换行**的那个 } 为止
  // (签名默认参数也顶格闭合,但它写成 `}) {` —— 后面不是换行,据此区分)。
  // 为什么不用 indexOf 相对位置锁判序:新加的分支自己就含被定位的 token,位置锁会把
  // "正确实现"读成"次序漂了"(本次修复的直接原因)⇒ 判序一律用行为断言钉(见 ②′)。
  const bodyOf = (fn) => {
    const hit = new RegExp('^export (?:async )?function ' + fn + '\\(', 'm').exec(code)
    const at = hit ? hit.index : -1
    assert.ok(at >= 0, `源码里找不到 export function ${fn}(被改名/被删 ⇒ 不得当成通过)`)
    for (let k = code.indexOf('\n', at); k < code.length; k++) {
      if (code[k] !== '}' || (k > 0 && code[k - 1] !== '\n')) continue
      if (code[k + 1] === '\n' || k + 1 >= code.length) return code.slice(at, k + 1)
    }
    assert.fail(`${fn} 找不到函数体结尾 ⇒ 唯一性/接线无从判定(不得当成通过)`)
  }
  // ② 出口接线:函数在 ≠ 有人调(守门 70/76/81 同族)。逐个调用点在代码面点名。
  const mv = bodyOf('moveEntryToCold')
  for (const probe of [
    /guard = coldMoveGuard/,
    /manifest = treeManifest/,
    /copy = copyTree/,
    /verify = verifyCopy/,
    /remove = removeEntry/,
  ])
    assert.ok(probe.test(mv), `moveEntryToCold 缺默认出口:${probe}`)
  assert.ok(/!v\.ok/.test(mv), '校验不等必须早退(否则 verify 只是装饰品)')
  assert.ok(/if \(!apply\) return/.test(mv), '单项级也要有 dry-run 早退(不能只靠上层)')
  const acp = bodyOf('applyColdPlan')
  assert.ok(/if \(!apply\) continue/.test(acp), '冷层批量档缺早退')
  // 接线有两种写法:直接调用 `fn(` 与"作为默认出口绑上再被调用"(move = moveEntryToCold ⇒ move())。
  // 只认前者会把后者判成"无人调用"假阳;只认名字出现又会被默认参数自己满足 ⇒ 两种都得点名。
  assert.ok(/move = moveEntryToCold/.test(acp), 'applyColdPlan 没把移动出口绑成默认值')
  assert.ok(/\bmove\(\{/.test(acp), 'applyColdPlan 绑了移动出口却没调用 = 出口只是签名上的装饰')
  for (const [fn, caller] of [
    ['restoreFromCold', 'runColdMain'],
    ['planColdStorage', 'runColdMain'],
    ['surveyBundles', 'runColdMain'],
    ['applyColdPlan', 'runColdMain'],
  ])
    assert.ok(
      new RegExp(fn + '\\(\\{?').test(bodyOf(caller)),
      `${fn} 在 ${caller} 里无人调用 = 出口造好没装车(守门 70 同族)`,
    )
  assert.ok(/coldDiskGate\(\{?/.test(bodyOf('runColdMain')), '冷层没接磁盘余量闸门')
  // ②″ 唯一删除出口的**注入面**也要钉:默认参数不得把清源/清冷侧绑到裸 rmSync 上。
  //     (只数 `rmSync(` 调用点会被这种写法绕开:值位上的 fs.rmSync 不带括号 ⇒ T2 那条计数锁看不见)
  assert.ok(
    !/(?:remove|rm)\s*=\s*[\w.]*rmSync/.test(code),
    '默认出口被绑成裸 rmSync ⇒ 绕过 removeEntry 的四条现场复验(§5b/越界/重解析/稳定窗)',
  )
  assert.ok(
    /remove = removeEntry/.test(bodyOf('restoreFromCold')),
    '反向命令的清冷侧出口必须是 removeEntry',
  )
  // ②′ 判序的行为锁:把 guard/manifest/copy/verify/remove 全部包一层记录器,看**实际调用次序**。
  //     次序漂了(先 remove 后 verify)这个序列就变 ⇒ 就是"先删后验";这里没有文本位置可比。
  const b = box('t16seq')
  const arch = mkArch(b)
  const src16 = putTree(arch, 'ihui-git-write.lock.stale-16', 40 * 86400000, { 'a.bin': 5 })
  const entry = { name: basename(src16), path: src16 }
  const realGuard = __test__.coldMoveGuard
  const realManifest = __test__.treeManifest
  const seen = []
  const stubs = {
    root: arch,
    coldDir: coldDirOf(arch),
    entry,
    apply: true,
    ledger: () => {},
    guard: (a) => {
      seen.push('guard')
      return realGuard(a)
    },
    manifest: (p) => {
      seen.push(p === src16 ? 'manifest:src' : 'manifest:dst')
      return realManifest(p)
    },
    copy: (s, d, m) => {
      seen.push('copy')
      return { ok: true, copied: m.files }
    },
    verify: (a, _c) => {
      seen.push('verify')
      return { ok: true, files: a.files, bytes: a.bytes }
    },
    remove: (_a) => {
      seen.push('remove')
      return { ok: true }
    },
  }
  const ok1 = await __test__.moveEntryToCold(stubs)
  assert.ok(ok1.moved, `五项出口没按顺序挂上:${JSON.stringify(ok1)}`)
  assert.deepEqual(
    seen,
    ['guard', 'manifest:src', 'copy', 'manifest:dst', 'verify', 'remove'],
    `实际调用次序 = ${seen.join('→')},必须是 guard→清单→copy→清单→校验→才动源`,
  )
  assert.ok(existsSync(src16), '本用例的 remove 出口是替身,源必须原样在')
  const seen2 = []
  const bad = await __test__.moveEntryToCold({
    ...stubs,
    verify: (_a, _c) => {
      seen2.push('verify')
      return { ok: false, why: '模拟:副本与源逐文件不一致' }
    },
    remove: (_a) => {
      seen2.push('remove')
      return { ok: true }
    },
  })
  assert.ok(!bad.moved && bad.verifyFailed, '校验不等仍动了源')
  assert.ok(!seen2.includes('remove'), `校验不等却仍调用了动源出口:${seen2}`)
  assert.ok(existsSync(src16), '校验不等时源必须原样在')
  // ③ 三条与删除档同形的判据必须**都在**冷层执行期复验里出现(不是只在计划期)
  const guard = bodyOf('coldMoveGuard')
  for (const probe of [
    /inUseReason\(/,
    /protectedReason\(/,
    /isInsideRoot\(/,
    /isSymbolicLink\(\)/,
    /coldAgeMs/,
  ])
    assert.ok(probe.test(guard), `coldMoveGuard 少了这条复验:${probe}`)
  // ④ 在用名单不得为空:空 = C-u 那一整档静默失效
  assert.ok(IN_USE_SUBPATHS.includes('broken-refs'), 'broken-refs 是在用归档落点,必须在册')
  assert.equal(COLD_DIR_NAME, 'cold', '冷层落点名漂了 ⇒ 台账与恢复路径都指错地方')
})

test('T18 单项出口 + 余量闸门 + runColdMain 直连:三条都得自己成立(不能只靠上层拼装)', async () => {
  const b = box('t18')
  const arch = mkArch(b)
  const DAY = 86400000
  const name = 'ihui-git-write.lock.stale-18-1'
  const src = putTree(arch, name, 60 * DAY, { 'a.bin': 1000, 'sub/b.bin': 250 })
  const now = Date.now()
  const entry = classifyEntry({ root: arch, name, now, baseNames: BASE })
  // ① 单项级 dry-run:不动源、不建 cold/
  const dry = moveEntryToCold({
    root: arch,
    coldDir: coldDirOf(arch),
    entry,
    now,
    apply: false,
    baseNames: BASE,
  })
  assert.ok(dry.dryRun === true && !dry.moved, `单项 dry-run 返回态不对:${JSON.stringify(dry)}`)
  assert.ok(existsSync(src) && !existsSync(coldDirOf(arch)), '单项 dry-run 有副作用')
  // ② 真搬一项:源消失、冷侧完整、字节数与清单同值
  const ledger = makeColdLedger(coldDirOf(arch))
  const mv = moveEntryToCold({
    root: arch,
    coldDir: coldDirOf(arch),
    entry,
    now,
    apply: true,
    ledger,
    baseNames: BASE,
  })
  assert.ok(mv.moved, `单项转冷失败:${JSON.stringify(mv)}`)
  assert.ok(!existsSync(src) && existsSync(join(coldDirOf(arch), name)))
  assert.equal(mv.bytes, 1250)
  assert.equal(mv.files, 2)
  assert.ok(
    ledger.stats.failures === 0 && existsSync(join(coldDirOf(arch), COLD_LEDGER_FILE)),
    '台账写不进 ⇒ 移动无据可查',
  )
  // ③ 余量闸门:不足 ⇒ 拒并打印实数;量不到 ⇒ 未判定(两者都不得 ok:true)
  const tight = coldDiskGate({
    neededBytes: 10 * 1048576,
    minFreeBytes: 512 * 1048576,
    probePath: 'unused',
    probe: () => ({ bytes: 3 * 1048576, why: null }),
  })
  assert.ok(
    !tight.ok && /余量不足/.test(tight.why) && /可用 3MB/.test(tight.why),
    JSON.stringify(tight),
  )
  const blind = coldDiskGate({
    neededBytes: 10 * 1048576,
    minFreeBytes: 0,
    probePath: 'unused',
    probe: () => ({ bytes: null, why: '本机 node 无 fs.statfsSync' }),
  })
  assert.ok(!blind.ok && blind.undetermined === true, '量不到必须未判定,不得 ok')
  // ④ runColdMain 直连:restore 一个不存在的名字 ⇒ 退出码 2(不记通过)
  const errs = []
  const code = await runColdMain({
    argv: ['--restore', 'no-such-item', '--apply', '--root', arch, '--allow-custom-root'],
    stdout: () => {},
    stderr: (s) => errs.push(String(s)),
  })
  assert.equal(code, 2, `找不到项必须 exit 2,实为 ${code}`)
  assert.ok(
    errs.some((l) => /无法判定|没有这一项/.test(l)),
    `未喊原因:${errs.join('|')}`,
  )
  // ⑤ 真闸门拦得住 apply:先造出"确实有一项可转"的局面,再把余量下限拧到不可能满足 ⇒ 整轮拒跑。
  //    11 项超龄 + 默认 keep=10 ⇒ 恰好 1 项超出世代档,闸门必须被问到。
  const DAY2 = 86400000
  const batch = []
  for (let i = 1; i <= 11; i++)
    batch.push(
      putTree(arch, `ihui-git-write.lock.stale-18-b${i}`, (70 + i) * DAY2, { 'a.bin': 500 }),
    )
  const absurd = ['--min-free-mb', '900000000000']
  const code2 = await runColdMain({
    argv: ['--cold', '--apply', '--root', arch, '--allow-custom-root', ...absurd],
    stdout: () => {},
    stderr: () => {},
  })
  assert.equal(code2, 1, `余量不足却放行(退出码 ${code2})`)
  for (const p of batch) assert.ok(existsSync(p), `拒跑那一轮动了源:${p}`)
  assert.equal(
    listEntries(coldDirOf(arch)).filter((n) => n.startsWith('ihui-git-write')).length,
    1,
    '拒跑那一轮仍往冷层写了东西(唯一那 1 项应是 ② 搬的)',
  )
  // ⑥ 空待转集不得因闸门判红:同一荒谬下限 + 阈值拉到 9999 天 ⇒ 无事可做 ⇒ 退出码 0。
  //    (待转集为空时去量卷余量,会把"本轮无事"报成故障 —— 与改动无关的恒红门,§12e 同型)
  const code3 = await runColdMain({
    argv: [
      '--cold',
      '--apply',
      '--cold-days',
      '9999',
      '--root',
      arch,
      '--allow-custom-root',
      ...absurd,
    ],
    stdout: () => {},
    stderr: () => {},
  })
  assert.equal(code3, 0, `无项可转却被余量闸门判红(退出码 ${code3})`)
  for (const p of batch) assert.ok(existsSync(p), '空轮次仍动了源')
})

test('T19 阈值可配:--cold-days 生效,理由文案跟着阈值走(不写死 30)', async () => {
  const b = box('t19')
  const arch = mkArch(b)
  const DAY = 86400000
  // 12 项:10 项 20 天( newest,被"最近 10 代"扣住)+ 40 天 + 50 天(超出世代档)。
  // 默认 30 天线 ⇒ 可转 2;--cold-days 45 ⇒ 只剩 50 天那项可转,40 天那项的理由必须是"未满 45 天"。
  for (let i = 1; i <= 10; i++)
    putTree(arch, `ihui-git-write.lock.stale-19-y${i}`, 20 * DAY + i * 60000, { 'a.bin': 10 })
  const a = putTree(arch, 'ihui-git-write.lock.stale-19-40d', 40 * DAY, { 'a.bin': 10 })
  const c = putTree(arch, 'ihui-git-write.lock.stale-19-50d', 50 * DAY, { 'b.bin': 10 })
  const run = async (extra) => {
    const out = []
    const code = await runMain({
      argv: ['--cold', '--root', arch, '--allow-custom-root', '--min-free-mb', '0', ...extra],
      stdout: (s) => out.push(String(s)),
      stderr: () => {},
    })
    return { code, out }
  }
  const d30 = await run([])
  assert.equal(d30.code, 0)
  assert.ok(
    d30.out.some((l) => /超龄可转 = 2/.test(l)),
    `默认 30 天线时应可转 2:${d30.out.filter((x) => /可转/.test(x)).join('|')}`,
  )
  const d45 = await run(['--cold-days', '45'])
  assert.equal(d45.code, 0)
  assert.ok(
    d45.out.some((l) => /超龄可转 = 1/.test(l)),
    `45 天线时应只剩 50d 那项可转:${d45.out.filter((x) => /可转/.test(x)).join('|')}`,
  )
  assert.ok(
    d45.out.some((l) => /stale-19-40d.*未满 45 天/.test(l)),
    '挡的理由要跟着阈值走,不得写死"30"',
  )
  assert.ok(existsSync(a) && existsSync(c), 'dry-run 动了源')
  assert.equal(DEFAULT_COLD_AGE_DAYS, 30, '默认阈值被改了(用户拍板值)')
  assert.equal(DEFAULT_COLD_AGE_MS, 30 * DAY, '阈值换算漂了')
})

test('T17 bundles/ 只报数不转,且判据输入取自真实归档形态(不是按想象的命名)', () => {
  const b = box('t17')
  const arch = mkArch(b)
  // 文件名逐字取自本机归档根现读到的那一条(G:/DevEnv/backups/git/bundles/lost-commit-0908-stash.bundle)
  const realName = 'lost-commit-0908-stash.bundle'
  putTree(arch, 'bundles', 400 * 86400000, { [realName]: 2048, 'notes.txt': 12 })
  const s = surveyBundles(arch)
  assert.ok(s.present, 'bundles/ 存在却没被登记 ⇒ 报告里那一格会静默消失')
  assert.equal(s.onlyCopySuspect, 1, `命中丢失提交/stash 语义的应 1 项:${JSON.stringify(s.items)}`)
  assert.equal(s.unknownName, 1, `名字未点明的应另计一档:${JSON.stringify(s.items)}`)
  assert.ok(s.items.some((i) => i.name === realName && /不转/.test(i.verdict)))
  // 关键:整目录不进可转清单,也不进被挡清单(它是 out-of-scope,报告里单独一桶)
  const { plan, cold } = (() => {
    const now = Date.now()
    const entries = listEntries(arch).map((n) =>
      classifyEntry({ root: arch, name: n, now, baseNames: BASE }),
    )
    const p = planRetirement({ entries, keep: 0, maxTotalBytes: Number.MAX_SAFE_INTEGER, now })
    return { plan: p, cold: planColdStorage({ plan: p, root: arch, now, baseNames: BASE }) }
  })()
  assert.equal(cold.move.length, 0, `bundles/ 一项都不该可转:${cold.move.map((e) => e.name)}`)
  assert.ok(
    plan.outOfScope.some((e) => e.name === 'bundles'),
    `bundles/ 必须报名(不得静默过滤):${plan.outOfScope.map((e) => e.name).join(',')}`,
  )
  // 变异对照:把"只报数"改成"进候选"必须被同一判据拦下 ⇒ 证明拦的是形态而不是名字巧合
  const fake = putTree(arch, 'bundles.stale-20260101-1', 400 * 86400000, { 'x.bin': 4 })
  const now2 = Date.now()
  const c2 = classifyEntry({
    root: arch,
    name: 'bundles.stale-20260101-1',
    now: now2,
    baseNames: BASE,
  })
  assert.equal(c2.kind, 'in-scope', '带 .stale- 签名的项应进候选(否则判据认不出形态)')
  const p2 = planColdStorage({
    plan: planRetirement({
      entries: [c2],
      keep: 0,
      maxTotalBytes: Number.MAX_SAFE_INTEGER,
      now: now2,
    }),
    root: arch,
    now: now2,
    baseNames: BASE,
  })
  assert.equal(
    p2.move.length,
    1,
    '同名换形态(顶层 .stale-)就必须可转 —— 拦 bundles 的是形态判据,不是名字黑名单',
  )
  assert.ok(existsSync(fake))
})

/**
 * T20 新增判定分支 C-u(在用档)要吃**真实事故形态**,不吃我想象出来的命名。
 * 形态出处(实测读到的写方):scripts/git-backup-refresh.mjs:155-157
 *   `const archDir = gitArchiveDir() …  const bd = join(archDir, 'broken-refs')  mkdirSync(bd,{recursive:true})`
 * ⇒ 归档根里长期存在一个**目录** `broken-refs/`。它平时无更新 ⇒ mtime 一路变老,400 天后
 *   正好长得像"可以转冷的老现场";而备份链每轮都往它写 ⇒ 搬走 = 让写方就地找不到落点。
 *   唯一拦得住它的是 C-u 这一档,所以把这条真实路径逐层喂进三个判定入口。
 */
test('T20 C-u 在用档:超龄的 broken-refs/ 目录不得进任何一档(计划期 + 执行期 + CLI 三处复验)', async () => {
  const b = box('t20')
  const arch = mkArch(b)
  const DAY = 86400000
  // ①′ 清单不得凭想象填:在册每一条都必须在写方脚本里真有一个"归档根之内"的落点,
  //     否则 C-u 就是一张我编的黑名单(编出来的名单既挡不住真东西,也说明不了为什么挡)。
  const refresh = readFileSync(join(dirname(SRC), 'git-backup-refresh.mjs'), 'utf8')
  for (const n of IN_USE_SUBPATHS)
    assert.match(
      refresh,
      new RegExp(`join\\(\\s*(?:archive|arch)Dir\\s*,\\s*['"]${n}['"]\\s*\\)`),
      `${n} 登记为在用,却在 git-backup-refresh.mjs 里找不到归档根内的落点 ⇒ 清单来源不成立`,
    )
  const brs = putTree(arch, 'broken-refs', 400 * DAY, { 'refs/heads/old': 32 })
  const scene = putTree(arch, 'IHUI-AI-git-repo.broken-1790150361407', 500 * DAY, { 'x.bin': 10 })
  const snap = putTree(arch, 'ihui-git-write.lock.stale-20', 400 * DAY, { 'a.bin': 64 })
  const now = Date.now()
  // ① 计划期:分类 + 冷层计划两个入口各喂一遍
  const rows = listEntries(arch).map((n) =>
    classifyEntry({ root: arch, name: n, now, baseNames: BASE }),
  )
  const br = rows.find((r) => r.name === 'broken-refs')
  assert.ok(br, '枚举没认出 broken-refs ⇒ 本用例的输入不成立(不得当成通过)')
  assert.equal(br.kind, 'protected', `超龄在用落点被判成 ${br.kind}(${br.reason})⇒ C-u 档失效`)
  assert.match(String(br.reason), /C-u/, `理由要点明挡在哪一条:${br.reason}`)
  const plan = planRetirement({
    entries: rows,
    keep: 0,
    maxTotalBytes: Number.MAX_SAFE_INTEGER,
    now,
  })
  const cold = planColdStorage({ plan, root: arch, now, baseNames: BASE })
  assert.deepEqual(
    cold.move.map((e) => e.name),
    ['ihui-git-write.lock.stale-20'],
    `可转清单里只该有那一项老快照:${JSON.stringify(cold.move.map((e) => e.name))}`,
  )
  assert.ok(
    !cold.blocked.some((e) => e.name === 'broken-refs'),
    'broken-refs 不得混进"被挡(超龄度不够)"那一桶 —— 它是**永不进任何一档**,两桶不同义',
  )
  assert.ok(
    plan.protected.some((e) => e.name === 'broken-refs' && /C-u/.test(e.reason)),
    `protected 桶要报名 + 点名判据:${JSON.stringify(plan.protected)}`,
  )
  // ② 执行期:不信任计划期那份,直接喂单项出口
  const e1 = await __test__.moveEntryToCold({
    root: arch,
    coldDir: coldDirOf(arch),
    entry: { name: 'broken-refs', path: brs },
    now,
    apply: true,
    baseNames: BASE,
  })
  assert.ok(!e1.moved && /C-u/.test(String(e1.why)), `执行期没拦住:${JSON.stringify(e1)}`)
  assert.ok(existsSync(join(brs, 'refs/heads/old')), '在用落点被动过')
  assert.ok(
    !existsSync(join(coldDirOf(arch), 'broken-refs')),
    '冷层里出现了在用落点(哪怕只是副本)= 拒收没兜住',
  )
  // ③ 端到端:整轮 apply 跑完,在用落点与 §5b 现场原样在,只有老快照换了个文件夹待着。
  //    必须先让本轮**真的有东西可转**(13 项 in-scope + 默认保留最近 10 代 ⇒ 最旧 3 项可转),
  //    否则"没动"只是因为无事可做,证不了 C-u 挡住了。
  const batch = []
  for (let i = 1; i <= 12; i++)
    batch.push(
      putTree(
        arch,
        `ihui-git-write.lock.stale-20-b${String(i).padStart(2, '0')}`,
        (300 + i) * DAY,
        {
          'a.bin': 8,
        },
      ),
    )
  const code = await runMain({
    argv: ['--cold', '--apply', '--root', arch, '--allow-custom-root', '--min-free-mb', '0'],
    stdout: () => {},
    stderr: () => {},
  })
  assert.equal(code, 0, `冷层 apply 退出码 ${code}`)
  assert.ok(existsSync(join(brs, 'refs/heads/old')), 'CLI 那一轮动了在用落点 broken-refs/')
  assert.ok(existsSync(scene), 'CLI 那一轮动了 §5b 现场')
  assert.ok(!existsSync(snap), '本轮无事可做(可转项没转冷)⇒ 上面两条"没被动"是空的,不得当成通过')
  assert.ok(
    existsSync(join(coldDirOf(arch), basename(snap), 'a.bin')),
    '老快照转冷后内容没跟着过去(转丢了)',
  )
  assert.ok(
    batch.slice(0, 10).every((p) => existsSync(p)),
    '最近 10 代之内的项被搬走(冷层绕过了世代档)',
  )
  for (const n of ['broken-refs', 'IHUI-AI-git-repo.broken-1790150361407'])
    assert.ok(!existsSync(join(coldDirOf(arch), n)), `冷层里出现了不该出现的项:${n}`)
  // ④ 冷层落点自身:真树里 `cold` 永远不带 .stale- 签名(所以它进不了候选),这一档是给"改天换名"兜底的
  //    ⇒ 只能把形态直接喂进判定函数,不得假装它是从归档根读到的真实项(那会是我想象的形态)。
  const belt = __test__.coldBlockReason({
    entry: {
      name: COLD_DIR_NAME,
      kind: 'in-scope',
      path: coldDirOf(arch),
      mtimeMs: now - 400 * DAY,
    },
    root: arch,
    keepNames: new Set(),
    now,
    baseNames: BASE,
  })
  assert.match(String(belt), /C-u/, `改名兜底那一档失效就没人拦了:${belt}`)
})
