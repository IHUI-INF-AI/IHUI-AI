// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 8(check-api-routes)的**方法推导判据唯一实现**(§0.6 单一真相源)。
 *
 * ## 两段搬迁史
 * ① 2026-09-28:由门体的 `extractFrontendCalls` 整体搬出成门内独立函数(判据一字未改),
 *    理由:CLI 形态提取也要算同一件事,而"两处算同一件事必漂移"是本仓记过最多次的失败型。
 * ② 2026-10-24(票 G-962c):由门体搬到本 lib —— 镜像测试
 *    `scripts/tests/check-api-routes-param-coverage.test.mjs` 的 T10 接线锁要求门体
 *    只 import 这一份、不得自带第二份(`function inferMethodAtLine(` 出现即红)。
 * CLI 的位置实参形态(`xxx('POST', '/api/x')`)由门体的 `cliPositionalMethod` 先行判定,
 * 命中则不走本判据 —— 它只有一个消费面(门内三处调用),故留在门体不搬,避免过度抽象。
 *
 * ## 优先级(与 2026-09-28 版逐字同序;分支 ①②③④⑤ 一字未改)
 * ① 显式注释 `// method: POST`(同行或前一行,最后覆盖,优先级最高)
 * ② 同行 `method:` 字面量
 * ③ 向后 4 行内第一个 `method:`(遇「调用收尾行」即停)
 * ④ 向前 3 行内最近 `method:`(与 ③ 逐字同一条收尾行判据)
 * ⑤ 同文件 wrapper 作用域:向前找最近的函数开头,块内第一个 `method:`
 * ⑥ 上下文启发式(**2026-10-24 收窄**,见下)
 * ⑦ 兜底 GET
 *
 * ## ⑥ 的收窄(票 G-962c;T7/T8/T9 三条行为正控钉的就是它;现场都是实测点名,不是假想)
 * 旧 ⑥ 是"idx-3..idx+4 **行号窗口**内搜 `\b(post|put|patch|delete)\s*[<(]`",两个失真:
 *   ① 驼峰/复合命名 wrapper 整族读不出动词:`\bpost` 要求词边界 ⇒ `srsPost<`(前缀是字母 `s`)
 *      与 `postJson<`(后缀是字母 `J`)都不命中;`del(` 根本不在旧清单里。
 *      实测现场 = 门 8「前缀假设未判定」7 条的成因:
 *      `apps/web/src/api/edu-api.ts` 的 srsPost 一族、
 *      `apps/web/src/lib/api/debug.ts` 的 postJson 一族、
 *      `apps/mobile-rn/src/hooks/use-ui-control-bridge.ts` 的 postQuiet、
 *      `apps/miniapp-taro/src/api/index.ts` 的 `del`(DELETE 短名,utils/api-bridge.ts 定义),
 *      旧判据把它们全读成 GET ⇒ 路径对得上、方法对不上。
 *   ② 窗口是**纯行号区间**:上一个**独立语句**的 `post(` 会被借给本行 ——
 *      实测 `apps/miniapp-taro/src/api/index.ts` 的
 *      `get(\`/api/share/content/${code}\`)` 被前一条 `post('/api/share/first-claim', …)`
 *      借出 POST(T9 负控的原始现场)。
 * 收窄后取证面 = **本调用表达式**(`callExprSpan`:从路径字面量向左找最近的未配对 `(`,在
 * **遮注释串面**上走,字符串里的括号不算;本行找不到就逐行向左上溯;向右用共享的
 * `findMatchingBracket` 配平取收尾行),⑥ 内部三级:
 *   ⑥a 被调名按词段(点链末段;驼峰/下划线/`$` 切分)查 `METHOD_VERB_WORDS` ——
 *       `srsPost`/`postJson`/`postQuiet`/`axios.post` ⇒ POST,`del` ⇒ DELETE,`get` ⇒ GET;
 *   ⑥b 表达式内 `method\s*:\s*<非引号起头的值>` ⇒ ANY(与旧口径同形:动态方法不知道就不猜,
 *       交给比对层的"任一拍即算注册");
 *   ⑥c 前一行对象键形态 `\b(post|put|patch|delete)\s*:\s*['"\`]`(与旧实现逐字同形,低频兜底)。
 * 方向性:表达式内取证**只会**丢掉「邻行独立语句」的借用(修错方向);多行调用自己的被调名
 * 无论住在哪一行都仍在表达式内(向左/向右都在射程)—— T9 第三条断言钉的就是这条边界。
 * 残留风险(如实登记,不写成"判过"):被调名恰好以动词词段开头、但语义不是该方法的观感名
 * (如 `deleteConfirm(...)`),新口径会读出 DELETE 而旧口径读 GET —— 词表只收 HTTP 五动词
 * 与仓内有真实调用方作证的 `del`(见 METHOD_VERB_WORDS 注释),不扩收 `create`/`save` 这类。
 */

