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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
