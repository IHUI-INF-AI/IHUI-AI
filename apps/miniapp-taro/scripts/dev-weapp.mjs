// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// dev-weapp.mjs — wraps `taro build --type weapp --watch`
//
// Why:
//   pnpm dev runs taro in watch mode. 2026-07-26 起改用 weapp-tailwindcss
//   插件(在 config/index.ts 的 vitePlugins 注册),由插件在编译时同步处理
//   WXSS 选择器转义和 wxml/js class 匹配,无需 strip-tailwind-backslash.mjs。
//
//   历史背景:之前用 strip-tailwind-backslash.mjs 在 taro 构建后异步删除
//   WXSS 中的反斜杠转义,但无法处理 Tailwind 任意值语法 [xxx](541 个规则),
//   WXSS parser 把 [2px] 当属性选择器报错。weapp-tailwindcss 在编译时同步
//   把 .-bottom-[2px] 重写为 .-bottom-_b2px_B,WXSS 和 wxml 同步匹配。
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const repoRoot = resolve(appDir, '../..')

/**
 * i18n 档「要不要重生成」只认门在 `--group i18n --json` 下算好的 bundleStale
 * (= blocking 里的 B1/B2,即"跑一次生成器修得了"的那两类)。两条边界:
 *  ① **不得回落到全量面的退出码** —— 全量面另有 R1/R2/T1/G3 等与离线包无关的红点,
 *     拿它当"包是否过期"会让快检在有漂移时永远判脏、又永远修不动(与设计意图相反)。
 *  ② 字段缺失或不是布尔 ⇒ 判**未判定**,既不冒"已一致"也不冒"已刷新"
 *     (守门 97 同型:取不到东西被当成业务结论)。
 * 提到模块顶层是为了让它可被 §22d 的 import 形态直接喂夹具验证,不是为了给别人用。
 */
const staleOf = (v) => (typeof v?.bundleStale === 'boolean' ? v.bundleStale : null)
/** 过期清单(打印用):门在 i18n 档下算好的 blocking 数组,形状不对就当没有 */
const staleList = (v) => (Array.isArray(v?.blocking) ? v.blocking : [])

/**
 * 冷启前把四件派生产物对账一遍。
 *
 * 为什么放这里:此前 gen-i18n-compressed.mjs 只在 build 链里、另三件连 package.json 入口都没有,
 * 所以「开发时离线语言包是旧的」是常态而不是偶发(实测 2026-09-25:磁盘上的包比源少 3×7 个
 * taskStatus.* 键,而 build 才会刷它)。
 *
 * 为什么"先校验再决定要不要重生成":每次冷启都跑,必须便宜。
 * 实测(--worktree --group i18n)176 ms 判新鲜度;真正重生成 188–270 ms;
 * 全量四产物对账(含 572 个源文件的引用扫描)磁盘面 288 ms。
 *
 * 三条硬约束:
 *  ① **绝不阻断 dev** —— 对账或重生成本身失败只打印,不退出。开发机起不来比包旧更糟。
 *  ② **只自动刷 i18n 那一件** —— gen-line-icons 的源目录已被「图片全量外置 CDN」那轮清空
 *     (现 1 个 svg vs 注册表 78 键),它自带的 50% 拒绝闸会直接 exit 1;
 *     gen-tabbar-icons 实测重跑会产出**与已入库 PNG 字节不同**的图(sharp/lucide 已漂移,
 *     tab-agent.png 1092→1168 B),自动刷它=每次冷启悄悄改视觉资产并弄脏 10 个跟踪文件。
 *     这两件在此只被"告知",不被"执行";执行属人工动作(pnpm gen:line-icons / gen:tabbar-icons)。
 *  ③ 派生产物重生成前必须能自证"没吞掉任何东西" —— i18n 这一件按叶子键集对账,
 *     removed 必须为 0,否则回滚到重生前的字节(见 assertBundleSuperset)。
 */
