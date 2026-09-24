// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 90 的镜像测试(§22c):直接 import 源脚本的 __test__,不复制判据实现。
// 重点是两条"造门时就踩过"的反例:名字判据不得误伤他人工具态,以及 TEMP 漂移必须能被识别。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-c-drive-pollution.mjs'
// 封口清单只从源脚本取,测试里同样不抄第二份名字(§22c)
import { SEALED_DIRS, pathsFor } from '../seal-c-root-stray.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// 编号唯一性:同日多会话在同一位置各加一道门必然撞号。本门一天内撞了三次 ——
// 85(与 check-test-paths)→ 90(与 check-sse-dispatch-parity)→ 91(与
// check-error-code-coverage),最终落 92。所以断言**不硬写编号**:先从 runner 里反查
// "本门脚本所在注册块的 id",再要求那个 id 全文件唯一。硬写编号的写法下次重排就又红了
// (或更糟:悄悄通过)。
test('本门编号在 guardian-runner 中必须唯一(反查 id,不硬写编号)', () => {
  const runner = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'guardian-runner.mjs'),
    'utf8',
  )
  const block = runner.match(
    /\{\s*\n\s*id: '([0-9]+[a-z]?)',[\s\S]{0,400}?script: 'check-c-drive-pollution\.mjs'/,
  )
  assert.ok(block, '本门未接入 runner(找不到 id→script 相邻的注册块)')
  const myId = block[1]
  const hits = runner.match(new RegExp(`id: '${myId}'`, 'g')) || []
  assert.equal(hits.length, 1, `id ${myId} 出现 ${hits.length} 次 ⇒ 与别的门撞号,注册块可能互相顶掉`)

  const ids = [...runner.matchAll(/^\s{4}id: '([0-9a-z]+)',$/gm)].map((m) => m[1])
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))]
  assert.deepEqual(dupes, [], `runner 存在重号: ${dupes.join(', ')}`)

  // 邻门注册块不得因"整文件提交"而缺失(本仓实测踩过,见提交 5db08f26e 的修复)
  for (const neighbor of [
    'check-sse-dispatch-parity.mjs',
    'check-test-paths.mjs',
    'check-error-code-coverage.mjs',
  ]) {
    assert.ok(runner.includes(`script: '${neighbor}'`), `邻门 ${neighbor} 的注册块缺失`)
  }
})

test('盘根 IHUI- 前缀与 .empty-tmp / .pnpm-store 判为自有', () => {
  assert.ok(G.classifyRoot('IHUI-probe-tail.ps1'))
  assert.ok(G.classifyRoot('.empty-tmp'))
  assert.ok(G.classifyRoot('.empty-tmp2'))
  assert.ok(G.classifyRoot('.pnpm-store'))
})

test('盘根单字母目录 = MSYS 路径错位指纹;单字母文件与系统目录都不判', () => {
  // 实测成因:C:\c 是 2026-08-06 把 /c/tmp/... 当相对路径用套出来的,内藏 515MB
  assert.ok(G.classifyRootEntry('c', true), 'C:\\c 这类错位目录必须被识别')
  assert.equal(G.classifyRootEntry('c', false), null, '单字母文件不得判(宁漏不误报)')
  assert.equal(G.classifyRootEntry('Windows', true), null, '系统目录误判')
  assert.ok(G.classifyRootEntry('IHUI-probe-tail.ps1', false), '既有 IHUI- 规则须仍生效')
})

test('系统条目与白名单目录不得判为我们的', () => {
  for (const n of ['Windows', 'Program Files', 'ProgramData', 'Users', 'Recovery', 'pagefile.sys']) {
    assert.equal(G.classifyRoot(n), null, `${n} 被误判为自有`)
  }
  assert.ok(G.FOREIGN_ROOT.has('tools'), 'tools 未登记为外来条目')
})

test('Temp 里只认我们的前缀,他人随机名一律放过', () => {
  assert.ok(G.classifyTmp('ihui-origin-Ab12Cd'))
  assert.ok(G.classifyTmp('next-backup-node22-20260918-094636'))
  assert.equal(G.classifyTmp('8f575ef0-6180-4c22-b1d4-4161278b643b.tmp'), null)
  assert.equal(G.classifyTmp('qoder-000b-cwd'), null, '宿主工具态被误判为本项目产物')
})

