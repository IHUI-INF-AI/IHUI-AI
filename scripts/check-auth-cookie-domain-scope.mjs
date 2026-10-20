// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话 Cookie 域作用域守门(blocking;跳过 `HUSKY_SKIP_AUTH_COOKIE_DOMAIN_SCOPE`)。
 *
 * 为什么要有这道门(2026-10-20 两次实测,不是推演):
 *   auth Cookie 的 `Domain=` 属性挂错域,浏览器会**安静拒收** —— 没有报错、没有日志,
 *   界面照常显示"已登录"(内存 Bearer 一切正常),但只认 Cookie 的页面守卫恒 307,
 *   SSO「授权并跳转」恒判被拦。当天两连实测:
 *     · 本机臂:127.0.0.1:8801 上无条件挂 `Domain=.aizhs.top` ⇒ Cookie 从未落地(修复 d230137);
 *     · 公网臂:修本机时把 Host 取样落在裸 headers.host 上 ⇒ 反代后面的域内访客被降级成
 *       host-only,api.aizhs.top 与 bsm.aizhs.top 的跨子域共享登录被打断(修复 5c1b396)。
 *   两次的失效方向都是安静,靠人记记不住,故在提交口装机闸。
 *
 * 判据(三族,全部内容判据,提交者可满足 ⇒ 不构成恒红门;HEAD 面存量现读 0):
 *   V1 域外写手:apps/api/src 下凡调用 `setCookie(` 且调用括号区内出现 `domain` 的文件,
 *      必须就是 auth-cookies.ts 单源 —— 新增域属性写手必须收口进同一把尺子,不许旁开第二份
 *      (第二份必然漂移,漂移的表现永远是安静那一侧,AGENTS §0.6)。
 *   V2 判据拆毁:auth-cookies.ts 必须仍满足——`resolveCookieDomain(` 出现 ≥3 次(定义 +
 *      下发/摘除两个调用点),且 `requestRawHost` 函数体内含 `request.hostname`
 *      (代理感知出口;改回裸 headers.host 就是把公网臂的修复拆掉)。
 *   V3 回归形状:apps/api/src 任何文件出现字面量 `domain: COOKIE_DOMAIN` /
 *      `domain: process.env.COOKIE_DOMAIN`(无条件挂域的原始 bug 形状)⇒ 红。
 *
 * 判面纪律(§0.4):全量判 HEAD blob / `--staged` 判索引 blob / `--worktree` 仅人工逃生舱;
 *   两面旗同给 exit 2;文件清单取不到或枚举为 0 ⇒ exit 2 未判定,不记绿不冒红;
 *   注释与字符串一律遮掉(判的是代码结构,V3 连字符串一起遮,防夹具串误报)。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'
import { catBatch, gitRaw, selectFace, readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = 'apps/api/src'
const SINGLE_SOURCE = 'apps/api/src/utils/auth-cookies.ts'
const SKIP_ENV = 'HUSKY_SKIP_AUTH_COOKIE_DOMAIN_SCOPE'
/** 原始 bug 的字面量形状(无条件把配置域挂上,浏览器在域外 host 上安静拒收)。 */
const FORBIDDEN_LITERALS = ['domain: COOKIE_DOMAIN', 'domain: process.env.COOKIE_DOMAIN']
/** resolveCookieDomain 的最少出现次数:定义 1 + setAuthCookies 1 + clearAuthCookies 1。 */
const MIN_RESOLVER_REFS = 3

/** 提取从 `startIdx`(应指向某个 `(`)开始的配平括号区间的内文;配不平 ⇒ null(交由人工读)。 */
export function extractBalanced(text, startIdx) {
  if (text[startIdx] !== '(') return null
  let depth = 0
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return text.slice(startIdx + 1, i)
    }
  }
  return null
}

/** 从 masked 文本里取 `function <name>(` 的函数体(到下一个行首 `}`);找不到 ⇒ null。 */
export function functionBody(masked, name) {
  const m = new RegExp(`function ${name}\\(`).exec(masked)
  if (!m) return null
  const rest = masked.slice(m.index)
  const end = rest.indexOf('\n}')
  return end === -1 ? null : rest.slice(0, end)
}

