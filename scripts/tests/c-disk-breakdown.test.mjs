// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/c-disk-breakdown.mjs(§22c 模式)。
//
// 为什么必须有:该工具**进不了任何守门** —— 门 89 的 GATE_FILE_RE 只认 ^(check|scan|guard)
// 开头的文件名,它叫 c-disk-breakdown,所以"被接线门看见"这条路结构上不存在。
// 而它的结论是**给人做删除决策用的数字**,一旦算错(重复计数、尾斜杠让根条目查不到、
// 跟随 junction 把 D 盘算成 C 的债),表现是"看起来还有一大块可删"。这类东西没有尺子
// 就等于没有。
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, test } from 'node:test'
// G-814426 新增(T12/T12b 要跑真 CLI 的 --json 端到面;既有 T1–T7 一行未动)
import { spawnSync } from 'node:child_process'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SRC = resolve(fileURLToPath(import.meta.url), '../../c-disk-breakdown.mjs')
// Windows 裸路径不能直接喂 import()(ERR_UNSUPPORTED_ESM_URL_SCHEME)—— 必须经 file:// URL。
const SRC_URL = pathToFileURL(SRC).href
const { __test__ } = await import(SRC_URL)
const { rollUp, volumeBytes, depthOf, specialFilesMB, norm, ROOTKEY } = __test__

const made = []
const box = (name) => {
  const d = mkScratch(`cdb-${name}-`)
  made.push(d)
  return d
}
after(() => {
  for (const d of made) rmScratch(d)
})

const put = (path, bytes) => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, Buffer.alloc(bytes, 0x61))
}

test('T1 import 本模块不得触发全盘遍历(§22d 入口守卫)', async () => {
  // 这条不是形式主义:守卫缺失时 import 会走完整盘并打印,一次测试跑几十秒且污染输出。
  const t0 = Date.now()
  const mod = await import(SRC_URL + '?again=1')
  const ms = Date.now() - t0
  assert.ok(mod.__test__, '无 __test__ 导出')
  assert.ok(ms < 2000, `import 用了 ${ms}ms ⇒ 顶层又在扫盘,§22d 守卫被摘了`)
})

test('T2 反向锁:守卫写法本身不得被摘(行为分支只能这样钉)', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(src, /if \(isDirectRun\) \{/)
  // 且必须是**外层**守卫:全盘那一步要排在守卫之后。
  assert.ok(
    src.indexOf('rollUp(ROOT)') > src.indexOf('if (isDirectRun)'),
    'rollUp(ROOT) 跑在守卫之前 ⇒ 守卫无效',
  )
})

test('T3 字节滚到**全部**祖先(按 depth 截断会让浅层总数偏小)', () => {
  const root = box('roll')
  put(join(root, 'a', 'b', 'deep.bin'), 100)
  put(join(root, 'a', 'mid.bin'), 30)
  put(join(root, 'top.bin'), 7)
  const { roll } = rollUp(root)
  const at = (p) => roll.get(norm(p))
  assert.equal(at(join(root, 'a', 'b')).bytes, 100)
  assert.equal(at(join(root, 'a')).bytes, 130, '祖先没滚全 ⇒ 深度表偏小')
  assert.equal(at(root).bytes, 137, '根条目对不上 ⇒ 就是"遍历 0 GB"那一型')
  assert.equal(at(root).files, 3)
})

test('T4 重解析点只计数不跟随(跟随会把 D 盘目标算成 C 的债)', (t) => {
  const root = box('link')
  const target = join(root, 'real')
  put(join(target, 'big.bin'), 55)
  let link
  try {
    link = join(root, 'via-junction')
    symlinkSync(target, link, 'junction')
  } catch (e) {
    t.diagnostic(`本机建不了 junction(${e.code})⇒ 退化为源码级锁`)
    const src = readFileSync(SRC, 'utf8')
    assert.match(src, /st\.isSymbolicLink\(\)/)
    assert.match(src, /links\+\+/)
    return
  }
  const { roll, links } = rollUp(root)
  assert.ok(links >= 1, '重解析点一个都没被认出 ⇒ 门对 junction 全盲')
  assert.equal(roll.get(norm(link)), undefined, '链接本体被当成条目算了')
  assert.equal(roll.get(norm(root)).bytes, 55, '经链接的量不得进祖先账')
})

test('T5 ROOTKEY 不得带尾斜杠,depthOf 层级要对(尾斜杠=假结论)', () => {
  assert.ok(!ROOTKEY.endsWith('/'), `ROOTKEY 带尾斜杠:${ROOTKEY}`)
  assert.equal(norm('C:/'), 'C:/') // norm 只换分隔符,不动尾斜杠 —— 去尾斜杠是 ROOTKEY 的活
  assert.equal(depthOf(ROOTKEY), 0)
  assert.equal(depthOf(`${ROOTKEY}/Windows`), 1)
  assert.equal(depthOf(`${ROOTKEY}/Windows/System32`), 2)
})