test('scanC 默认面:结论结构合法(不断言两次计数相等 —— 见下方注入用例的理由)', () => {
  const a = G.scanC()
  assert.ok(['ok', 'drift', 'unknown'].includes(a.temp.status), `TEMP 判定状态异常:${a.temp.status}`)
  assert.ok(Array.isArray(a.ours) && Array.isArray(a.unknownRoot), 'ours/unknownRoot 必须是数组')
  assert.ok(typeof a.totalMB === 'number' && a.totalMB >= 0, 'totalMB 必须是可量数值')
  // 曾经这里断言"两次扫描条数相等"。它测的是"本门只读",但在**全量并行批次**里必然间歇红:
  // 兄弟测试正在同一台机器的 TEMP 里创建/删除 `ihui-*` 夹具,而本门扫的正是那些目录
  // (2026-09-24 全量首跑即此因)。**只读性改由上面两条注入用例确定性取证**,
  // 这里只保证默认扫描面给出的结论形状合法。
})

// ─── 扫描面注入(2026-09-24 加):让上面那条"两次一致"可被**确定性地**测 ───────
// 上面那条在**全量并行批次**里是间歇红的:兄弟测试正在创建/删除 `ihui-*` 夹具,
// 而本门的 TEMP 枚举扫的就是这台机器此刻的临时目录 —— 21s 双扫描窗口内数量必然漂移。
// 那与"本门是否只读"无关,却在 CI 上会表现为一道与任何改动都无关的常红门。
// 修法不是削断言,而是把扫描面钉到调用方自己的隔离目录(默认行为一字不变)。
test('注入:钉住 tempDirs + skipDriveRoot ⇒ 结果确定、不碰真机内容', () => {
  const iso = mkScratch('pollution-iso-')
  try {
    mkdirSync(iso, { recursive: true })
    const opt = { tempDirs: [iso], skipDriveRoot: true }
    const a = G.scanC(opt)
    const b = G.scanC(opt)
    assert.deepEqual(a.ours, [], '隔离空目录下不得有任何本项目残骸')
    assert.equal(a.ours.length, b.ours.length, '注入后两次必须严格一致')
    assert.equal(a.totalMB, b.totalMB)
    assert.deepEqual(a.unknownRoot, [], 'skipDriveRoot 不得伪报盘根未知项')
    assert.equal(a.pagefile.count, b.pagefile.count, 'pagefile 量取在两次调用间不得漂移(纯读注册表/WMI)')
  } finally {
    rmScratch(iso)
  }
})

test('注入:在隔离目录造一枚 ihui-* 残骸 ⇒ 只量到它,且再扫仍只量到它', () => {
  const iso = mkScratch('pollution-bait-')
  try {
    mkdirSync(iso, { recursive: true })
    const bait = join(iso, 'ihui-bait-fixture')
    mkdirSync(bait, { recursive: true })
    // 体积判据按 0.1MB 取整 ⇒ KB 级诱饵会被抹成 0(第一版就是这样"量到条目却报 0MB")。
    // 这里要的是真实量级,才能同时钉住"目录体积确实算了"。
    writeFileSync(join(bait, 'x.bin'), Buffer.alloc(1_300_000, 0x61), 'utf8')
    const r = G.scanC({ tempDirs: [iso], skipDriveRoot: true })
    assert.equal(r.ours.length, 1, `应只量到诱饵一枚,实得 ${r.ours.length}:${JSON.stringify(r.ours.map((o) => o.path))}`)
    assert.match(r.ours[0].path, /ihui-bait-fixture/)
    assert.ok(r.totalMB >= 1.2, `量到 1.3MB 条目却报 totalMB=${r.totalMB} ⇒ 目录体积没算(旧假绿灯形态)`)
    // 反向对照:同一次调用不得把 D 盘的夹具算成 C 盘债(扫面被钉住即不外溢)
    assert.ok(!r.ours.some((o) => /^[CD]:\\Users/.test(o.path)), '注入后不得越界扫到用户目录')
  } finally {
    rmScratch(iso)
  }
})