import { maskCommentsAndStrings } from './code-mask.mjs'
import { findBraceBlockEnd, findMatchingBracket } from './api-route-registration-expand.mjs'

/**
 * 词段 → HTTP 方法(唯一词表)。只收**有真实调用方作证**的词段:
 *   · get/post/put/patch/delete —— HTTP 五动词;
 *   · del —— `apps/miniapp-taro/src/utils/api-bridge.ts` 的 DELETE 短名(`api/index.ts` 大面积
 *     使用),旧启发式清单里没有它 ⇒ `del<…>('/api/legacy/…')` 整族被读成 GET(T8 正控现场)。
 * 新增词段必须同笔有真实调用点 + 镜像测试用例("造好没装车 = 没有",§0.9)。
 */
export const METHOD_VERB_WORDS = new Map([
  ['get', 'GET'],
  ['post', 'POST'],
  ['put', 'PUT'],
  ['patch', 'PATCH'],
  ['delete', 'DELETE'],
  ['del', 'DELETE'],
])

/**
 * 被调名 → 方法(null = 名字里没有动词词段)。只取点链**末段**(`axios.post` → `post`),
 * 词段按驼峰边界/下划线/`$` 切分,命中即返回**最左**的词段 ——
 * `srsPost`/`postJson`/`postQuiet`/`del` 都只有一个动词词段,先后无关;
 * 多动词名(如 `getPostCount`)按最左动词定档并在测试里保持可复现。
 */
export function methodVerbOfCallName(name) {
  if (!name) return null
  const chain = String(name).split('.')
  const last = chain[chain.length - 1] || ''
  for (const word of last.split(/[_$]+|(?<=[a-z0-9])(?=[A-Z])/)) {
    const hit = METHOD_VERB_WORDS.get(word.toLowerCase())
    if (hit) return hit
  }
  return null
}

/**
 * 行数组 → 等长遮注释串面(走 code-mask 唯一实现,§0.6)。
 * 行数组按原样 `join('\n')` 还原全文再遮 —— 遮罩是**状态机**(块注释/多行模板跨行),
 * 逐行遮会失真;调用方普遍是 `src.split('\n')`,join 回去与原文逐字节同形 ⇒ 行号列号不漂。
 */
function maskedLinesFor(lines) {
  return maskCommentsAndStrings(lines.join('\n')).split('\n')
}

/**
 * 本调用表达式的**行区间**:`{ start, end, openLine, openCol }`。
 * 找不到开栏(行内无"引号紧邻斜杠"、或左侧走不到未配对 `(`)⇒ openLine/openCol = -1、
 * start = end = idx(调用方按"只有这一行"降级取证,不猜)。判据:
 *   ① 路径字面量定位:本行第一个 `(['"`])\/` —— 与门的 pathRe / BP 腿 / 别名式同形态
 *      (它们的调用点都住在字面量所在行);
 *   ② 向左走**遮注释串面**,遇 `)` 记一笔待配、遇 `(` 先冲抵待配,冲不抵的 `(` 就是
 *      本调用的开栏(本行走完仍未找到 ⇒ 逐行向左上溯 —— 多行实参调用点即此型);
 *   ③ 向右配平取收尾行:复用注册面提取器的 `findMatchingBracket`(它自己跳过字符串与注释),
 *      配不平(文件被截断等)⇒ end 停在 idx,不猜。
 */
export function callExprSpan(lines, idx) {
  return callExprSpanWithMasked(lines, idx, maskedLinesFor(lines))
}