test('T6 量不到不得伪装成结论,且报告层必须有"一个都没量到"的喊话', () => {
  const r = specialFilesMB('Q') // 本机不存在的盘
  assert.ok(r.map && typeof r.map === 'object')
  assert.equal(Object.values(r.map).reduce((s, n) => s + n, 0), 0, '量不到却报出字节')
  // 契约是"map 为空 ⇒ 由报告层显式喊未量到",不是 error 字段 —— 那就钉报告层那一支。
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /特殊文件一个都没量到/)
  assert.ok(
    src.indexOf('特殊文件一个都没量到') > src.indexOf('const special = specialFilesMB'),
    '喊话分支排在取数之前 ⇒ 永远读不到 map 的实际内容',
  )
  // 阳性对照:同一支取数逻辑在真盘上必须量到东西(pagefile 在位),否则"量不到"才是常态。
  const c = specialFilesMB(ROOTKEY.replace(/:$/, ''))
  const hit = Object.values(c.map).reduce((s, n) => s + n, 0)
  assert.ok(
    hit > 0 || c.error,
    `C 盘既没量到特殊文件也没报错 ⇒ 取数通道本身坏了(该红的是工具,不是世界)`,
  )
})

test('T7 卷口径必须是字节(单位错一档,报告就差 1024 倍)', () => {
  const v = volumeBytes('C:/')
  assert.ok(v.total > 1e9, `total=${v.total} 不像是字节`)
  assert.ok(v.avail > 0 && v.avail < v.total)
  assert.ok(v.free >= v.avail, 'free<bavail 说明取错了字段(bfree 含保留而 bavail 不含)')
})

// ══════════════ G-814426:分类有界 + 折叠余项点名(以下均为**新增**用例) ══════════════
//
// 旧版每个分类只 `.slice(0, 20)` 并 `filter(≥min-mb)`,两个出口都**静默丢项** ⇒
// "第 N 层前 20 项"在读者眼里等于"第 N 层"。现由 `foldCategory()` 一份纯函数收口,
// 恒等式 `listedBytes + foldedBytes === totalBytes` 必须逐类成立(票面验收原文)。
// 下面 T8–T11 判纯函数,T12 判端到面(真 CLI 的 --json),T13 是防复发的源码形状锁。

// 折叠判据走 `__test__` 那一条 §22c 通道(与上方 T1–T7 取 rollUp/depthOf 同一入口),
// 不得在测试里 import 内部实现、更不得抄第二份折叠算法。
const { foldCategory, MORE_ENTRIES_SUFFIX } = __test__

const MBYTES = 1048576

/** 造 n 条已知字节数的条目(纯数据,不碰磁盘)。 */
const rowsOf = (n, bytesFor) =>
  Array.from({ length: n }, (_, i) => ({ path: `R/d${String(i).padStart(3, '0')}`, bytes: bytesFor(i), files: 1 }))

test('T8 折叠恒等式:>100 条时余项折进 MORE,且 more.bytes == 该类总量 − 前 N 条(逐字节)', () => {
  const rows = rowsOf(130, (i) => (i + 1) * 1024)
  const total = rows.reduce((s, r) => s + r.bytes, 0)
  const f = foldCategory(rows, { cap: 100, minBytes: 0, previewCount: 5 })
  assert.equal(f.entries.length, 100, '上限本身就是判据(不是"看起来少了几条")')
  assert.ok(f.more, '有余项却不出 MORE 档 ⇒ 静默丢项回来了')
  assert.equal(f.more.count, 30)
  assert.equal(f.more.beyondCap, 30, '超上限与低于阈值必须分列(两件事,处置动作不同)')
  assert.equal(f.more.belowThreshold, 0)
  assert.equal(f.listedBytes + f.more.bytes, total, '闭合恒等式不成立 ⇒ 折叠量算错了')
  assert.equal(f.more.bytes, total - f.listedBytes, '票面要求的口径:折叠 = 总量 − 前 N 条')
  assert.equal(f.closureOk, true)
  // 折叠项是"折起来",不是"丢掉":全量名单在 items 里,且逐项之和 == 折叠量
  assert.equal(f.more.items.length, 30)
  assert.equal(f.more.items.reduce((s, i) => s + i.bytes, 0), f.more.bytes)
  // 报名:previewCount 条最大的被折项 + truncated 如实标出
  assert.equal(f.more.largest.length, 5)
  assert.equal(f.more.truncated, true)
  assert.ok(f.more.largest[0].bytes >= f.more.largest[4].bytes, '报名名单必须按字节降序')
})

