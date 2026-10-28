// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * apps/api/scripts/export-openapi.ts 的**桩键归一化**回归测试。
 *
 * 立因(2026-09-24,CI 独享故障):`openapi:export` 的 ESM 钩子把
 * `new URL('file:///home/runner/...').pathname` 的前导斜杠剥掉算 key,而装载 db 桩时
 * 的 needle 保留了前导斜杠 ⇒ Linux/CI 上永远不匹配 ⇒ `src/db/index.ts` 的桩静默失效 ⇒
 * 号称"不连 PG"的导出脚本真的连库,并死在路由注册期的幂等建表。Windows 本地恒绿,
 * 所以这条只能靠"把两种平台形态都喂进同一个函数"来钉。
 *
 * **判据实现只有一份,且测试不 import 上层包**(2026-09-25 改,架构契约门 D1):
 * 本文件属于 `repo-tooling`(rank 90),而 `apps/api` 声明 `exported:false`(端应用不对外),
 * 直接 `import` 会被 `scripts/check-architecture-policy.mjs` 判 D1 反向依赖。改为**从源文件
 * 文本里抠出 `normalizeStubKey` 的声明、用 `node:vm` 真的执行它** —— 跑的还是仓库里那一份实现
 * (不是镜像副本),同时把"抠不到即红"变成一条显式断言:将来有人改名 / 挪位置 / 加参数 /
 * 复制出第二份定义,这里都会大声失败,而不是静默测一份与源码无关的东西。
 * 同类"读源码文本而非 import"的既有正例:`deploy/tests/prod-bundle-diagnose.test.mjs`。
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const SCRIPT_REL = 'apps/api/scripts/export-openapi.ts'
const FN_NAME = 'normalizeStubKey'
const repoFile = (rel) =>
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', rel), 'utf8')

/** 跳到字符串/模板串末尾,返回结尾引号的下标。 */
function skipQuoted(src, i) {
  const quote = src[i]
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j]
    if (c === '\\') {
      j++
      continue
    }
    if (c === quote) return j
    // 模板串里的 ${...} 允许再嵌字符串/大括号,整段跳过后继续找收尾反引号
    if (quote === '`' && c === '$' && src[j + 1] === '{') j = matchBalanced(src, j + 1)
  }
  throw new Error(`字符串未闭合(起始下标 ${i})`)
}

/** 从 src[openIdx] 的 `(` 或 `{` 出发配平到闭合处(跳过字符串与注释),返回闭合下标。 */
function matchBalanced(src, openIdx) {
  const open = src[openIdx]
  const close = open === '(' ? ')' : open === '{' ? '}' : null
  if (!close) throw new Error(`期望 ( 或 { ,实为 '${open}'(下标 ${openIdx})`)
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      i = skipQuoted(src, i)
      continue
    }
    if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      i =
        src[i + 1] === '/'
          ? Math.max(i + 1, src.indexOf('\n', i) - 1)
          : src.indexOf('*/', i + 2) + 1
      continue
    }
    if (c === open) depth++
    else if (c === close && --depth === 0) return i
  }
  throw new Error(`括号未配平(起始下标 ${openIdx})`)
}

/**
 * 从源码文本里抠出 `function <name>(…) {…}` 的**完整声明文本**。
 * 三种情形一律抛错(不返回 undefined,免得下游"拿到个 undefined 也能跑"而静默降级):
 * ① 一份都没抠到(改名 / 挪走 / 写成箭头函数)② 抠到多份(复制出第二份真相)③ 括号配不上。
 */
function extractFunctionDeclaration(source, name, origin) {
  const header = new RegExp(`^[ \\t]*(?:export[ \\t]+)?function[ \\t]+${name}[ \\t]*\\(`, 'gm')
  const starts = []
  for (let m = header.exec(source); m !== null; m = header.exec(source)) {
    starts.push(m.index + m[0].search(/\S/))
  }
  if (starts.length === 0) {
    const declared = [
      ...source.matchAll(/^[ \t]*(?:export[ \t]+)?function[ \t]+([A-Za-z_$][\w$]*)/gm),
    ].map((m) => m[1])
    throw new Error(
      `${origin}: 没抠到 function ${name}(它被改名了、被挪走了、或不再是函数声明形态)。` +
        `测试拒绝静默降级为镜像实现 —— 请把被测实现重新暴露给本测试。` +
        `(该文件现有函数声明 ${declared.length} 个:${declared.slice(0, 12).join(', ')})`,
    )
  }
  if (starts.length > 1) {
    throw new Error(
      `${origin}: 抠到 ${starts.length} 份 function ${name}(第 ${starts.join('/')})` +
        `⇒ 同一份归一化逻辑存在两个真相,装载 needle 侧与钩子 key 侧会各自漂移`,
    )
  }
  const paramsEnd = matchBalanced(source, source.indexOf('(', starts[0]))
  const braceIdx = source.indexOf('{', paramsEnd + 1)
  if (braceIdx < 0) throw new Error(`${origin}: ${name} 的形参表后找不到 {`)
  return source.slice(starts[0], matchBalanced(source, braceIdx) + 1)
}

/** 抠 + 在干净上下文里真的求值成可调用函数(零依赖是前提,否则这里就抛)。 */
function loadFunctionFromSource(source, name, origin) {
  const decl = extractFunctionDeclaration(source, name, origin)
  return { decl, fn: vm.runInNewContext(`(${decl})`, {}, { filename: origin }) }
}

const SOURCE = repoFile(SCRIPT_REL)
const { decl: DECLARATION, fn: normalizeStubKey } = loadFunctionFromSource(
  SOURCE,
  FN_NAME,
  SCRIPT_REL,
)