test('detectTempDrift 经 scanC 注入:三态各自成立(默认仍读注册表)', () => {
  const iso = mkScratch('pollution-drift-')
  try {
    mkdirSync(iso, { recursive: true })
    const same = G.scanC({ tempDirs: [iso], skipDriveRoot: true, procTmp: iso, declaredTemp: iso })
    assert.equal(same.temp.status, 'ok', '声明==进程 ⇒ ok')
    const other = join(iso, 'elsewhere')
    mkdirSync(other, { recursive: true })
    const drift = G.scanC({ tempDirs: [iso], skipDriveRoot: true, procTmp: iso, declaredTemp: other })
    assert.equal(drift.temp.status, 'drift', '声明≠进程 ⇒ drift(这条判据正是"改了指针但残骸天天还在长")')
    const unknown = G.scanC({ tempDirs: [iso], skipDriveRoot: true, procTmp: iso, declaredTemp: null })
    assert.equal(unknown.temp.status, 'unknown', '注册表读不到 ⇒ unknown,绝不记为通过')
    // 默认路径未被改动:不给 declaredTemp 时仍走真实注册表读取
    assert.ok(['ok', 'drift', 'unknown'].includes(G.scanC({ tempDirs: [iso], skipDriveRoot: true }).temp.status))
  } finally {
    rmScratch(iso)
  }
})

test('TEMP 漂移判据:注册表与进程不一致必须报 drift', () => {
  const r = G.detectTempDrift()
  if (r.status === 'drift') {
    assert.notEqual(r.proc, r.declared, 'drift 却给出相同路径')
    assert.ok(r.declared, 'drift 判定要求注册表值可读')
  } else if (r.status === 'ok') {
    assert.equal(r.proc.toLowerCase().replace(/[\\/]+$/, ''), r.declared.toLowerCase().replace(/[\\/]+$/, ''))
  }
})

// —— 封口形态(2026-09-24 加):本门对盘根写歪项必须给**相反且正确**的两个结论 ——
test('classifySeal 四态:表内真目录=BROKEN / 表内链接=SEALED / 表外=FOREIGN / 不存在=ABSENT', () => {
  const name = SEALED_DIRS[0].name
  assert.equal(G.classifySeal(name, { exists: true, isLink: false, isDir: true }), 'BROKEN')
  assert.equal(G.classifySeal(name, { exists: true, isLink: true, isDir: false }), 'SEALED')
  assert.equal(G.classifySeal(name, { exists: false, isLink: false, isDir: false }), 'ABSENT')
  assert.equal(G.classifySeal('Windows', { exists: true, isLink: false, isDir: true }), 'FOREIGN')
  // 大小写不敏感:Windows 文件系统本就如此,漏了会让 TMP/Tmp 这类变体绕过判据
  assert.equal(G.classifySeal(name.toUpperCase(), { exists: true, isLink: true, isDir: false }), 'SEALED')
})

test('端到端:改道前判残骸、改道后判已封口且**绝不跟随链接量体积**', () => {
  const base = mkScratch('pollution-seal-')
  try {
    const root = join(base, 'root')
    const dev = join(base, 'devenv')
    const entry = SEALED_DIRS[0]
    const stray = join(root, entry.name)
    mkdirSync(stray, { recursive: true })
    writeFileSync(join(stray, 'a.json'), 'x'.repeat(50000))

    const before = G.scanDriveRoot(root, dev)
    assert.ok(
      before.hits.some((h) => h.why.includes('封口丢失')),
      '真目录没判回潮 ⇒ 根治失效时门是瞎的',
    )

    const target = pathsFor(entry, root, dev).target
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'a.json'), 'x'.repeat(50000))
    rmSync(stray, { recursive: true, force: true })
    symlinkSync(target, stray, 'junction')

    const after = G.scanDriveRoot(root, dev)
    assert.equal(
      after.hits.filter((h) => h.why.includes('封口丢失')).length,
      0,
      '已封口仍判回潮 ⇒ 每日必红',
    )
    assert.ok(after.sealed.some((s) => s.name === entry.name), '已封口项没进 sealed 清单')
    const attributed = after.hits.reduce((a, b) => a + (b.sizeMB || 0), 0)
    assert.equal(attributed, 0, `跟随了链接、把 D 盘目标算成 C 盘残骸:${attributed}MB`)
  } finally {
    rmScratch(base)
  }
})