/** setCookie 调用括号区内是否出现 `domain` 标识(配不平的调用不判,宁漏不误伤)。 */
export function setCookieAttachesDomain(masked) {
  const re = /setCookie\s*\(/g
  let m
  while ((m = re.exec(masked))) {
    const inner = extractBalanced(masked, m.index + m[0].length - 1)
    if (inner !== null && /(^|[^\w.])domain\b/.test(inner)) return true
  }
  return false
}

/**
 * 判定唯一实现(镜像测试 import 本函数,不得复制判据 —— §22c)。
 * @param {Array<{path:string, content:string|null}>} files
 * @returns {{violations:Array, scanned:number, undetermined:string[]}}
 */
export function judgeCookieDomainFiles(files) {
  const violations = []
  const undetermined = []
  let scanned = 0
  for (const f of files ?? []) {
    if (typeof f?.content !== 'string') {
      undetermined.push(f?.path ?? '(unknown)')
      continue
    }
    scanned++
    const masked = maskCommentsAndStrings(f.content)
    if (f.path !== SINGLE_SOURCE && setCookieAttachesDomain(masked)) {
      violations.push({
        rule: 'V1-域外写手',
        path: f.path,
        detail: `setCookie 调用里出现 domain 属性;域属性只许经 ${SINGLE_SOURCE} 的 resolveCookieDomain 一把尺子下发`,
      })
    }
    if (
      masked.includes('domain: COOKIE_DOMAIN') ||
      masked.includes('domain: process.env.COOKIE_DOMAIN')
    ) {
      violations.push({
        rule: 'V3-回归形状',
        path: f.path,
        detail:
          '无条件挂域的原始 bug 形状(domain: COOKIE_DOMAIN);必须走 resolveCookieDomain 按 host 判定',
      })
    }
    if (f.path === SINGLE_SOURCE) {
      const refs = (masked.match(/resolveCookieDomain\s*\(/g) ?? []).length
      if (refs < MIN_RESOLVER_REFS) {
        violations.push({
          rule: 'V2-判据拆毁',
          path: f.path,
          detail: `resolveCookieDomain( 出现 ${refs} 次 < ${MIN_RESOLVER_REFS}(定义 + 下发 + 摘除三个点必须同判据)`,
        })
      }
      const body = functionBody(masked, 'requestRawHost')
      if (body === null || !/request\.hostname/.test(body)) {
        violations.push({
          rule: 'V2-判据拆毁',
          path: f.path,
          detail:
            'requestRawHost 未走 request.hostname(代理感知出口);裸读 headers.host 会把反代后面的域内访客降级成 host-only',
        })
      }
    }
  }
  return { violations, scanned, undetermined }
}

function listFaceFiles(face) {
  // worktree 档复用索引清单再读磁盘(人工逃生舱,不追求枚举独立完整)。
  const spec =
    face === 'staged' || face === 'worktree'
      ? ['ls-files', '-z', '--', SOURCE_DIR]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', SOURCE_DIR]
  const out = gitRaw(spec, ROOT, { input: '' })
  return out.split('\u0000').filter(Boolean)
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()

  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
  })
  if (picked.error) {
    console.error(`⏭  ${picked.error}`)
    return 2
  }

  let paths
  try {
    paths = listFaceFiles(picked.face)
  } catch (e) {
    console.error(`⏭  无法判定:${e?.message ?? e}`)
    return 2
  }
  if (paths.length === 0) {
    console.error(`⏭  无法判定:${SOURCE_DIR} 在 ${picked.face} 面枚举到 0 个文件(不记绿)`)
    return 2
  }

  const prefix = picked.face === 'staged' ? ':' : `HEAD:`
  let contents
  try {
    contents =
      picked.face === 'worktree'
        ? new Map(paths.map((p) => [p, readWorktreeFile(ROOT, p)]))
        : catBatch(
            ROOT,
            paths.map((p) => `${prefix}${p}`),
          )
  } catch (e) {
    console.error(`⏭  无法判定:${e?.message ?? e}`)
    return 2
  }
  const files = paths.map((p) => ({
    path: p,
    content: contents.get(picked.face === 'staged' ? `:${p}` : `HEAD:${p}`) ?? null,
  }))

  const verdict = judgeCookieDomainFiles(files)
  if (verdict.scanned === 0) {
    console.error(
      `⏭  无法判定:${picked.face} 面 ${paths.length} 个文件全部取不到内容(不回落其他面,不记绿)`,
    )
    return 2
  }

  for (const u of verdict.undetermined) {
    console.error(`⏭  未判定:${u} 内容取不到(该文件不计绿也不计红,其余照判)`)
  }

  if (verdict.violations.length > 0) {
    console.error(
      `❌ 会话 Cookie 域作用域对账(${verdict.violations.length} 处,面=${picked.face},扫描 ${verdict.scanned} 文件):`,
    )
    for (const v of verdict.violations) {
      console.error(`   · [${v.rule}] ${v.path}\n     ${v.detail}`)
    }
    console.error(
      '   出路:域属性只许经 apps/api/src/utils/auth-cookies.ts 的 resolveCookieDomain 下发;',
    )
    console.error(
      '         Host 取样必须走 request.hostname(代理感知出口)。修判据前先读该文件头注的两连实测。',
    )
    return 1
  }

  console.log(
    `✅ 会话 Cookie 域作用域对账(面=${picked.face},扫描 ${verdict.scanned} 文件,未判定 ${verdict.undetermined.length},违规 0)`,
  )
  return 0
}

