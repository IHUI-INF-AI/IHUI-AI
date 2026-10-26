// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端**原生窗控按钮**(右上角最小化/最大化/关闭三钮)形状锁 —— 2026-10-26 立。
//
// 立因(用户实拍两问):
//  ① "关闭按钮容器的右侧跟工作区的右侧距离屏幕右侧的距离不一样"
//     —— overlay 定位基准取的是**窗口矩形**(含 DWM 边框/投影),而网页视口 == **客户区**;
//     实测 overlay 右缘距客户区右缘只剩 2 物理像素,工作区卡片是 14。
//  ② "暗色模式下这几个按钮的颜色你都没做好适配,根本都看不清"
//     —— Rust 命令 `set_caption_button_theme` **早已注册、全仓零调用方**(这条腿从来没接通),
//     而每次 page_load 又无条件按 URL 粗判覆盖:线上永远是同一个域名 ⇒ 恒判"浅顶栏",
//     用户切暗色后原生侧继续把深字画在深底上。
//
// 为什么是形状锁而不是行为测试:两条都是**静态可判**的缺陷(基准取哪个 API、消息有没有
// 人发、命令有没有三层消费者),用词法判据钉住"结构上不可能再丢";像素级真机断言只能靠
// Playwright/截图,而机主定档:接线/竞态类缺陷以形状锁代行为测试。每条判据都配**变异夹具**
// 当阳性对照 —— 摘掉即翻绿 = 夹具是空的,与"判据造好没装车"(§0.9)同罪。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUST_CHROME = join(ROOT, 'apps', 'desktop', 'src-tauri', 'src', 'window_chrome.rs')
const RUST_LIB = join(ROOT, 'apps', 'desktop', 'src-tauri', 'src', 'lib.rs')
const JS_BRIDGE = join(ROOT, 'apps', 'web', 'src', 'lib', 'tauri-bridge.ts')
const JS_HOOK = join(ROOT, 'apps', 'web', 'src', 'hooks', 'use-desktop.ts')
const JS_PROVIDER = join(ROOT, 'apps', 'web', 'src', 'providers', 'global-hooks-provider.tsx')

const read = (p) => readFileSync(p, 'utf8')

/**
 * 取 Rust 函数体(签名起点 → 配平的收尾 `}`)。逐字符扫**原文**并跳过注释/字符串/字符
 * 字面量 —— 不先剥噪声再定位:剥离会改长度,偏移就对不回原文了(实测这类"清洗后
 * 再索引"的写法必然错位)。
 */
function fnBody(src, sigRe) {
  const m = sigRe.exec(src)
  if (!m) return null
  const start = m.index
  let i = start
  let depth = 0
  let opened = false
  const n = src.length
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (c === '/' && (d === '/' || d === '*')) {
      if (d === '/') {
        const nl = src.indexOf('\n', i)
        i = nl < 0 ? n : nl + 1
      } else {
        const end = src.indexOf('*/', i + 2)
        i = end < 0 ? n : end + 2
      }
      continue
    }
    if (c === 'r' && d === '#') {
      // 原始字符串 r#"…"#(本文件末尾那段注入 JS 就是这一形)
      let hashes = 1
      while (src[i + hashes] === '#') hashes++
      const open = i + hashes
      if (src[open] === '"') {
        const closer = '"' + '#'.repeat(hashes)
        const end = src.indexOf(closer, open + 1)
        i = end < 0 ? n : end + closer.length
        continue
      }
    }
    if (c === '"') {
      i++
      while (i < n) {
        if (src[i] === '\\') {
          i += 2
          continue
        }
        if (src[i] === '"') {
          i++
          break
        }
        i++
      }
      continue
    }
    if (c === "'") {
      const close = src.indexOf("'", i + 1)
      i = close < 0 ? n : close + 1
      if (src[i] === "'") i++ // 'a' 之后紧跟 ' 的极端形
      continue
    }
    if (c === '{') {
      depth++
      opened = true
    } else if (c === '}') {
      depth--
      if (opened && depth === 0) return src.slice(start, i + 1)
    }
    i++
  }
  return null
}

/** 去掉 JS/TS 的 `//` 行注释(整行注释掉的接线不得算"已装车")。 */
function stripLineComments(src) {
  return src
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
}