test('扫描位不得跟随改道后的 junction(实测 PS 的 -Recurse 会穿透,Node 侧同理)', () => {
  const base = mkScratch('pollution-rep-')
  try {
    const t = join(base, 'tgt')
    mkdirSync(t)
    const ln = join(base, 'lnk')
    symlinkSync(t, ln, 'junction')
    assert.equal(G.isReparsePoint(ln), true, 'junction 未被认出 ⇒ 扫描会跟进外置根')
    assert.equal(G.isReparsePoint(t), false, '真目录被误判 ⇒ 残骸会被整体跳过(假绿)')
    assert.equal(G.isReparsePoint(join(base, 'nope')), false, '不存在的路径不得判真')
  } finally {
    rmScratch(base)
  }
})

test('每日维护脚本必须带"重解析点只断链、绝不递归删"的护栏', () => {
  const ps1 = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'c-drive-auto-maintain.ps1'), 'utf8')
  assert.match(ps1, /function\s+Test-ReparsePoint/, '缺重解析点判据函数')
  assert.match(ps1, /Test-ReparsePoint\s+\$path/, 'ForceDelete 未在唯一删除出口上判重解析点')
  // 断链必须是 non-recursive:`Delete($path, $true)` 或 -Recurse 会顺着 junction 清空外置根
  assert.match(ps1, /\[System\.IO\.Directory\]::Delete\(\$path,\s*\$false\)/, '断链写成递归删除 ⇒ 会穿透删目标')
})

test('页面文件量大小必须用 WMI 的 AllocatedBaseSize(不是 MSDN 文档那个名字)', () => {
  // 实测:本机 Win32_PageFileUsage 只有 `AllocatedBaseSize`;写成文档里的 `AllocBaseSize`
  // 不会报错,PowerShell 把它渲染成**空串** ⇒ 一条都量不到。这正是"属性名错但静默通过"的形状。
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'check-c-drive-pollution.mjs'), 'utf8')
  assert.match(src, /\$_.AllocatedBaseSize/, '未使用 AllocatedBaseSize')
  assert.doesNotMatch(src, /\$_.AllocBaseSize/, '用了会被静默渲染成空串的属性名')
})

test('页面文件哨兵:一条都没量到必须报"未判定",不得报"一致"(假绿灯防回归)', () => {
  const r = G.pagefilePending(G.parsePagingFiles('    C:\\pagefile.sys 2048 2048'), new Map())
  assert.equal(r.readable, true, '配置读到了')
  assert.equal(r.measured, 0, '不该记为量到')
  assert.equal(r.pending.length, 0, '量不到不得造待办')
  // 报告文本里必须出现"未判定"字样 —— 判据没量到却打印"一致"就是假绿
  assert.ok(r.entries > r.measured, 'entries/measured 差必须可见,供报告区分未判定')
})