test('T8b 两个静默出口分列:低于阈值与超出上限同时存在时,count = 两者之和', () => {
  const rows = rowsOf(250, (i) => (i < 200 ? 5 * MBYTES : 1)) // 50 条低于 1MB 阈值
  const f = foldCategory(rows, { cap: 100, minBytes: MBYTES, previewCount: 3 })
  assert.equal(f.more.belowThreshold, 50)
  assert.equal(f.more.beyondCap, 100) // 200 条过阈值,列 100 ⇒ 折 100
  assert.equal(f.more.count, 150)
  assert.equal(f.entries.length, 100)
  assert.equal(f.listedBytes + f.more.bytes, f.totalBytes)
  assert.equal(f.more.largest.length, 3)
})

test('T9 没有余项 ⇒ more 必须是 null(不得造一个空 MORE 档冒充"已折叠过")', () => {
  const f = foldCategory(rowsOf(3, (i) => i * MBYTES), { cap: 100, minBytes: 0 })
  assert.equal(f.more, null)
  assert.equal(f.foldedBytes, 0)
  assert.equal(f.closureOk, true)
  assert.equal(foldCategory([], { cap: 100, minBytes: 0 }).entries.length, 0, '空类不得凭空出档')
})

test('T10 整类都低于阈值 ⇒ 列 0 条但仍出 MORE(旧版在这里直接印空表,读成"这层没东西")', () => {
  const rows = rowsOf(40, () => 1024)
  const f = foldCategory(rows, { cap: 100, minBytes: MBYTES })
  assert.equal(f.entries.length, 0)
  assert.ok(f.more, '低于阈值不是"不存在":必须连同字节一起折出来')
  assert.equal(f.more.belowThreshold, 40)
  assert.equal(f.more.bytes, 40 * 1024)
  assert.equal(f.listedBytes + f.more.bytes, f.totalBytes)
})

test('T11 折叠不得改变总量,也不得把 junction 跟随进来(与 T3/T4 交叉验证)', (t) => {
  const root = box('fold-junction')
  let link
  try {
    link = join(root, 'zlink')
    symlinkSync(join(root, 'outside'), link, 'junction')
  } catch {
    // 建不了 junction 的机器:退化为"折叠不改变总量"这一半,并**如实标注**没测到 junction 那一半
    // (与 T4 同一手法:退化必须被喊出来,不得让"跳过"读成"已通过")
    t.diagnostic('本机建不了 junction ⇒ 只测"折叠不改变总量"这一半,junction 不跟随那一半未测')
    const rows = rowsOf(120, (i) => i * 1024)
    const f = foldCategory(rows, { cap: 100, minBytes: 0 })
    assert.equal(f.totalBytes, rows.reduce((s, r) => s + r.bytes, 0))
    return
  }
  for (let i = 0; i < 110; i++) {
    put(join(root, `k${String(i).padStart(3, '0')}`, 'f.bin'), 2048)
  }
  const { roll, links } = rollUp(root)
  assert.ok(links >= 1, '重解析点没被认出 ⇒ 这一臂退化成没测')
  // ⚠️ 只取**被测根之下**的条目:`rollUp` 的滚止锚点是模块级 ROOTKEY(由 CLI 的 --root 决定),
  // 用别的根调它时,祖先会一路滚到文件系统根 ⇒ 直接对 roll 全表求和会把上层的目录也算进来
  // (T3/T4 之所以只查具体路径)。这里要量的是"这一类的条目",必须自己划清范围。
  const prefix = norm(root) + '/'
  const rows = [...roll.entries()]
    .filter(([p]) => p.startsWith(prefix))
    .map(([p, v]) => ({ path: p, bytes: v.bytes, files: v.files }))
  assert.equal(rows.length, 110, `被测根之下的条目数不对:${rows.length}`)
  const f = foldCategory(rows, { cap: 50, minBytes: 0 })
  assert.equal(f.totalBytes, roll.get(norm(root)).bytes, '折叠后的类总量必须等于遍历所得(跟随 junction 会把它撑大)')
  assert.ok(!JSON.stringify(f).includes(norm(link)), '被跟随的 junction 混进了折叠名单')
  assert.equal(f.listedBytes + f.more.bytes, f.totalBytes)
})

