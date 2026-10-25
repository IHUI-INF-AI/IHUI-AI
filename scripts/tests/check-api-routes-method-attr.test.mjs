// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:守门 8(check-api-routes)的 **method 归因跨调用污染**(2026-10-04)
 *
 * 缺陷本体(实测复现,`apps/web/app/(main)/ai-world/[id]/PageClient.tsx`):
 *   :77  const favMutation = useMutation({
 *   :78    mutationFn: async (favorited) => {
 *   :80      const r = await fetchApi(`/api/favorites/aiworld/${params.id}`, {
 *   :81        method: 'DELETE',              ← 取消收藏的 method
 *   :82      })                               ← 调用收尾行
 *   ...
 *  :112   api('/api/ai-world')                 ← **本身没有 method 选项,语义是 GET**
 * 改前 `inferMethodAtLine` 归成 DELETE;该路径后端真实存在且是 `GET /ai-world`
 * (`apps/api/src/routes/ai-world.ts:78`)⇒ 误报。
 *
 * 病根:`inferMethodAtLine` 的「向前 3 行」与「作用域」两段**不认调用收尾行就继续向前**,
 * 于是跨过**无关的下一个调用**,抓到更早某个 `method: 'DELETE'`。
 * 「向后 4 行」段早在 2026-09-17 就有这条加固(`:1383-1390`),**向前两段缺同一条**。
 *
 * 三条判据形态各钉一个用例(全部照真实文件形态复刻,最小夹具):
 *   T1 作用域段 · **对象方法简写**(`mutationFn: async () => {`,不是 `const x = () =>`)
 *      ⇒ `funcStartRe` 匹配不到它 ⇒ 越过 ⇒ 污染。修后归 GET。
 *   T2 防过度收紧 · 两条腿各钉一个:
 *      T2a 作用域段:同文件 wrapper(`const post = async (path, body) => {`)里的
 *          `method: 'POST'` **仍要归到 POST** —— 这是作用域段的**设计意图**
 *          (`:1416` 注释点名的 `run('generate', '/api/…')` 形态),过度收紧会把它打死。
 *      T2b 向前 3 行段:真正的 `method: 'POST'` 在调用行**上方 1 行** ⇒ 仍归 POST
 *          (加固是"遇收尾行即停",不是"一律不向前搜")。
 *   T3 对象方法简写夹在中间时,**后面**的调用不被污染(两个 useMutation 夹一个调用)。
 *
 * ⚠️ 判据选型(实测,不掩盖):**光看 method 值不够** —— 修法"更保守"最典型的失败形态是
 * 把所有跨块归因都掐掉,于是 POST 掉成 GET(实测 use-analytics.ts:181 就这么坏过一次,
 * `sendBeacon` 隐式 POST 被猜成 GET,被 A/B 对账当场抓住)。所以每个用例都用
 * **后端只注册一个 method** 的夹具:method 归错 ⇒ 打到 method 不符的注册 ⇒ 进死调用清单,
 * 读数从 0 变 1。归对 ⇒ 恒 0。这样"取到了"与"取错了"在读数上**分开**。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'check-api-routes.mjs')
const SRC = readFileSync(SCRIPT, 'utf8')

const BASELINE = JSON.stringify({ version: 1, perFileCount: {} })

function root() {
  const dir = mkScratch('ihui-api-routes-method-')
  mkdirSync(join(dir, 'apps', 'api', 'src', 'routes'), { recursive: true })
  mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
  return dir
}
function put(dir, rel, content) {
  const full = join(dir, ...rel.split('/'))
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
}
function run(dir, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, '--worktree', '--root', dir, ...extra], {
    cwd: HERE,
    encoding: 'utf8',
    // 不建 stdin 管道在本机会必 EBUSY(凡不吃 stdin 的子进程一律带管道)
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}
/** 某一端的调用点数 */
function calls(out, end) {
  const m =
    out.match(new RegExp(`· ${end}:文件 (\\d+) / 调用 (\\d+) /`)) ||
    out.match(new RegExp(`· ${end}:文件 (\\d+) / 调用点 (\\d+) /`))
  if (!m) throw new Error(`输出里没有 ${end} 的报数行\n${out}`)
  return Number(m[2])
}
function deadCalls(out, end) {
  const m = out.match(new RegExp(`· ${end}:死调用 (\\d+) 处`))
  return m ? Number(m[1]) : 0
}
function missingOf(dir) {
  return JSON.parse(readFileSync(join(dir, 'missing.json'), 'utf8'))
}

// ─────────────────────────────────────────────────────────────────────────
// T1 作用域段 · 对象方法简写(`mutationFn: async () => {`)跨调用污染
// ─────────────────────────────────────────────────────────────────────────
//
// 复刻 ai-world/[id]/PageClient.tsx:77-82 + :109-114 的骨架。
// 后端**只注册 GET** `/api/ai-world/:param` 那一族?不 —— 只注册 **GET `/api/worlds`**,
// 而前端那条被污染的调用是 `/api/worlds`:
//   修前归 DELETE ⇒ 打到不存在的 DELETE 桶 ⇒ 1 处死调用(且门判红)
//   修后归 GET    ⇒ 命中 GET 注册 ⇒ 0 死调用
// 这样 method 归错在读数上可见,而不是"两边都绿"。
test('T1 作用域段:对象方法简写(mutationFn: async () => {)在前,后面的调用不被跨调用污染', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 后端注册两族:GET /api/worlds(被污染的那条)+ DELETE /api/favorites/aiworld/:param
    // (取消收藏那条**必须**注册 —— 否则它自己会进判死清单,读数被第二个死调用搅浑,
    //  "method 归错"与"这条端点真的没注册"就分不开了)。
    put(
      dir,
      'apps/api/src/routes/worlds.ts',
      [
        "server.get('/api/worlds', async () => ({}))",
        "server.delete('/api/favorites/aiworld/:id', async () => ({}))",
        '',
      ].join('\n'),
    )
    put(
      dir,
      'apps/web/src/PageClient.tsx',
      [
        'export default function PageClient({ params }) {',
        // ↓ 无关的第一个调用:取消收藏,method: 'DELETE' 在 :9
        '  const favMutation = useMutation({',
        '    mutationFn: async (favorited) => {', // ← 对象方法简写,funcStartRe 匹配不到
        '      const r = await fetchApi(`/api/favorites/aiworld/${params.id}`, {',
        "        method: 'DELETE',", // ← 污染源(与 /api/worlds 无关)
        '      })', // ← 调用收尾行
        '      return false',
        '    },',
        '  })',
        '',
        '  const { data } = useQuery({',
        "    queryKey: ['worlds'],",
        '    queryFn: () =>',
        "    api('/api/worlds').then(", // ← 被污染的调用(自身无 method,语义 GET)
        '      (d) => d.list ?? [],',
        '    ),',
        '  })',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = missingOf(dir)
    assert.equal(
      calls(r.out, 'web'),
      2,
      `两条调用点都该在调用集里(取消收藏 + worlds)\n${r.out}`,
    )
    assert.deepEqual(
      missing.map((m) => m.path),
      [],
      `/api/worlds 必须归 GET 才命中后端 GET 注册;判死 = 仍被 :9 的 method: 'DELETE' 污染\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(r.status, 0, `在册端点不得判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// T2a 防过度收紧 · 作用域段的**设计意图**必须保住
// ─────────────────────────────────────────────────────────────────────────
//
// 复刻 admin/relay/enterprise/page.tsx:147-154 + :241 的形态:
//   const post = async (path, body) => {
//     const r = await fetchApi(path, {
//       method: 'POST',              ← method 写在 wrapper 函数体里
//     })
//     ...
//   }
//   post('/api/enterprise/contracts', { … })   ← 调用处传路径进去,自己不带 method
// 这是 `inferMethodAtLine` 作用域段的**存在理由**(`:1416-1417` 注释逐字点名了这个形态)。
// 修法若把"跨块归因"整体掐掉(而不只是"跨**已闭合**的块"),这条会掉成 GET ⇒ 打死。
// 后端只注册 **POST** `/api/enterprise/contracts` ⇒ 归 GET 就判死,读数分开。
test('T2a 防过度收紧:同文件 wrapper 里的 method: POST 仍归 POST(作用域段的设计意图)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 只注册 **POST** ⇒ 归成 GET 就打不到,判死
    put(
      dir,
      'apps/api/src/routes/enterprise.ts',
      "server.post('/api/enterprise/contracts', async () => ({}))\n",
    )
    put(
      dir,
      'apps/web/src/enterprise.ts',
      [
        'export default function EnterprisePage() {',
        // ↓ wrapper:method 在函数体里,调用处另传路径(真实形态)
        '  const post = async (path: string, body?: unknown) => {',
        '    setBusy(true)',
        '    try {',
        '      const r = await fetchApi(path, {',
        "        method: 'POST',", // ← 作用域段必须取到这一行
        '        body: body ? JSON.stringify(body) : undefined,',
        '      })',
        '      if (!r.success) throw new Error(r.error)',
        '      setMsg("操作成功")',
        '    } finally {',
        '      setBusy(false)',
        '    }',
        '  }',
        '',
        '  const onClick = () =>',
        "    post('/api/enterprise/contracts', { title: 'x' })", // ← 调用处不带 method
        '  return onClick',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = missingOf(dir)
    assert.equal(calls(r.out, 'web'), 1, `调用点必须仍在调用集里\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `wrapper 里的 POST 必须仍归 POST;判死 = 作用域段被过度收紧(退化成"跨块一律不取")\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(r.status, 0, `在册端点不得判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// T2b 防过度收紧 · 「向前 3 行」段必须仍能向上取
// ─────────────────────────────────────────────────────────────────────────
//
// 加固是"遇**调用收尾行**即停",不是"一律不向前搜"。真正带 method 的调用,
// method 就在上一行(没有收尾行隔断)⇒ 必须仍归 POST。
// 退化形态:实现写成"删掉整个向前段"或"只允许同行"⇒ 本用例立刻翻红。
// 后端只注册 **POST** ⇒ 归 GET 就判死。
test('T2b 防过度收紧:method 在调用行上方 1 行(无收尾行隔断)仍归 POST', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/jobs.ts', "server.post('/api/jobs/run', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/jobs.ts',
      [
        'export function runJob() {',
        '  return fetchApi<{ ok: boolean }>(',
        '    "/api/jobs/run",',
        "    { method: 'POST' },", // ← 向上 1 行就是 method,且中间没有收尾行
        '  )',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = missingOf(dir)
    assert.equal(calls(r.out, 'web'), 1, `调用点必须仍在调用集里\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `上一行的 method: 'POST' 必须仍被"向前 3 行"段取到;判死 = 该段被误删或收得过紧\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(r.status, 0, `在册端点不得判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// T2c「向前 3 行」段的**收尾行加固**本身要钉住(mut1 专用)
// ─────────────────────────────────────────────────────────────────────────
//
// T2b 钉的是"没有收尾行隔断时仍要取到 method"(防过度收紧方向);
// 本条钉的是反面 —— **有**收尾行隔断时必须**停**。两条一起才能把"向前 3 行"段的
// 行为钉死;只有 T2b 的话,把整条加固删掉(mut1)测试照样全绿(实测:mut1 只翻红源码锁)。
//
// 夹具形态:第一个调用带 method: 'DELETE' 且**闭合在第 4 行**,
// 第二个调用(自身无 method,语义 GET)在 3 行之内 ⇒ 不加固就会借到 DELETE。
//   fetchApi('/api/things/one', {
//     method: 'DELETE',
//   })                        ← 调用收尾行:向前段必须在此停
//   fetchApi('/api/things/two')   ← 应归 GET
// 后端:DELETE /api/things/one 要注册(否则它自己判死、搅浑读数);
//      **只**给 /api/things/two 注册 GET ⇒ 借到 DELETE 就判死。
test('T2c 向前段遇调用收尾行即停:隔着一个已闭合的调用不得借到它的 method', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(
      dir,
      'apps/api/src/routes/things.ts',
      [
        "server.delete('/api/things/one', async () => ({}))",
        "server.get('/api/things/two', async () => ({}))",
        '',
      ].join('\n'),
    )
    put(
      dir,
      'apps/web/src/things.ts',
      [
        'export async function go() {',
        "  await fetchApi('/api/things/one', {",
        "    method: 'DELETE',", // ← 上一个调用的 method
        '  })', // ← 调用收尾行:向前段必须在此停
        "  return fetchApi('/api/things/two')", // ← 自身无 method,语义 GET
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = missingOf(dir)
    assert.equal(calls(r.out, 'web'), 2, `两条调用点都该在调用集里\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `/api/things/two 必须归 GET;判死 = 向前段越过收尾行借到了上面那个 DELETE\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(r.status, 0, `在册端点不得判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// T3 对象方法简写夹在中间 → 后面的调用不被污染(两段各自的形状各来一次)
// ─────────────────────────────────────────────────────────────────────────
//
// 真实仓库里 ai-world 那种"两个 hook 夹一个 useQuery"的布局很常见。
// **两个污染源刻意用不同 hook 形态**:第一个 `useMutation({`、第二个 `useQuery({`
// (后者正是 ai-world 的真实形态)。只钉一种的话,把 hook 名收窄到只剩 useMutation
// 的过度收紧实现(mut3)照样全绿。
// 后端对两条路径**分别只注册 GET** ⇒ 任一条被污染(method 变 DELETE)就判死。
test('T3 两个对象方法简写夹一个调用:后面的调用不被污染(DELETE 借不出去)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    // 注册两族:两条 GET(应归 GET 的调用)+ 两条 DELETE(两个 mutation 自己)。
    // DELETE 那两条**必须**注册 —— 否则它们自己会进判死清单,读数被搅浑,
    // "GET 调用借到 DELETE"与"这条端点真的没注册"就分不开了。
    put(
      dir,
      'apps/api/src/routes/items.ts',
      [
        "server.get('/api/items', async () => ([]))",
        "server.get('/api/items/:id', async () => ({}))",
        "server.delete('/api/items/:id', async () => ({}))",
        "server.delete('/api/items/:id/x', async () => ({}))",
        '',
      ].join('\n'),
    )
    put(
      dir,
      'apps/web/src/items.tsx',
      [
        'export default function ItemsPage({ params }) {',
        // ↓ 第一个无关调用(method: DELETE 在 :5)
        '  const removeMutation = useMutation({',
        '    mutationFn: async (id: string) => {',
        '      const r = await fetchApi(`/api/items/${id}`, {',
        "        method: 'DELETE',", // ← 污染源 1
        '      })',
        '      return r',
        '    },',
        '  })',
        '',
        '  const { data: detail } = useQuery({', // ← **useQuery** 形态(ai-world 真实形态)
        "    queryKey: ['item', params.id],",
        '    queryFn: async (id: string) => {',
        '      const r = await fetchApi(`/api/items/${id}/x`, {',
        "        method: 'DELETE',", // ← 污染源 2:在**useQuery** 块里
        '      })',
        '      return r',
        '    },',
        '  })',
        '',
        '  const { data: list } = useQuery({',
        "    queryKey: ['items'],",
        '    queryFn: () =>',
        "    api('/api/items').then(", // ← 应归 GET
        '      (d) => d ?? [],',
        '    ),',
        '  })',
        '',
        '  const { data: one } = useQuery({',
        "    queryKey: ['item', params.id],",
        '    queryFn: () =>',
        "    api(`/api/items/${params.id}`).then(", // ← 应归 GET
        '      (d) => d ?? null,',
        '    ),',
        '  })',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = missingOf(dir)
    assert.equal(
      calls(r.out, 'web'),
      4,
      `四条调用点(两个 DELETE + 两个 GET)都该在调用集里\n${r.out}`,
    )
    assert.deepEqual(
      missing.map((m) => m.path),
      [],
      `两条 GET 调用都不得借到上面两个 DELETE;判死 = 仍被跨调用污染\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(deadCalls(r.out, 'web'), 0, `不得有死调用\n${r.out}`)
    assert.equal(r.status, 0, `在册端点不得判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})


// ─────────────────────────────────────────────────────────────────────────
// T4 回归留痕:作用域段必须**认得出**带空行的函数体
// ─────────────────────────────────────────────────────────────────────────
//
// 本轮真实踩到并修掉的坑,单独留痕。第一次修法走的是"通用嵌套深度记账"
// (逐行按 `/^\s*[)\]}>;,]*\s*$/` 记 -1),结果这条实测翻红:
//
//   该正则对**空行也成立**(字符类允许零个闭合符)⇒ 每个空行都被当成一次闭合
//   ⇒ 深度在函数体的第一个空行就归零 ⇒ 作用域段对**任何带空行的函数体全部失效**。
//   真实后果(被 method 清单 A/B 对账当场抓住):
//     apps/web/src/hooks/use-analytics.ts:181
//     `navigator.sendBeacon('/api/analytics/track', blob)` —— `sendBeacon` 隐式 POST,
//     改前归 POST(对),改后归 GET(错)⇒ **由对变错**。
//
// 最终修法改成"整块跳过别的 React hook 对象块",不依赖空行语义。
// 本用例钉住**结果**:带空行的 wrapper 函数体,method 仍要取得到。
// 后端只注册 **POST** ⇒ 一旦作用域段对空行失效,归成 GET 就判死。
test('T4 作用域段:函数体带空行时 method 仍取得到(空行不得让作用域段整体失效)', () => {
  const dir = root()
  try {
    put(dir, 'scripts/api-routes-baseline.json', BASELINE)
    put(dir, 'apps/api/src/routes/track.ts', "server.post('/api/track/send', async () => ({}))\n")
    put(
      dir,
      'apps/web/src/track.ts',
      [
        'export default function useTrack() {',
        '  const flush = React.useCallback(async () => {',
        '', // ← 空行:曾经的深度记账会在这里归零
        '    const batch = slice()',
        '', // ← 又一个空行
        '    const res = await fetchApi("/api/track/send", {',
        "      method: 'POST',", // ← 必须仍被作用域段取到
        '    })',
        '    return res',
        '  }, [])',
        '',
        '  return flush',
        '}',
        '',
      ].join('\n'),
    )
    const r = run(dir, ['--warn-only', '--dump-missing', join(dir, 'missing.json')])
    const missing = missingOf(dir)
    assert.equal(calls(r.out, 'web'), 1, `调用点必须仍在调用集里\n${r.out}`)
    assert.deepEqual(
      missing,
      [],
      `带空行的函数体里 POST 必须仍取得到;判死 = 作用域段被空行整体打瞎(真实后果见 use-analytics.ts:181 由 POST 变 GET)\n${JSON.stringify(missing, null, 1)}`,
    )
    assert.equal(r.status, 0, `在册端点不得判红\n${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────
// 源码锁:两条加固的判据入口都在,且注释不得被删
// ─────────────────────────────────────────────────────────────────────────

test('S1 源码锁:向前段与作用域段的加固判据都在', () => {
  // 向前 3 行段:必须先判收尾行再判 method(顺序不能反 —— 反了就等于没加固)
  const beforeAt = SRC.indexOf('// 向前搜索 path 之前的最近 method')
  assert.ok(beforeAt > 0, '找不到"向前搜索"段的注释')
  // 按行取该段(固定窗口比 indexOf 边界稳 —— 段内本身就有 `if (!resolved) {`)
  const seg = SRC.slice(beforeAt).split('\n').slice(0, 20).join('\n')
  // 两段的收尾行判据必须是**逐字同一条**。只锁 `.test(<var>)) break` 这个形态
  // (整条正则的转义在"源码当字符串匹配"时极易写歪 —— 实测踩过:`>` 与 `]` 的顺序
  // 一变就静默失配,源码锁自己变红)。真正的口径由上面的 T1/T2 用例钉。
  assert.match(
    seg,
    /\.test\(rawBefore\)\) break/,
    '向前段缺"遇调用收尾行即停"的加固(退回即跨调用污染复现)',
  )
  assert.match(
    seg,
    /for \(let i = -1; i >= -3; i--\)/,
    '向前段的 -3 窗口不得被改',
  )
  // 作用域段:hook 对象块识别 + 整块跳过 + 块内含本调用时出循环
  assert.match(
    SRC,
    /const reactDataHookBlockRe =\n\s*\/\\buse\(\?:Mutation\|Queries\|Query\|SWR\|InfiniteQuery\|LazyQuery\)/,
    '作用域段缺 reactDataHookBlockRe —— `useMutation({` / `useQuery({` 这类别的 hook 对象块无法被识别',
  )
  assert.match(
    SRC,
    /const blockEnd = findBraceBlockEnd\(lines, i\)/,
    '作用域段必须用 findBraceBlockEnd 把 hook 块整块跳过(只判开头不跳块 = 块内的 method 照样借出去)',
  )
  assert.match(
    SRC,
    /if \(i >= idx\) break/,
    '作用域段必须处理"本调用就写在该块内"的情形(它自己的 queryFn/mutationFn 归因归向后段)',
  )
  assert.match(
    SRC,
    /function findBraceBlockEnd\(lines, openLine\)/,
    'findBraceBlockEnd 不见了 —— hook 块跳过无实现',
  )
  // 已弃方案留档:通用深度记账的失败理由不得被删(否则下一个人会重走一遍并再踩空行那个坑)
  assert.match(SRC, /试过,已弃/, '必须留着"通用嵌套深度记账试过已弃"这条留档')
})

test('S2 源码锁:加固的依据注释不得被删(否则下一个人要重查一遍)', () => {
  assert.match(SRC, /for \(let i = -1; i >= -3; i--\)/, '向前段的 -3 窗口不得被改')
  assert.match(SRC, /已实测 8 形态/, '必须留着"funcStartRe 限制 1 已实测 8 形态"这个否证结论')
  assert.match(SRC, /对象方法简写/, '必须点明 funcStartRe 认不出对象方法简写这一形态')
  assert.match(
    SRC,
    /useCallback\(async \(\) => \{` 的 `\(` 后是 `async` 不是 `\{`/,
    '必须留着"hook 名只收数据/变更类且必须 ({ 起头"这条口径(含 useCallback 反例)',
  )
  assert.match(
    SRC,
    /use-analytics\.ts:181/,
    '必须点名 use-analytics.ts:181 这条被 A/B 抓到的由对变错记录',
  )
})

test('S3 边界:「向后 4 行」段那处既有加固不得被改动(2026-09-17 已验,本票不动它)', () => {
  // 本票只加向前两段的加固;向后段若被动过,T1/T2 的结论就不再可信。
  const afterAt = SRC.indexOf('// 向后搜索 path 之后的第一个 method')
  assert.ok(afterAt > 0, '找不到"向后搜索"段的注释')
  // 按行取该段的 12 行(段很短,固定窗口比 indexOf 边界稳)
  const seg = SRC.slice(afterAt).split('\n').slice(0, 14).join('\n')
  assert.match(
    seg,
    /\.test\(afterLine\)\) break/,
    '向后段的既有加固(遇调用收尾行即停)被改动了',
  )
  assert.match(seg, /2026-09-17 加固/, '向后段的加固依据注释不得被删')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