// —— TEMP 内容归因(2026-09-24 补):特征串唯一真相源在源脚本的 CONTENT_SIGNATURES,
// 本测试只经 __test__ 引用它(§22c),写第二份字面量清单即为漂移。 ——
test('内容归因经 __test__ 装车:特征数组在位且四族各有锚(仓库根/旧盘 G:/@ihui//水印横幅)', () => {
  assert.ok(Array.isArray(G.CONTENT_SIGNATURES) && G.CONTENT_SIGNATURES.length >= 5, 'CONTENT_SIGNATURES 未导出或缩水')
  assert.ok(G.CONTENT_SIGNATURES.every((s) => s.re instanceof RegExp && s.why.includes('内容归因')), '每条特征须自带可区分的 why')
  const hitBy = (text) => G.CONTENT_SIGNATURES.filter((s) => s.re.test(text)).length
  assert.ok(hitBy('D:\\IHUI-AI\\x') >= 1, '仓库根反斜杠形态未命中')
  assert.ok(hitBy('D:/IHUI-AI/x') >= 1, '仓库根正斜杠形态未命中')
  assert.ok(hitBy('G:\\IHUI-AI\\old.cjs') >= 1, '旧盘 G: 强特征未命中(迁移前脚本会重新失明)')
  assert.ok(hitBy("import { x } from '@ihui/shared'") >= 1, '@ihui/ 命名空间未命中')
  assert.ok(hitBy('// [IHUI-AI-PROVENANCE]:…') >= 1, '溯源横幅未命中')
  assert.ok(hitBy('// © 2026 IHUI AI') >= 1, '版权横幅 IHUI AI 未命中')
})

test('内容归因正反成对(真文件走 attributeByContent):我们的必须 hit,他人工具态必须 notMatched', () => {
  const base = mkScratch('pollution-attr-')
  try {
    const ours = [
      ["const root='D:\\\\IHUI-AI'\n", '探针原始形状:转义双写 + 引号收口'],
      ["select 1 from t; -- G:/IHUI-AI/scripts\n", '旧盘正斜杠'],
      ['console.log(require("@ihui/api-client"))\n', '包命名空间'],
    ]
    for (const [i, [content, label]] of ours.entries()) {
      const p = join(base, `attr-ours-${i}.cjs`)
      writeFileSync(p, content)
      const r = G.attributeByContent(p)
      assert.equal(r.state, 'hit', `${label} 未被内容归因抓到`)
      assert.match(r.why, /内容归因/, 'why 必须能区分"按内容认出"与"按名字认出"')
    }
    for (const [i, content] of [
      '{"sessionId":"qoder-000b","cwd":"C:\\\\Users\\\\me"}',
      'PUT /v1/bucket/object HTTP/1.1',
      'D:\\IHUI-AIIsHugeOtherThing\\readme.txt',
    ].entries()) {
      const p = join(base, `attr-foreign-${i}.cjs`)
      writeFileSync(p, content)
      assert.equal(G.attributeByContent(p).state, 'notMatched', '他人/近邻内容被误判为本项目产物(清理任务最严重方向)')
    }
  } finally {
    rmScratch(base)
  }
})

test('内容归因护栏如实计数:超 2MB 与前 8KB 含 NUL 必须判 skipped,不得混进 hit/notMatched 任一态', () => {
  const base = mkScratch('pollution-guard-')
  try {
    const big = join(base, 'huge.log')
    writeFileSync(big, Buffer.concat([Buffer.from("x '@ihui/y' "), Buffer.alloc(G.CONTENT_SNIFF_MAX_BYTES + 16, 0x41)]))
    assert.equal(G.attributeByContent(big).state, 'skipped', '超大文件必须被体积护栏跳过(守门不整读)')
    const bin = join(base, 'core.bin')
    writeFileSync(bin, Buffer.concat([Buffer.from("IHUI-AI-PROVENANCE"), Buffer.from([0, 0]), Buffer.from('IHUI AI')]))
    assert.equal(G.attributeByContent(bin).state, 'skipped', '二进制必须被 NUL 护栏跳过(带特征串也不整读)')
    assert.equal(G.attributeByContent(join(base, 'gone.cjs')).state, 'failed', '读不到必须判 failed,不得当未命中静默吞掉')
  } finally {
    rmScratch(base)
  }
})

test('scanC 的结果必须始终携带 contentAttribution 四计数(空扫靠它们报"未判定",绝不静默)', () => {
  const r = G.scanC()
  for (const k of ['candidates', 'hits', 'skippedSizeOrBinary', 'readFailed'])
    assert.ok(Number.isFinite(r.contentAttribution?.[k]), `缺 ${k} ⇒ 报告面会把没扫到当成通过`)
  assert.ok(r.contentAttribution.hits <= r.contentAttribution.candidates, '命中数不得大于候选数(计数口径错)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