/** 正反成对:self-test 必须真造出每个 V 的阳性样本并看到它被判红,否则"判过"是空话。 */
function selfTest() {
  const authOk = [
    "function requestRawHost(request: FastifyReply['request']): string | undefined {",
    '  return request.hostname || request.headers.host',
    '}',
    'export function resolveCookieDomain(rawHost: string | undefined): string | undefined {',
    '  return host === domain ? COOKIE_DOMAIN : undefined',
    '}',
    'export function setAuthCookies(reply: FastifyReply, payload: AuthCookiesPayload): void {',
    '  const domain = resolveCookieDomain(requestRawHost(reply.request))',
    '  reply.setCookie(AUTH_TOKEN_COOKIE, payload.accessToken, { ...(domain ? { domain } : {}) })',
    '}',
    'export function clearAuthCookies(reply: FastifyReply): void {',
    '  const domain = resolveCookieDomain(requestRawHost(reply.request))',
    '  reply.setCookie(AUTH_TOKEN_COOKIE, "", { ...(domain ? { domain } : {}) })',
    '}',
  ].join('\n')
  const otherOk = 'reply.setCookie("sid", token, { path: "/", httpOnly: true })'
  const cases = [
    {
      name: 'V0 正控:单源文件 + 域外无域写手 ⇒ 0 违规',
      files: [f(SINGLE_SOURCE, authOk), f('apps/api/src/plugins/csrf.ts', otherOk)],
      want: 0,
    },
    {
      name: 'V1 阳性:域外文件 setCookie 括号区挂 domain ⇒ 红',
      files: [
        f(SINGLE_SOURCE, authOk),
        f('apps/api/src/plugins/csrf.ts', 'reply.setCookie("sid", t, { domain: "evil.com" })'),
      ],
      want: 1,
      rule: 'V1-域外写手',
    },
    {
      name: 'V1 阴性:括号区外的 domain 字段(n8n_domain / zod schema)不得误咬',
      files: [
        f(SINGLE_SOURCE, authOk),
        f(
          'apps/api/src/routes/zhs-legacy.ts',
          'const schema = { domain: z.string() }; fn(n8n_domain)',
        ),
      ],
      want: 0,
    },
    {
      name: 'V2 阳性:Host 取样被改回裸 headers.host ⇒ 红',
      files: [f(SINGLE_SOURCE, authOk.replace('request.hostname || ', ''))],
      want: 1,
      rule: 'V2-判据拆毁',
    },
    {
      name: 'V2 阳性:摘掉一个调用点 ⇒ refs 不足 ⇒ 红',
      files: [
        f(
          SINGLE_SOURCE,
          authOk.replace(
            'const domain = resolveCookieDomain(requestRawHost(reply.request))',
            'const domain = undefined',
          ),
        ),
      ],
      want: 1,
      rule: 'V2-判据拆毁',
    },
    {
      name: 'V3 阳性:无条件挂域的原始 bug 形状 ⇒ 红',
      files: [f(SINGLE_SOURCE, authOk + '\nreply.setCookie("x", v, { domain: COOKIE_DOMAIN })')],
      want: 1,
      rule: 'V3-回归形状',
    },
    {
      name: 'V3 阴性:注释里的字面量不判(遮注释)',
      files: [f(SINGLE_SOURCE, authOk + '\n// 历史 bug 形状:domain: COOKIE_DOMAIN')],
      want: 0,
    },
    {
      name: '夹具串里的 V3 形状不判(遮字符串)',
      files: [f(SINGLE_SOURCE, authOk + '\nconst doc = "domain: COOKIE_DOMAIN"')],
      want: 0,
    },
    {
      name: '内容取不到 ⇒ undetermined,不冒充判绿',
      files: [f(SINGLE_SOURCE, null)],
      want: 0,
      undetermined: 1,
    },
  ]
  let bad = 0
  let pass = 0
  for (const c of cases) {
    const got = judgeCookieDomainFiles(c.files)
    const ok =
      got.violations.length === c.want &&
      (c.rule === undefined || got.violations.every((v) => v.rule === c.rule)) &&
      (c.undetermined === undefined || got.undetermined.length === c.undetermined)
    if (ok) pass++
    else {
      bad++
      console.error(
        `❌ self-test:${c.name} ⇒ violations=${JSON.stringify(got.violations)} undetermined=${got.undetermined.length}`,
      )
    }
  }
  console.log(`${bad === 0 ? '✅' : '❌'} 自检 ${pass}/${cases.length} 例全过`)
  return bad === 0 ? 0 : 1
}

function f(p, content) {
  return { path: p, content }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  judgeCookieDomainFiles,
  extractBalanced,
  functionBody,
  setCookieAttachesDomain,
  SOURCE_DIR,
  SINGLE_SOURCE,
  SKIP_ENV,
  FORBIDDEN_LITERALS,
  MIN_RESOLVER_REFS,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