test('T12 端到面:构造 >100 子项临时树 ⇒ 真 CLI 的 --json 出折叠项且逐字节闭合', () => {
  const root = box('fold-e2e')
  const N = 125
  let expect = 0
  for (let i = 0; i < N; i++) {
    const bytes = 4096 + i * 1024
    put(join(root, `s${String(i).padStart(3, '0')}`, 'f.bin'), bytes)
    expect += bytes
  }
  const r = spawnSync(
    process.execPath,
    [SRC, '--root', norm(root), '--depth', '1', '--min-mb', '0', '--json', '--list-folded'],
    { encoding: 'utf8', windowsHide: true, timeout: 120_000 },
  )
  assert.equal(r.status, 0, `CLI 退出码 ${r.status}:${String(r.stderr).slice(0, 600)}`)
  const out = JSON.parse(r.stdout)
  assert.equal(out.limits.maxEntriesPerCategory, 100, '默认上限必须是票面的 100')
  const lvl = out.levels.depth1
  assert.ok(lvl, `--json 里没有 depth1 分类:${Object.keys(out.levels)}`)
  assert.equal(lvl.entries.length, 100)
  assert.ok(lvl.more, '有 25 项被折掉却没出 MORE 档 ⇒ 静默丢项回来了')
  assert.equal(lvl.more.count, N - 100)
  assert.equal(lvl.totalBytes, expect, '该类总量必须等于夹具真写的字节')
  assert.equal(
    lvl.listedBytes + lvl.foldedBytes,
    lvl.totalBytes,
    `折叠对账不闭合:${JSON.stringify({ l: lvl.listedBytes, f: lvl.foldedBytes, t: lvl.totalBytes })}`,
  )
  assert.equal(lvl.more.bytes, lvl.totalBytes - lvl.listedBytes, '票面验收原文:折叠项 bytes = 该类总量 − 前 N 条')
  assert.equal(lvl.more.beyondCap, N - 100)
  assert.equal(lvl.more.belowThreshold, 0)
  assert.equal(lvl.closureOk, true)
  assert.equal(out.closureBreaks.length, 0)
  // 折叠余项**报名**:--list-folded 出全量,且逐项之和 == 折叠量(点名不是装饰)
  assert.equal(lvl.more.itemsIncluded, true)
  assert.equal(lvl.more.items.length, N - 100)
  assert.equal(lvl.more.items.reduce((s, i) => s + i.bytes, 0), lvl.more.bytes)
  assert.equal(lvl.more.path, MORE_ENTRIES_SUFFIX, 'MORE 档名必须来自那一份常量,不得两处各写一遍')
  // 总线仍闭合:遍历所得(根)与各类总量互不吞并 —— 这里量"列 + 折 == 该类总量",根账由 T3 钉
  assert.equal(lvl.entries.reduce((s, e) => s + e.bytes, 0), lvl.listedBytes)
})

test('T12b 不带 --list-folded 时 items 必须**自己报名**"没进产物",不得静默缺席', () => {
  const root = box('fold-e2e-hidden')
  // 115 项 ⇒ 列 100、折 15(> previewCount 5),这样 truncated 才必须是真
  for (let i = 0; i < 115; i++) put(join(root, `t${String(i).padStart(3, '0')}`, 'f.bin'), 2048)
  const r = spawnSync(process.execPath, [SRC, '--root', norm(root), '--depth', '1', '--min-mb', '0', '--json'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  assert.equal(r.status, 0, String(r.stderr).slice(0, 400))
  const lvl = JSON.parse(r.stdout).levels.depth1
  assert.equal(lvl.more.itemsIncluded, false, '没给的档位必须显式标 false(缺席与给 false 是两件事)')
  assert.equal('items' in lvl.more, false)
  assert.ok(lvl.more.truncated, '全量名单被截断时 truncated 必须为真')
})

test('T13 防复发形状锁:截断而无折叠的旧形态不得回到源码里', () => {
  const src = readFileSync(SRC, 'utf8')
  // ① 分类上限只能由 foldCategory 内部那一次 slice 执行;报告层不得再各切一刀。
  assert.equal(
    /\.slice\(\s*0,\s*TOP\s*\)/.test(src),
    false,
    '旧的 `.slice(0, TOP)`(截断且静默丢项)回来了 ⇒ MORE 档被绕过',
  )
  assert.match(src, /function foldCategory\(/, '折叠判据的实现不在了')
  // ② 判据必须被**调用**(函数在而无人调 = 提交链上一路绿灯,守门 70/76/81 同型)。
  assert.match(src, /foldCategory\(\s*rows\s*,\s*\{[^}]*cap:\s*MAX_ENTRIES_PER_CATEGORY/)
  // ③ 上限常量只能有一处定义,且默认值就是票面的 100。
  assert.equal((src.match(/const MAX_ENTRIES_PER_CATEGORY =/g) || []).length, 1)
  assert.match(src, /flag\('max-entries-per-category',\s*flag\('top',\s*100\)\)/)
  // ④ 闭合不成立必须喊出来,不得静默出报告。
  assert.match(src, /closureBreaks/)
  assert.match(src, /折叠对账\*\*不闭合\*\*/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