function callExprSpanWithMasked(lines, idx, maskedLines) {
  const out = { start: idx, end: idx, openLine: -1, openCol: -1 }
  const raw = lines[idx] || ''
  const lit = /(['"`])\//.exec(raw)
  const fromCol = lit ? lit.index : raw.length
  let pending = 0
  for (let i = idx; i >= 0 && out.openLine === -1; i--) {
    const line = maskedLines[i] || ''
    for (let j = (i === idx ? Math.min(fromCol, line.length) : line.length) - 1; j >= 0; j--) {
      const ch = line[j]
      if (ch === ')') pending++
      else if (ch === '(') {
        if (pending > 0) pending--
        else {
          out.openLine = i
          out.openCol = j
          break
        }
      }
    }
  }
  if (out.openLine === -1) return out
  out.start = out.openLine
  const text = lines.join('\n')
  let offset = out.openCol
  for (let i = 0; i < out.openLine; i++) offset += (lines[i] || '').length + 1
  const closeIdx = findMatchingBracket(text, offset, '(', ')')
  if (closeIdx !== -1) {
    out.end = text.slice(0, closeIdx).split('\n').length - 1
  }
  return out
}

/**
 * span 开栏左侧的被调名(含点链:`axios.post` → 取回 `axios.post`);取不出 ⇒ null(不猜)。
 * 泛型实参整体跳过(`postJson<LaunchResult>(`、`del<{ deleted: boolean }>(`,多层 `<` 记深);
 * `=>` 的 `>` 若作为泛型实参内部表达式出现会把深度记错 —— 仓内现读无此形态,
 * 遇到时退化为"取不出名"(走 ⑦ 兜底),方向是保守不是误判。
 */
function calleeOfSpan(maskedLines, span) {
  if (span.openLine < 0) return null
  const line = maskedLines[span.openLine] || ''
  let k = span.openCol - 1
  if (line[k] === '>') {
    let depth = 0
    let found = -1
    for (let i = k; i >= 0; i--) {
      const ch = line[i]
      if (ch === '>') depth++
      else if (ch === '<') {
        depth--
        if (depth === 0) {
          found = i
          break
        }
      }
    }
    if (found < 0) return null
    k = found - 1
  }
  const m = /([A-Za-z0-9_$.]+)\s*$/.exec(line.slice(0, k + 1))
  return m ? m[1] : null
}

export function inferMethodAtLine(lines, idx) {
      // 推断 method: 优先 path 同行 → 向后第一个 method → 向前最近 method → 动态值用 ANY
      let method = 'GET'
      const sameLine = (lines[idx] || '').toLowerCase()
      const sameLineMatch = sameLine.match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
      if (sameLineMatch) {
        method = sameLineMatch[1].toUpperCase()
      } else {
        // 向后搜索 path 之后的第一个 method（同一 options 对象内，后 4 行）
        // 2026-09-17 加固:遇到「调用收尾行」(仅由 ) ] } > , ; 与空白组成)即停止扫描。
        // 原实现盲扫固定 4 行 → 会跨出当前调用、抓到**下一个不相关调用**的 method:
        //   queryFn: () => api<CirclesData>(`/api/circles/mine?page=${page}`),  ← path(应 GET)
        //   })                                                                   ← 收尾,应在此停止
        //   const delMut = useMutation({
        //     mutationFn: (id) => api(`/api/circles/${id}/leave`, { method: 'POST' }), ← 曾被误抓
        // 注:判据刻意**只用「整行纯闭合」**而非「行内出现右括号」——后者会被
        // `reason.trim()` / `JSON.stringify(x)` 之类实参里的括号误触发,反而漏掉真正的 method。
        let resolved = null
        for (let i = 1; i <= 4; i++) {
          const afterLine = lines[idx + i] || ''
          if (/^\s*[)\]}>;,]*\s*$/.test(afterLine)) break
          const afterMatch = afterLine
            .toLowerCase()
            .match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
          if (afterMatch) {
            resolved = afterMatch[1].toUpperCase()
            break
          }
        }
        if (!resolved) {
          // 向前搜索 path 之前的最近 method（前 3 行，取行号最大的 = 离 path 最近）
          // 2026-10-04 加固:与「向后 4 行」段同口径 —— 遇「调用收尾行」即停。
          // 原实现只判"这一行有没有 method",不判"我是否已经跨出了当前调用",于是会
          // 隔着收尾行抓到**上一个无关调用**的 method:
          //   mutationFn: async (favorited) => {
          //     await fetchApi(`/api/favorites/aiworld/${id}`, {
          //       method: 'DELETE',            ← 取消收藏的 method
          //     })                             ← 收尾,应在此停止
          //   ...
          //   api('/api/ai-world')             ← 本身无 method(语义 GET),曾被误归成 DELETE
          // 判据与向后那段**逐字同一条** `/^\s*[)\]}>;,]*\s*$/`(含"只用整行纯闭合"这条口径:
          // 行内出现右括号不算收尾,否则 `reason.trim()` / `JSON.stringify(x)` 之类
          // 实参里的括号会误触发,反而漏掉真正的 method)。
          for (let i = -1; i >= -3; i--) {
            const rawBefore = lines[idx + i] || ''
            if (/^\s*[)\]}>;,]*\s*$/.test(rawBefore)) break
            const beforeLine = rawBefore.toLowerCase()
            const beforeMatch = beforeLine.match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
            if (beforeMatch) {
              resolved = beforeMatch[1].toUpperCase()
              break
            }
          }
        }
        if (!resolved) {
          // 作用域搜索:向前找最近的函数定义开头,在函数体内找 method
          // 场景:const run = async (op, endpoint, body) => { ... method: 'POST' ... }
          //       调用处 run('generate', '/api/self-media/koubo/generate', ...) 在另一行
          // 限制 1:必须匹配 => 或 function 关键字,避免误匹配 const xxx = useMutation({ 等非函数
          // 限制 2:只对"间接调用"(非 fetchApi 直接调用)适用,避免 React 组件内多 method 误判
          // 2026-10-19 补(裸路径也算直接调用):`fetchApi('/course-qa')` 这类**不带 /api/ 前缀**
          //   的裸路径,运行期由 transport 的 normalizeUrl 补成 /api/… ⇒ 它同样是 fetchApi 直接调用。
          //   旧式只认 `['"`]\/api\/` ⇒ 裸路径被读成"间接调用" ⇒ 门向**前**借邻居函数的
          //   `method:'POST'` ⇒ 明明是 GET 的在册端点被报成"POST 死调用"(假阳性:把正确实现钉红)。
          //   `//` 起头是协议相对 URL(另一台主机),不属于本仓 transport ⇒ 仍排除。
          const directFetchRe = /fetchApi\s*(<[^>]*>)?\s*\(\s*['"`]\/(?!\/)/i
          const isDirectFetch = directFetchRe.test(lines[idx] || '')
          if (!isDirectFetch) {
            // 2026-09-17 加固:两处加 `(?:<[^<>()]*>\s*)?` 泛型参数支持。
            // 原正则不认 `async function api<T>(url, options)` —— 这是本仓最常见的
            // 「同文件 wrapper」写法(my-circles/page.tsx:41、meal/page.tsx:85、use-task-receiver.ts:92
            // 的 apiData 等)。识别失败会让作用域搜索**越过 wrapper 继续向前**,抓到更早某个
            // 函数的 `method: 'POST'`(如 join/leave 之类的写操作),把 wrapper 的 GET 调用误判成 POST。
            // 2026-10-04 加固:`funcStartRe` 的**限制 1(必须匹配 `=>` 或 `function`)确实生效**,
            // 已实测 8 形态:`const x = useMutation({` 之类非函数开头一律不匹配。
            // 但它**认不出对象方法简写**(`mutationFn: async (favorited) => {`、`onSuccess: (v) => {`
            // —— 第三支要求 `const|let|var` 前缀,对象字面量里的方法没有前缀 ⇒ 不匹配)。
            // 于是向上找 funcStartLine 时会**穿过**这些嵌套函数体,把它们的 method 当成
            // 外层函数的 method 取走(实测 ai-world/[id]/PageClient.tsx:112 归成 DELETE,
            // 源是 :81 取消收藏的 method)。
            //
            // 修法:向下扫时**整块跳过别的 React 数据/变更 hook 的对象参数块**(见下面
            // `reactDataHookBlockRe` 处的完整理由)。ai-world 那个块在到达 `:112` 之前
            // 就闭合了 ⇒ 跳过它,`:81` 的 DELETE 就借不出去,`:112` 落回 GET。
            const funcStartRe =
              /(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:<[^<>()]*>\s*)?\([^)]*\)\s*=>|function\s+\w+\s*(?:<[^<>()]*>\s*)?\(|(?:const|let|var)\s+\w+\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/
            // 别的 React 数据/变更 hook 的**对象参数块**开头(**含对象方法简写**那类):
            // `useMutation({` / `useQuery({` 这种行,块里的一切(`mutationFn` / `queryFn` /
            // `onSuccess` 等)都属于**那个 hook 自己的请求**,与本调用无关。
            //
            // ⚠️ 为什么**不用**"通用嵌套深度记账"(试过,已弃,理由留档免得下一个人重走):
            //   ① 按"整行纯闭合"记 -1:空行也匹配那条正则(字符类允许零个闭合符)⇒ 深度在第一个
            //      空行就归零 ⇒ 作用域段对**任何带空行的函数体全部失效**。实测后果:
            //      use-analytics.ts:181(`navigator.sendBeacon('/api/analytics/track',…)`,
            //      `sendBeacon` 隐式 POST)由 POST 掉成 GET = **由对变错**,被 method 清单
            //      A/B 对账当场抓住。
            //   ② 只记函数体开/闭:ai-world 那个 `useMutation({` 开的块在扫到 `:112` 时**仍未闭合**
            //      ⇒ 深度压根归不了零 ⇒ 拦不住。
            // 窄口径只认 hook 调用块,上面两类都不碰。
            //
            // ⚠️ hook 名只收**数据/变更**类、且必须 `({` 起头:
            //   `React.useCallback(async () => {` 的 `(` 后是 `async` 不是 `{` ⇒ 不匹配
            //   (实测正是它承载了 use-analytics.ts:181 必须保住的那个 POST);
            //   `React.useRef<T>([])` / `React.useEffect(() => {` 同理不匹配。
            const reactDataHookBlockRe =
              /\buse(?:Mutation|Queries|Query|SWR|InfiniteQuery|LazyQuery)\s*(?:<[^<>]*>)?\s*\(\s*\{\s*$/
            let funcStartLine = -1
            for (let i = idx - 1; i >= 0; i--) {
              if (funcStartRe.test(lines[i] || '')) {
                funcStartLine = i
                break
              }
            }
            if (funcStartLine >= 0) {
              for (let i = funcStartLine; i <= idx; i++) {
                const raw = lines[i] || ''
                // 别的 hook 对象块 ⇒ **整块跳过**(块内的 method 不属于本调用)。
                // 配对到 idx 之后(含 idx)说明**本调用就写在这个块里** —— 它自己的
                // queryFn/mutationFn,归因由「向后 4 行」段负责 ⇒ 同样不取,出循环。
                if (reactDataHookBlockRe.test(raw)) {
                  const blockEnd = findBraceBlockEnd(lines, i)
                  i = blockEnd > i ? blockEnd : i
                  if (i >= idx) break
                  continue
                }
                const fl = raw.toLowerCase()
                const fm = fl.match(/method\s*:\s*['"`]?(get|post|put|patch|delete)/)
                if (fm) {
                  resolved = fm[1].toUpperCase()
                  break
                }
              }
            }
          }
        }
        if (resolved) {
          method = resolved
        } else {
          // ⑥ 2026-10-24 收窄(票 G-962c):取证面 = **本调用表达式**,不再是 ±行窗口。
          //    旧实现两个实测失真见本文件头注「⑥ 的收窄」;新三级:
          //    ⑥a 被调名词段查 METHOD_VERB_WORDS;⑥b 表达式内动态 method: ⇒ ANY;
          //    ⑥c 前一行对象键形态(与旧实现逐字同形,低频兜底)。
          const maskedLines = maskedLinesFor(lines)
          const span = callExprSpanWithMasked(lines, idx, maskedLines)
          const spanText = maskedLines
            .slice(span.start, span.end + 1)
            .join('\n')
            .toLowerCase()
          if (/method\s*:\s*[^'"`\s]/.test(spanText)) {
            method = 'ANY'
          } else {
            const verb = methodVerbOfCallName(calleeOfSpan(maskedLines, span))
            if (verb) method = verb
          }
          if (method === 'GET') {
            const prev = (lines[idx - 1] || '').toLowerCase()
            const keyMatch = prev.match(/\b(post|put|patch|delete)\s*:\s*['"`]/)
            if (keyMatch) method = keyMatch[1].toUpperCase()
          }
        }
      }
      // 最高优先级:显式注释标注 `// method: POST`(同行或前一行),覆盖上述全部推断
      // 场景:跨文件 wrapper(useProcessApi)、多行函数签名(const run = async (\n...) =>)、
      //       同文件 wrapper 链(srsPost → explainConcept)等自动推断失效时
      const annotRe = /\/\/\s*method\s*:\s*(get|post|put|patch|delete)\b/i
      const annotMatch = (lines[idx] || '').match(annotRe) || (lines[idx - 1] || '').match(annotRe)
      if (annotMatch) {
        method = annotMatch[1].toUpperCase()
      }
      return method
}

// 供镜像测试直接打生产判据(§22c 消"两份真相")。本文件是纯库、无 CLI 入口,
// 故不需要 §22d 的 isDirectRun 守卫(与 route-registration-extract.mjs 同形态)。
export const __test__ = {
  inferMethodAtLine,
  methodVerbOfCallName,
  callExprSpan,
  METHOD_VERB_WORDS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