describe('桩键归一化(Windows 本地绿 / Linux CI 红的分界)', () => {
  test('POSIX 绝对路径必须剥掉前导斜杠(旧实现在这里永不匹配)', () => {
    const posix = '/home/runner/work/IHUI-AI/IHUI-AI/apps/api/src/db/index.ts'
    assert.equal(
      normalizeStubKey(posix),
      'home/runner/work/ihui-ai/ihui-ai/apps/api/src/db/index.ts',
      'CI 上 key 不带前导斜杠,needle 若带就永不匹配 ⇒ 桩静默不生效',
    )
  })

  test('Windows 路径剥斜杠后必须与钩子侧同形(不得因修复 POSIX 而回归本地)', () => {
    const win = 'G:\\IHUI-AI\\apps\\api\\src\\db\\index.ts'
    assert.equal(normalizeStubKey(win), 'g:/ihui-ai/apps/api/src/db/index.ts')
    // 钩子实际拿到的是 URL pathname 形态(带一个前导斜杠),两侧必须收敛到同一个值
    assert.equal(
      normalizeStubKey('/G:/IHUI-AI/apps/api/src/db/index.ts'),
      normalizeStubKey(win),
      'pathname 形态与 resolve() 形态必须算出同一个 key',
    )
  })

  test('大小写不敏感(Windows 盘符 / CI 目录大小写不一致时仍要匹配)', () => {
    assert.equal(normalizeStubKey('/A/B/C.ts'), normalizeStubKey('/a/b/c.ts'))
  })

  test('幂等:对已经归一化过的值再跑一次不变(两侧任一先跑都不会漂)', () => {
    const once = normalizeStubKey('/home/runner/x/src/db/index.ts')
    assert.equal(normalizeStubKey(once), once)
  })

  // ── 反「静默测镜像实现」的提取自证 ──────────────────────────────────────
  test('提取:被测函数是从源码文本抠出来并真的执行的,不是测试里的镜像副本', () => {
    assert.match(
      DECLARATION,
      new RegExp(`^function[ \\t]+${FN_NAME}[ \\t]*\\(`),
      '抠到的声明头必须点名该函数(名字对不上就是抠错了东西)',
    )
    assert.equal(typeof normalizeStubKey, 'function', '从文本求值后必须真的可调用')
    assert.equal(
      normalizeStubKey.length,
      1,
      `${FN_NAME} 的入参个数变了 ⇒ 本测试与源码已脱钩,须重新对齐口径(不得改判据放过)`,
    )
    assert.equal(typeof normalizeStubKey('/A/B.ts'), 'string', '返回值不再是字符串 ⇒ 实现被换掉了')
    // 抠到的文本必须真是仓库里那一份的子串(排除"测试自己拼了一份"的退化形态)
    assert.ok(SOURCE.includes(DECLARATION), '抠出的声明不在源文件里 ⇒ 提取逻辑产出了虚构内容')
  })

  test('提取有牙:改名 / 删掉 / 复制成两份,三种形态都必须当场抛错(否则本测试等于没有)', () => {
    const origin = 'in-memory-fixture'
    // ① 改名(= 本票担心的"挪位置/换签名"里最典型的一种)
    const renamed = SOURCE.replace(
      new RegExp(`function ${FN_NAME}\\(`),
      'function stubKeyCanonicalForm(',
    )
    assert.notEqual(renamed, SOURCE, '对照组失效:源文本里没找到可改名的声明头')
    assert.throws(
      () => extractFunctionDeclaration(renamed, FN_NAME, origin),
      /没抠到 function normalizeStubKey/,
      '把函数改名后提取仍"成功" ⇒ 本测试会在测一份不存在的东西',
    )
    // ② 整段删掉
    const removed = SOURCE.replace(DECLARATION, '')
    assert.throws(
      () => extractFunctionDeclaration(removed, FN_NAME, origin),
      /没抠到 function normalizeStubKey/,
      '声明被删除时必须抛错,不得返回 undefined 让下游静默',
    )
    // ③ 复制出第二份定义
    assert.throws(
      () => extractFunctionDeclaration(`${SOURCE}\n${DECLARATION}\n`, FN_NAME, origin),
      /抠到 2 份 function normalizeStubKey/,
      '出现第二份同名定义时必须判红(两处真相正是本缺陷的成因)',
    )
    // 反向对照:原文必须恰好一份、且能求值
    assert.doesNotThrow(() => extractFunctionDeclaration(SOURCE, FN_NAME, origin))
  })

  // ── 反「两份实现」的装车证明 ────────────────────────────────────────────
  test('装车:钩子与装载侧必须共用同一个函数,而不是各写一遍正则', () => {
    const src = SOURCE
    assert.match(
      src,
      /\$\{normalizeStubKey\.toString\(\)\}/,
      '钩子模块必须注入同一个 normalizeStubKey 的源码 —— 两侧各写一份 replace() 就是本缺陷的成因',
    )
    assert.match(src, /const key = normalizeStubKey\(file\)/, '钩子里的 key 计算未走共用函数')
    assert.doesNotMatch(
      src,
      /const key = file\.replace\(/,
      '钩子里又内联了一份归一化正则 ⇒ 与 needle 侧成两套真相,改一处漏一处',
    )
  })

  test('装车:__test__ 出口在位(缺出口即红,防源脚本自己的契约先烂)', () => {
    // 本测试不再 import 它(架构契约门 D1:repo-tooling 不得依赖 exported:false 的 apps/api),
    // 但源脚本对外的 __test__ 出口仍是它自身契约的一部分:别的消费方摘线时这里要响。
    assert.match(
      SOURCE,
      /export const __test__ = \{[^}]*\bnormalizeStubKey\b/s,
      '__test__ 出口里已无 normalizeStubKey ⇒ 源脚本的测试面契约被改动,须同步确认',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