async function refreshGenerated() {
  const guardScript = join(repoRoot, 'scripts', 'check-miniapp-generated.mjs')
  const bundleFile = join(appDir, 'src/i18n/generated/remote-locales.gen.ts')
  if (!existsSync(guardScript)) {
    console.warn('[dev-weapp] ⚠️ 对账脚本不在 scripts/check-miniapp-generated.mjs,跳过产物新鲜度检查(未判定,不代表已最新)')
    return
  }
  // §22d 的 isDirectRun 守卫让"import 一个 CLI 脚本"不带副作用,所以存续性证明复用门自己的
  // 解码器,而不是在这里抄第四份包格式。取不到就大声说明"证明没跑",不得当成通过。
  let decodeBundle = null
  try {
    const guard = await import(pathToFileURL(guardScript).href)
    decodeBundle = guard.__test__?.decodeBundle ?? null
  } catch (e) {
    console.warn(`[dev-weapp] ⚠️ import 对账脚本失败,产物存续性证明将不执行:${String(e?.message).split('\n')[0]}`)
  }

  const readVerdict = () => {
    // exit 0=干净 / 1=有命中 / 2=无法判定。三者都要区分:把 2 当 0 就是"没判也报绿"。
    try {
      const out = execFileSync(process.execPath, [guardScript, '--worktree', '--group', 'i18n', '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        maxBuffer: 64 << 20,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { code: 0, verdict: JSON.parse(out) }
    } catch (e) {
      const stdout = typeof e?.stdout === 'string' ? e.stdout : ''
      if (stdout.trim()) {
        try {
          return { code: e.status ?? 1, verdict: JSON.parse(stdout) }
        } catch {
          /* 落到下面 */
        }
      }
      return { code: e?.status ?? 2, error: String(e?.stderr || e?.message || e).split('\n')[0] }
    }
  }

  const first = readVerdict()
  if (first.error) {
    console.warn(`[dev-weapp] ⚠️ 离线包对账未能执行(exit ${first.code}):${first.error} —— 跳过刷新,不阻断 dev`)
    return
  }
  const stale = staleOf(first.verdict)
  if (stale === null) {
    console.warn('[dev-weapp] ⚠️ 对账输出里没有布尔型 bundleStale ⇒ 门与 dev 链的契约已漂移,本次**未判定**(不重生成,也不报"已一致")')
    return
  }
  if (!stale) {
    console.log('[dev-weapp] ✅ i18n 离线包与源一致(未重生成)')
  } else {
    const before = readFileSyncSafe(bundleFile)
    const staleFindings = staleList(first.verdict)
    console.log(`[dev-weapp] ⚠️ i18n 离线包过期 ${staleFindings.length} 处,重生成中…`)
    for (const f of staleFindings) console.log(`           · ${f.detail}`)
    let genError = null
    try {
      execFileSync(process.execPath, [join(here, 'gen-i18n-compressed.mjs')], {
        cwd: appDir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 64 << 20,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      genError = String(e?.stderr || e?.message || e).split('\n')[0]
    }
    // 存续性证明**必须在生成器失败时也跑**:生成器是"先写产物、再注水印"两步,
    // 注水印失败(exit 1)时产物已经被换掉了 —— 早退等于把一份"没自证过的新产物"留在盘上。
    if (before !== null) {
      const after = readFileSyncSafe(bundleFile)
      if (after !== null && after !== before && !assertBundleSuperset(before, after, decodeBundle)) {
        // 派生产物只能长不能缩:这是本仓"重生成烘进别人删除"那类事故的出口
        console.warn('[dev-weapp] ⛔ 新包比旧包少了键 ⇒ 已回滚到重生前的字节,并停止本次自动刷新')
        try {
          writeFileSync(bundleFile, before, 'utf8')
        } catch (e) {
          console.warn(`[dev-weapp] ⚠️ 回滚也失败(旧包已不在手上,请人工核对 git diff):${e.message}`)
        }
      }
    }
    if (genError) {
      console.warn(`[dev-weapp] ⚠️ 生成器报错(产物已按上面的存续性结论处置,dev 不阻断):${genError}`)
      return
    }
    const recheck = readVerdict()
    const recheckStale = staleOf(recheck.verdict)
    if (recheckStale === null) console.warn('[dev-weapp] ⚠️ 重生成后拿不到可判定的结论(未判定,不代表已刷新),不阻断 dev')
    else if (recheckStale) console.warn('[dev-weapp] ⚠️ 重生成后仍判过期(源可能正被并行会话改写),不阻断 dev')
    else console.log('[dev-weapp] ✅ i18n 离线包已刷新')
  }

  // 另三件:只报不刷(理由见函数头注②),并把门的结论原样递给开发者
  try {
    const out = execFileSync(process.execPath, [guardScript, '--worktree'], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    void out
  } catch (e) {
    const text = typeof e === 'string' ? e : `${e?.stdout ?? ''}${e?.stderr ?? ''}${e?.message ?? ''}`
    if (/无法判定/.test(text)) console.warn('[dev-weapp] ⚠️ 产物对账无法判定(不冒绿也不冒红),详见 node scripts/check-miniapp-generated.mjs --worktree')
    else console.warn(text.split('\n').filter(Boolean).map((l) => `[dev-weapp] ${l}`).join('\n'))
  }
}

function readFileSyncSafe(p) {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

/**
 * 逐语言比叶子键集,断言新包 ⊇ 旧包;少任何一个键即 false(调用方回滚)。
 * 解析形状刻意**不自己抄一份**,而是复用守门导出的 decodeBundle ——
 * 「两处算同一件事必须有且只有一份实现」,而 §22d 的 isDirectRun 守卫正是让
 * 「import 一个 CLI 脚本」不带副作用的那道门。
 * @param {string} beforeText 重生前的产物文本
 * @param {string} afterText  重生后的产物文本
 * @param {undefined | ((text:string)=>Map<string, Record<string,unknown>|null>)} decode 守门的解码器
 */
function assertBundleSuperset(beforeText, afterText, decode) {
  if (typeof decode !== 'function') {
    console.warn('[dev-weapp] ⚠️ 未能从 scripts/check-miniapp-generated.mjs 取到 decodeBundle ⇒ 存续性证明**未执行**(不记为通过)')
    return true
  }
  let ok = true
  for (const [label, text] of [['before', beforeText], ['after', afterText]]) {
    try {
      decode(text)
    } catch (e) {
      console.warn(`[dev-weapp] ⚠️ ${label} 这一份产物解不开(${String(e.message).split('\n')[0]})⇒ 跳过键集对账,交人工`)
      return true
    }
  }
  const before = decode(beforeText)
  const after = decode(afterText)
  for (const [locale, b] of before) {
    const a = after.get(locale)
    if (!b || !a) continue
    const removed = Object.keys(b).filter((k) => !(k in a))
    if (removed.length) {
      ok = false
      console.error(`[dev-weapp] 少了 ${removed.length} 个键(${locale}),如 ${removed.slice(0, 5).join(', ')}`)
    }
  }
  return ok
}

/**
 * 对账完再起 taro —— watch 编译读的就是这批产物,顺序反了等于白刷。
 * 无论对账成功、失败还是判不了,都必须起得来(约束①),所以用 finally。
 */
function startTaro() {
  // shell:true so Windows resolves `taro` -> `taro.cmd` automatically
  const taro = spawn('taro', ['build', '--type', 'weapp', '--watch'],
    { stdio: 'inherit', shell: true, windowsHide: true })

  taro.on('exit', (code) => {
    console.log(`[dev-weapp] taro exited with ${code}`)
    process.exit(code ?? 0)
  })

  process.on('SIGINT', () => taro.kill('SIGINT'))
  process.on('SIGTERM', () => taro.kill('SIGTERM'))
}

// §22d 双形态入口:直接 node 执行才起对账 + taro;被测试 import 时不得有副作用
// (否则 import 一次就拉起一个 watch 进程,并把真仓产物刷一遍)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  refreshGenerated()
    .catch((e) => {
      // 走到这里说明对账自身抛了未捕获异常 —— 只报,不拦 dev
      console.warn(`[dev-weapp] ⚠️ 产物对账异常退出(不阻断 dev):${String(e?.message || e).split('\n')[0]}`)
    })
    .finally(startTaro)
}

// 供镜像/临时夹具直接判定 i18n 档结论(§22c):刻意只暴露那两个纯函数,不暴露流程。
export const __test__ = { staleOf, staleList }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