/**
 * Rust **代码面**(剥掉 `//` 行注释与块注释,保留字符串)。
 * 注意:这里刻意不把块注释的收尾两字符写成字面量 —— 写在 JSDoc 里会当场终结本注释块
 * (实测把整份测试文件的语法结构打断,报错点落在几百行之外,极难归因)。
 * 判"某符号是否还在场"必须问代码面:文档注释里写着"上一版取 rcMonitor"是**证据**,
 * 不是残留 —— 拿整文件文本禁名字会把说明性注释一起判红(§12e 恒红门同型)。
 */
function rustCode(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
    .replace(/([^:])\/\/[^\n]*/g, '$1 ')
}

// ============================ 判据层 ============================

const J = {
  /** ① overlay 定位基准 = 客户区;窗口矩形 / 显示器矩形都不得再参与定位。 */
  judgeClientGeometry(chrome) {
    const sync = fnBody(chrome, /unsafe fn sync_overlay\(/)
    if (!sync) return ['未判定:sync_overlay 函数体取不到']
    const findings = []
    if (!/= client_bounds\(owner\) else/.test(sync)) {
      findings.push('sync_overlay 未走 client_bounds(基准不再是客户区 ⇒ 右缘会错回窗口矩形)')
    }
    if (/GetWindowRect\s*\(\s*owner/.test(sync)) {
      findings.push('sync_overlay 仍对宿主窗调 GetWindowRect(含边框/投影的 rect 不是网页视口)')
    }
    if (!/client_right\s*-\s*m\.total_w\s*-\s*m\.edge_gap/.test(sync)) {
      findings.push('x 不是「客户区右缘 − 容器宽 − 右避让」(基准与避让必须同批在场)')
    }
    if (!/client_top\s*\+\s*m\.top_offset/.test(sync)) {
      findings.push('y 不是「客户区顶边 + 顶偏移」')
    }
    // 显示器那一路是上一版专为最大化打的补丁;客户区口径下必须摘净(两套基准并存必漂移)。
    // 只问**代码面**:文档注释里写"上一版取 rcMonitor"是证据不是残留。
    const code = rustCode(chrome)
    for (const banned of [
      'MonitorFromWindow',
      'GetMonitorInfoW',
      'MONITORINFO',
      'MONITOR_DEFAULTTONEAREST',
      'rcMonitor',
    ]) {
      if (code.includes(banned)) findings.push(`显示器基准残留:${banned}`)
    }
    return findings
  },

  /** ①b 取不到客户区 ⇒ 显式不判(保持原位),绝不回落另一面冒判。 */
  judgeClientNoFallback(chrome) {
    const f = fnBody(chrome, /unsafe fn client_bounds\(/)
    if (!f) return ['未判定:client_bounds 函数体取不到']
    const findings = []
    if (!/GetClientRect\s*\(\s*owner/.test(f)) findings.push('client_bounds 未调 GetClientRect')
    if (!/ClientToScreen\s*\(\s*owner/.test(f)) {
      findings.push(
        'client_bounds 未调 ClientToScreen(客户区是相对坐标,不换算到屏坐标就是拿左上角当原点)',
      )
    }
    // windows crate 里 ClientToScreen 返回 BOOL(FALSE 才是失败),写成 .is_err() 直接编译失败
    if (/ClientToScreen[^;]*\.is_err\(\)/.test(f)) {
      findings.push('ClientToScreen 返回值判错形:它返回 BOOL(实测 E0599),不得按 is_err 判')
    }
    if (/GetWindowRect/.test(f))
      findings.push('client_bounds 内回落了 GetWindowRect(取不到输入不得用另一面冒判)')
    return findings
  },

  /** ②a 网页上报主题这条腿必须三层齐:JS 出口 → 挂载点 → Rust 命令 + generate_handler。 */
  judgeThemeWiring({ bridge, hook, provider, rustLib }) {
    const findings = []
    const b = stripLineComments(bridge)
    const h = stripLineComments(hook)
    const p = stripLineComments(provider)
    const m = /invoke\(\s*'set_caption_button_theme'[^\n]*/.exec(b)
    if (!m) return ["未判定:tauri-bridge.ts 里找不到 invoke('set_caption_button_theme') 出口"]
    const call = m[0]
    if (!/darkBg/.test(call)) {
      findings.push(
        'JS 入参没写 camelCase `darkBg`(tauri v2 按 camelCase 取参;写 dark_bg 会被判缺参,而缺参失败是静默的)',
      )
    }
    if (/dark_bg\s*:/.test(call))
      findings.push('JS 侧出现 snake_case 键 dark_bg(与 Rust 签名同名不等于 wire 上同名)')
    if (!/label/.test(call))
      findings.push('没把窗口 label 传给宿主(main/admin 两窗各自一档,漏 label = 两窗共用一个档)')

    if (!/fn set_caption_button_theme\s*\(/.test(rustLib))
      findings.push('Rust command set_caption_button_theme 已不在 lib.rs')
    const handler = /invoke_handler\(tauri::generate_handler!\[[\s\S]*?\]/.exec(rustLib)
    if (!handler || !/set_caption_button_theme/.test(handler[0])) {
      findings.push(
        'set_caption_button_theme 未挂进 generate_handler!(声明了却调不到 = 恒 "命令不存在" 那一型)',
      )
    }

    if (!/export async function setCaptionButtonTheme/.test(b))
      findings.push('bridge 没导出 setCaptionButtonTheme')
    if (!/export function useDesktopCaptionTheme/.test(h))
      findings.push('use-desktop.ts 里没有 useDesktopCaptionTheme')
    if (!/useDesktopCaptionTheme\(\)/.test(p)) {
      findings.push(
        'useDesktopCaptionTheme 没在 global-hooks-provider 真实调用(挂载点被摘/注释 ⇒ 命令注册了却没人调,就是本票的原始事故)',
      )
    }
    if (!/attributeFilter:\s*\[\s*'class'\s*\]/.test(h)) {
      findings.push(
        '网页侧观察者必须盯 <html> 的 class(暗色真相源是 .dark class;盯 resolvedTheme 会漏 system 档首帧)',
      )
    }
    if (!/classList\.contains\('dark'\)/.test(h)) {
      findings.push("网页侧没读 documentElement.classList.contains('dark')")
    }
    return findings
  },

  /**
   * ②e 顶栏像素实测兜底 —— 三档次序必须是「上报 > 实测 > slot」,而且实测判准时才敢判。
   *
   * 为什么允许原生自己读屏幕像素、却不允许它去问网页:GetPixel 读的是**已经合成到屏幕上**
   * 的像素,不新增任何 IPC 面;而"从远程页面 eval 一段脚本反查主题"等于给远程域开一条
   * 够得着 `__TAURI_INTERNALS__` 的原生能力口子(`embedded_browser.rs` 把 `__TAURI` /
   * `invoke(` / `ipc.localhost` 列为禁用词正是为此)—— 见 `judgeInjectedJsNoIpc`。
   */
  judgeTopbarProbe(chrome) {
    const findings = []
    const dn = fnBody(chrome, /fn dark_now\(&self/)
    if (!dn) return ['未判定:OverlayState::dark_now 取不到']
    if (!/if self\.theme_reported \{\s*\r?\n\s*return self\.dark_bg;/.test(dn)) {
      findings.push('上报值没有优先返回(实测会把网页这条权威腿冲掉)')
    }
    if (!/sample_topbar_dark\(dc, overlay, self\.owner\)\.unwrap_or\(self\.dark_bg\)/.test(dn)) {
      findings.push('实测取不到时没回落 slot(不得猜第三值,§0.3)')
    }

    const sp = fnBody(chrome, /unsafe fn sample_topbar_dark\(/)
    if (!sp) return [...findings, '未判定:sample_topbar_dark 取不到']
    if (!/lums\.sort_unstable\(\)/.test(sp))
      findings.push('没取中位数(均值会被白底上几笔深色图标拖过阈值)')
    const bands = (sp.match(/Some\((true|false)\)/g) || []).length
    if (bands !== 2) findings.push(`实测必须只给深/浅两档结论,现在 ${bands} 档`)
    if (!/\}\s*else\s*\{\s*\r?\n\s*None\s*\r?\n\s*\}/.test(sp))
      findings.push('亮度落在模糊带时必须「不判」(None),不得硬猜一档')
    if (!/median < 80/.test(sp) || !/median > 175/.test(sp))
      findings.push('模糊带阈值缺失或不配对(浅/深一侧被并进了另一档)')
    if (!/x > client_left/.test(sp)) findings.push('采样越过了客户区左缘(测到的是别的窗口或桌面)')
    if (!/o\.left - scale\(6, dpi\)/.test(sp))
      findings.push('没让开自绘钮左缘(把自己的像素算进样本)')

    const co = fnBody(chrome, /unsafe fn create_overlay\(/)
    if (!co) return [...findings, '未判定:create_overlay 取不到']
    if (
      !/if !theme_reported \{[\s\S]{0,200}SetTimer\(Some\(overlay\), THEME_PROBE_TIMER, THEME_PROBE_MS, None\)/.test(
        co,
      )
    ) {
      findings.push('未上报时没挂实测定时器(暗色要等下一次重绘才看得见,窗口静止就永远不纠偏)')
    }
    const wm = fnBody(chrome, /unsafe extern "system" fn overlay_wnd_proc\(/)
    if (!wm) return [...findings, '未判定:overlay_wnd_proc 取不到']
    if (!/state\.theme_reported = lparam\.0 != 0/.test(wm))
      findings.push('主题消息没同时带「是不是上报值」(wparam 一档不够)')
    // **两处**摘表都要在场:收到上报当场摘(否则实测继续压过上报腿),
    // 以及 WM_TIMER 里自我了断(万一消息顺序颠倒/漏发,表也不能永远挂着)。
    const kills = (wm.match(/KillTimer\(Some\(hwnd\), THEME_PROBE_TIMER\)/g) || []).length
    if (kills < 2)
      findings.push(`摘表点只有 ${kills} 处(<2:上报后实测会一直压着上报腿,或漏发时表永不摘)`)
    return findings
  },

  /**
   * ②f 注入远程页面的 JS 绝不许够得着原生 IPC。
   * 词表与 `apps/desktop/src-tauri/src/embedded_browser.rs` 的禁用词同源。
   */
  judgeInjectedJsNoIpc(chrome) {
    const m = /pub const HIDE_HTML_WINDOW_CONTROLS_JS: &str = r#"[\s\S]*?"#;/.exec(chrome)
    if (!m) return ['未判定:找不到注入 JS 常量']
    const findings = []
    for (const forbidden of ['__TAURI', 'invoke(', 'ipc.localhost', '__TAURI_INTERNALS__']) {
      if (m[0].includes(forbidden))
        findings.push(`注入 JS 里出现禁用词 ${forbidden}(等于给远程域开原生能力口子)`)
    }
    return findings
  },

  /** ②b 判序:壳自有页按 URL(并清 reported),线上按上报值。 */
  judgeThemePrecedence(chrome) {
    const f = fnBody(chrome, /pub fn apply_theme_on_page_load\(/)
    if (!f) return ['未判定:apply_theme_on_page_load 不存在(页面加载的深浅没有判序出口)']
    const findings = []
    if (!/theme_is_dark_for_url\(url\)/.test(f))
      findings.push('壳自有页那一档不再按 URL 判(离线/占位页没有前端上报)')
    if (!/reported_slot\(label\)\.store\(false/.test(f))
      findings.push('壳自有页没清 reported(回线上页会一直拿离线档不放)')
    // 判序的**结构**必须是 `… else if reported { theme_slot… }`:只看"两个 slot 都被读过"
    // 会被"读了一次却没参与决策"骗过去(变异夹具 precedenceAlwaysUrl 实测就是这么溜掉的)。
    const branch = /else if\s+reported\s*\{[\s\S]{0,120}?theme_slot\(label\)\.load/.test(f)
    if (!branch)
      findings.push('线上页的深浅不是「上报过就复读上报值」⇒ 又回到被无条件按 URL 粗判覆盖的老写法')
    return findings
  },

  /** ②c 建窗初值取自 slot(晚到的上报不能被创建时的默认档冲掉)。 */
  judgeOverlaySeed(chrome) {
    const f = fnBody(chrome, /pub fn enable_native_caption_buttons<W: CaptionWindowOps>\(/)
    if (!f) return ['未判定:enable_native_caption_buttons 函数体取不到']
    const findings = []
    if (!/theme_slot\(&label\)\.load/.test(f))
      findings.push('建窗时没从 theme_slot 取深浅初值(网页上报早于建窗 ⇒ 首帧仍是默认档)')
    if (/create_overlay\(\s*owner,\s*(true|false)\s*\)/.test(f))
      findings.push('create_overlay 的深浅写成了字面量(bool 参数失去单一事实源)')
    if (!/overlay_slot\(&label\)/.test(f))
      findings.push('overlay 句柄未登记进 overlay_slot(主题消息发不到它)')
    return findings
  },

  /** ②d 配色只有一个出口:绘制路径不得再各自 if dark_bg 挑字面量。 */
  judgePaletteSingleSource(chrome) {
    const f = fnBody(chrome, /unsafe fn render_overlay\(/)
    if (!f) return ['未判定:render_overlay 函数体取不到']
    const findings = []
    if (!/state\.palette\(/.test(f)) findings.push('绘制路径没走 state.palette(…)')
    if (/if\s+state\.dark_bg/.test(f))
      findings.push(
        'render_overlay 内仍有 `if state.dark_bg` 分支(深浅档必须成对住在 Palette::dark/light)',
      )
    const lits = (f.match(/0x[0-9A-Fa-f]{8}/g) || []).length
    if (lits > 0)
      findings.push(`render_overlay 内残留 ${lits} 枚颜色字面量(应全部住在 Palette 两档里)`)
    // 两档必须**成对**在场:只补一档 = 另一个主题没有配色(本票的原始缺陷正是暗档缺席)
    for (const ctor of ['Palette::light()', 'Palette::dark()']) {
      if (!chrome.includes(ctor)) findings.push(`${ctor} 缺失(缺一档 = 那个主题没有配色)`)
    }
    if (!/fn palette\(&self/.test(chrome)) findings.push('OverlayState::palette 不存在')
    return findings
  },
}

// ============================ 变异夹具(阳性对照) ============================

/**
 * 每条判据一个"退回旧写法"的变异体。夹具一律**单行**替换(CRLF 工作副本里多行
 * 字面量永不命中),且 mutate() 断言字节确实变了 —— 改了个空的夹具比没有夹具更坏。
 */
const MUTANTS = [
  {
    key: 'clientGeometry',
    file: RUST_CHROME,
    re: /= client_bounds\(owner\) else/,
    to: '= window_rect_fixed(owner) else',
    judge: (f, t) => J.judgeClientGeometry(t),
    expect: '未走 client_bounds',
  },
  {
    key: 'windowRectBack',
    file: RUST_CHROME,
    re: /let x = client_right - m\.total_w - m\.edge_gap;/,
    to: 'let mut rect = RECT::default(); if GetWindowRect(owner, &mut rect).is_err() { return; } let x = rect.right - m.total_w - m.edge_gap;',
    judge: (f, t) => J.judgeClientGeometry(t),
    expect: '仍对宿主窗调 GetWindowRect',
  },
  {
    key: 'monitorResidue',
    file: RUST_CHROME,
    re: /let x = client_right - m\.total_w - m\.edge_gap;/,
    to: 'let _mi = MONITORINFO::default(); let x = client_right - m.total_w - m.edge_gap;',
    judge: (f, t) => J.judgeClientGeometry(t),
    expect: '显示器基准残留',
  },
  {
    key: 'clientFallsBackToRect',
    file: RUST_CHROME,
    re: /if !ClientToScreen\(owner, &mut origin\)\.as_bool\(\) \{/,
    to: 'if !ClientToScreen(owner, &mut origin).as_bool() && GetWindowRect(owner, &mut RECT::default()).is_ok() {',
    judge: (f, t) => J.judgeClientNoFallback(t),
    expect: '回落了 GetWindowRect',
  },
  {
    key: 'clientNoMap',
    file: RUST_CHROME,
    re: /if !ClientToScreen\(owner, &mut origin\)\.as_bool\(\) \{/,
    to: 'if false {',
    judge: (f, t) => J.judgeClientNoFallback(t),
    expect: '未调 ClientToScreen',
  },
  {
    key: 'clientIsErrShape',
    file: RUST_CHROME,
    re: /if !ClientToScreen\(owner, &mut origin\)\.as_bool\(\) \{/,
    to: 'if ClientToScreen(owner, &mut origin).is_err() {',
    judge: (f, t) => J.judgeClientNoFallback(t),
    expect: '返回值判错形',
  },
  {
    key: 'jsArgSnakeCase',
    file: JS_BRIDGE,
    re: /label: getCurrentWindow\(\)\.label, darkBg \}\)/,
    to: 'label: getCurrentWindow().label, dark_bg: darkBg })',
    judge: (f, t) => J.judgeThemeWiring({ ...f, bridge: t }),
    expect: 'snake_case',
  },
  {
    key: 'providerMountRemoved',
    file: JS_PROVIDER,
    re: /\n\s*useDesktopCaptionTheme\(\)/,
    to: '\n  void 0',
    judge: (f, t) => J.judgeThemeWiring({ ...f, provider: t }),
    expect: '没人调',
  },
  {
    key: 'watchWrongAttribute',
    file: JS_HOOK,
    re: /attributeFilter: \['class'\]/,
    to: "attributeFilter: ['data-theme']",
    judge: (f, t) => J.judgeThemeWiring({ ...f, hook: t }),
    expect: '盯 <html> 的 class',
  },
  {
    key: 'precedenceAlwaysUrl',
    file: RUST_CHROME,
    re: /let dark = if theme_is_dark_for_url\(url\)[\s\S]*?\n\s*\};/,
    to: 'let dark = theme_is_dark_for_url(url);',
    judge: (f, t) => J.judgeThemePrecedence(t),
    expect: '又回到被无条件',
  },
  {
    key: 'overlaySeedLiteral',
    file: RUST_CHROME,
    re: /let dark_bg = theme_slot\(&label\)\.load\(std::sync::atomic::Ordering::Relaxed\);/,
    to: 'let dark_bg = false;',
    judge: (f, t) => J.judgeOverlaySeed(t),
    expect: 'theme_slot',
  },
  {
    key: 'paletteForkBack',
    file: RUST_CHROME,
    re: /let p = state\.palette\(/,
    to: 'let p = if state.dark_bg { Palette::dark() } else { Palette::light() }; //',
    judge: (f, t) => J.judgePaletteSingleSource(t),
    expect: 'if state.dark_bg',
  },
  {
    key: 'overlayProbeIgnoresReport',
    file: RUST_CHROME,
    re: /if self\.theme_reported \{/,
    to: 'if false {',
    judge: (f, t) => J.judgeTopbarProbe(t),
    expect: '优先',
  },
  {
    key: 'overlayProbeMeanNotMedian',
    file: RUST_CHROME,
    re: /lums\.sort_unstable\(\);/,
    to: '// 改用均值',
    judge: (f, t) => J.judgeTopbarProbe(t),
    expect: '中位数',
  },
  {
    key: 'overlayProbeNoAbstain',
    file: RUST_CHROME,
    re: /if median < 80 \{/,
    to: 'if median < 255 {',
    judge: (f, t) => J.judgeTopbarProbe(t),
    expect: '模糊带',
  },
  {
    key: 'overlayProbeNoKillTimer',
    file: RUST_CHROME,
    re: /let _ = KillTimer\(Some\(hwnd\), THEME_PROBE_TIMER\);/,
    to: 'let _ = 0;',
    judge: (f, t) => J.judgeTopbarProbe(t),
    expect: '摘表',
  },
  {
    key: 'injectedJsReachesIpc',
    file: RUST_CHROME,
    re: /var s = document\.createElement\('style'\);/,
    to: "window.__TAURI_INTERNALS__.invoke('x'); var s = document.createElement('style');",
    judge: (f, t) => J.judgeInjectedJsNoIpc(t),
    expect: '禁用词',
  },
]

function applyMutant(key) {
  const mu = MUTANTS.find((x) => x.key === key)
  assert.ok(mu, `没有名为 ${key} 的变异夹具`)
  const src0 = read(mu.file)
  assert.ok(mu.re.test(src0), `变异夹具的锚点在 ${mu.file} 上不存在:${key}(锚点腐烂 = 夹具空转)`)
  const mutated = src0.replace(mu.re, mu.to)
  assert.notEqual(mutated, src0, `变异夹具没改动任何字节:${key}`)
  return { mutated, src0, mu }
}

function faces() {
  return {
    chrome: read(RUST_CHROME),
    rustLib: read(RUST_LIB),
    bridge: read(JS_BRIDGE),
    hook: read(JS_HOOK),
    provider: read(JS_PROVIDER),
  }
}

// ============================ 现状必须绿 ============================

test('现状:形状锁全绿(客户区基准 / 主题三层接线 / 判序 / 建窗初值 / 配色单出口 / 实测兜底 / 注入 JS 不碰 IPC)', () => {
  const f = faces()
  assert.deepEqual(
    J.judgeClientGeometry(f.chrome),
    [],
    '① 三钮定位基准必须是**客户区**,窗口/显示器基准都不得再在场',
  )
  assert.deepEqual(
    J.judgeClientNoFallback(f.chrome),
    [],
    '①b 取不到客户区必须"保持原位不判",不得回落窗口矩形',
  )
  assert.deepEqual(
    J.judgeThemeWiring(f),
    [],
    '②a 网页→原生的主题上报腿必须 JS 出口 / 挂载点 / 命令注册三面同批在场',
  )
  assert.deepEqual(
    J.judgePaletteSingleSource(f.chrome),
    [],
    '②d 配色只能有一个出口 = Palette::light()/dark() 成对两档',
  )
  assert.deepEqual(
    J.judgeTopbarProbe(f.chrome),
    [],
    '②e 实测兜底必须「上报 > 实测 > slot」,且判不准时不判',
  )
  assert.deepEqual(J.judgeInjectedJsNoIpc(f.chrome), [], '②f 注入远程页的 JS 不得够得着原生 IPC')
  assert.deepEqual(
    J.judgeThemePrecedence(f.chrome),
    [],
    '②b 页面加载深浅判序:壳自有页按 URL+清 reported,线上按上报值',
  )
  assert.deepEqual(
    J.judgeOverlaySeed(f.chrome),
    [],
    '②c 建窗初值必须取 theme_slot(否则晚到的上报被默认档冲掉)',
  )
})

// ============================ 每条判据的阳性对照 ============================

for (const mu of MUTANTS) {
  test(`阳性对照 ${mu.key}:退回旧写法必须被点名(${mu.expect})`, () => {
    const { mutated, mu: m } = applyMutant(mu.key)
    const f = faces()
    const findings = mu.judge(f, mutated)
    assert.ok(
      findings.length > 0,
      `变异夹具 ${mu.key} 没被任何判据点名 ⇒ 判据是空的(现状绿不代表拦得住回潮)`,
    )
    assert.ok(
      findings.some((x) => x.includes(m.expect)) || findings.join('|').includes(mu.expect),
      `判据响应了,但没点名到 ${mu.expect}(报的是别的事):${findings.join(' / ')}`,
    )
  })
}

test('判据失效方向必须是「未判定」,不是"返回空数组冒绿"(§0.3)', () => {
  const empty = 'pub fn unrelated() {} struct S;\n'
  const facesEmpty = { chrome: empty, rustLib: empty, bridge: empty, hook: empty, provider: empty }
  const cases = [
    ['judgeClientGeometry', J.judgeClientGeometry(empty)],
    ['judgeClientNoFallback', J.judgeClientNoFallback(empty)],
    ['judgeThemePrecedence', J.judgeThemePrecedence(empty)],
    ['judgeOverlaySeed', J.judgeOverlaySeed(empty)],
    ['judgePaletteSingleSource', J.judgePaletteSingleSource(empty)],
    ['judgeTopbarProbe', J.judgeTopbarProbe(empty)],
    ['judgeInjectedJsNoIpc', J.judgeInjectedJsNoIpc(empty)],
    ['judgeThemeWiring', J.judgeThemeWiring(facesEmpty)],
  ]
  for (const [name, findings] of cases) {
    assert.ok(findings.length > 0, `${name} 取不到输入却返回空数组 = 把"没判"读成"判过了"`)
    assert.ok(
      findings[0].includes('未判定') || findings.some((x) => x.includes('未判定')),
      `${name} 的失效方向必须是「未判定」并点名原因,不能冒红也不能冒绿:${findings.join(' / ')}`,
    )
  }
})

const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  console.log('[desktop-caption-chrome] 判据层与变异夹具就绪(用 node --test 跑本文件)')
}

export const __test__ = { judges: J, MUTANTS, faces, fnBody, stripLineComments }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
