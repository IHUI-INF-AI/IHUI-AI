// 修测试自身的类型窄化:store.lastOpts = null 之后,TS 把字段收成 null,
// 后续 `store.lastOpts?.page` 的可选项在 never 上取属性 ⇒ apps/api typecheck 报 TS2339。
import fs from 'node:fs'

const p = 'apps/api/src/routes/__tests__/comments-mine-contract.test.ts'
let s = fs.readFileSync(p, 'utf8')

const anchor = 'function mineUrl(extra = \'\'): string {'
if (!s.includes(anchor)) {
  console.error('锚点未命中 ⇒ 不落盘')
  process.exit(2)
}
// 统一经显式取值器读断言字段(返回 unknown,断言侧用 toBe 比较具体值)
s = s.replace(
  anchor,
  [
    '/** 断言用取值器:直接写 store.lastOpts?.x 会在 TS 窄化后落到 never 上取属性(实测 TS2339)。 */',
    'function opt(key: string): unknown {',
    '  const seen = store.lastOpts as Record<string, unknown> | null',
    '  return seen?.[key]',
    '}',
    '',
    anchor,
  ].join('\n'),
)

s = s.replace(/store\.lastOpts\?\.([A-Za-z]+)/g, 'opt(\'$1\')')
fs.writeFileSync(p, s)

const left = (s.match(/store\.lastOpts\?\./g) || []).length
console.log('改写完成;残留 store.lastOpts?. 形态:', left)
console.log('opt( 调用次数:', (s.match(/\bopt\('/g) || []).length)
