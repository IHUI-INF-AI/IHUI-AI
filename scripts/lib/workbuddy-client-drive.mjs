// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 成长任务「专家体验」项的真客户端驱动层(2026-11-05 立)。
 *
 * ## 为什么必须是"真客户端"
 *
 * 同一批账号的真机对照(2026-11-05,报文级):
 *   · 合成遥测(手工 POST `/v2/report`,4 事件码 × 2 域)共 16 次,全部 HTTP 200 `code:0`,
 *     而成长任务的 `progress`/`accept_status` **逐字段零变化** ⇒ 受理 ≠ 计分;
 *   · 同一账号用真客户端在专家页「召唤」专家并真实对话后,该成长任务
 *     `accepted → completed`(progress 1/1)⇒ **计分只认真实行为链**。
 * ⇒ 想做掉「体验某专家」这类任务,唯一有效路径是驱动真客户端,不是发报文。
 *
 * ## 本层只做"驱动原语",不判定计分
 *
 * 本层负责:attach 客户端 → 打开专家页 → 定位目标专家 → 召唤 → 发一条真消息 →
 * **确认对话对象确实是目标专家** → 断开 inspector。
 * 计分判定由上层重读成长任务列表的业务态字段(`progress`/`accept_status`)为准(§0.3
 * 「受理回执 ≠ 业务事实」):驱动成功不等于任务完成,必须回读确认。
 *
 * ## 严格三要素纪律(本轮血泪,写死在头注)
 *
 * 召唤按钮点得中 ≠ 进对了对话。上一轮曾因"点中了某个专家但不是目标专家"而往错误会话
 * 发消息,污染了两个无关会话。故本层的发消息前置条件是**三要素全中**:
 *   ① 页面上出现**目标专家名**;② 页面有可编辑输入框;③ 消息文本**回显在页面上**。
 * 任一不满足 ⇒ **绝不发消息**(宁可少做一项,不做错对象)。
 *
 * ## 必须断开 inspector(否则进程杀不掉)
 *
 * 给主进程挂上 Node Inspector 后,`taskkill` 不带 `/F` 会失败(进程被调试通道占住),
 * 连带客户端无法优雅关闭/重启(实测 2026-11-05:切号时 taskkill 连报三次失败)。
 * 故本层提供 `detachClient`,且 `driveExpert` 内部 try/finally 必调。
 *
 * ## 零新依赖
 *
 * 只用 Node 内置 fetch + WebSocket;主进程定位复用仓内 `lib/workbuddy-auth-extract.mjs`
 * 的 `listWorkbuddyMainProcesses`(单一真相源,§0.6)。
 */
import { listWorkbuddyMainProcesses } from './workbuddy-auth-extract.mjs'

const INSPECTOR_PORT = 9229
const INSPECTOR_BASE = `http://127.0.0.1:${INSPECTOR_PORT}`

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 客户端主进程在跑吗(取唯一带 user-data-dir 的那个) */
export function findClientMain() {
  const mains = listWorkbuddyMainProcesses()
  return mains.length ? mains[0] : null
}

/** CDP 求值(主进程 inspector 通道) */
export async function cdpEval(target, expression, { timeoutMs = 60000 } = {}) {
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('调试 WebSocket 连接失败')), { once: true })
  })
  try {
    const reply = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('调试求值超时')), timeoutMs)
      ws.addEventListener(
        'message',
        (ev) => {
          const msg = JSON.parse(ev.data)
          if (msg.id === 1) {
            clearTimeout(timer)
            resolve(msg)
          }
        },
        { once: false },
      )
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true, awaitPromise: true },
        }),
      )
    })
    if (reply.error) throw new Error(`CDP 错误: ${reply.error.message}`)
    const r = reply.result
    if (r?.exceptionDetails) {
      throw new Error(
        `调试求值异常: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`,
      )
    }
    return r?.result?.value
  } finally {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }
}

/** 主进程求值(可 await Promise) */
export async function mainEval(target, expr) {
  const prelude = `const r=(typeof require==='function')?require:(process.mainModule&&process.mainModule.require);`
  return cdpEval(target, `(async()=>{ ${prelude} return (${expr}) })()`)
}

/**
 * 渲染进程求值:经主进程 BrowserWindow.webContents.executeJavaScript。
 * 返回 {ok, v} / {err} —— 渲染侧异常不炸主进程,由调用方判。
 */
export async function winEval(target, winIndex, expr) {
  const wrapped = `(async()=>{ const r=(typeof require==='function')?require:(process.mainModule&&process.mainModule.require); const wins=r('electron').BrowserWindow.getAllWindows(); const w=wins[${winIndex}]; if(!w) return JSON.stringify({err:'no window'}); try { const v = await w.webContents.executeJavaScript(${JSON.stringify(expr)}); return JSON.stringify({ok:true, v}); } catch(e) { return JSON.stringify({err:String(e && e.message || e)}); } })()`
  const raw = await cdpEval(target, wrapped)
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/**
 * 给运行中的主进程开 inspector 并连上。
 * 校验连到的是目标 pid,防 9229 端口被别人占(§0.3:连错对象比连不上更危险)。
 */
export async function attachClient(pid) {
  process._debugProcess(pid)
  const deadline = Date.now() + 8000
  let target = null
  while (Date.now() < deadline && !target) {
    try {
      const res = await fetch(`${INSPECTOR_BASE}/json/list`)
      if (res.ok) {
        const list = await res.json()
        target = list.find((t) => t.webSocketDebuggerUrl) ?? null
      }
    } catch {
      /* inspector 还没挂上,继续等 */
    }
    if (!target) await sleep(150)
  }
  if (!target)
    throw new Error(`无法连接 WorkBuddy 调试端口 ${INSPECTOR_PORT}(客户端没在跑或主进程已退出)`)
  const actual = await cdpEval(target, 'process.pid')
  if (String(actual) !== String(pid)) {
    throw new Error(`调试端口被别的进程占用(实际 pid=${actual},期望 ${pid})`)
  }
  return target
}

/**
 * 断开 inspector(必须做!).
 * 不断 ⇒ 主进程被调试通道占住 ⇒ `taskkill` 不带 /F 会失败 ⇒ 客户端关不掉/切不了号。
 * 判据不取"求值有没有回包":`_debugEnd()` 一执行,调试通道当场关闭 ⇒ 回包永远不来 ⇒
 * 等回包必然超时(实测 2026-11-05:朴素实现恒报"断开失败",而通道其实早就断了)。
 * 正解 = **轮询 9229 端点是否真的不再应答** ⇒ 以"端口是否关闭"为唯一判据。
 * 本函数**永不抛错**:断不开只如实回报 ok:false(调用方据此决定要不要强杀)。
 */
export async function detachClient(target, { timeoutMs = 1500, pollMs = 150 } = {}) {
  try {
    // 不等回包:发出去即返回(通道会当场关闭,回包必然超时)
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', () => reject(new Error('调试 WebSocket 连接失败')), {
        once: true,
      })
    })
    ws.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: 'process._debugEnd()' },
      }),
    )
    await sleep(200)
    try {
      ws.close()
    } catch {
      /* 已关闭 */
    }
  } catch {
    /* 通道可能已被主进程关闭,继续走端口探测 */
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${INSPECTOR_BASE}/json/list`)
      if (!res.ok) return { ok: true, by: 'port-closed' }
    } catch {
      return { ok: true, by: 'port-unreachable' }
    }
    await sleep(pollMs)
  }
  return { ok: false, reason: `调试端口 ${INSPECTOR_PORT} 在 ${timeoutMs}ms 内仍在应答(未断开)` }
}

/** 渲染进程快照:当前账号昵称/uid(取自启动 URL 的 accountSnapshot;未登录时为空) */
export async function readClientIdentity(target, winIndex = 0) {
  const hrefRes = await winEval(target, winIndex, 'location.href')
  const href = String(hrefRes?.v ?? '')
  const enc = href.includes('accountSnapshot=')
    ? href.split('accountSnapshot=')[1].split('&')[0]
    : ''
  if (!enc) return { nickname: '', uid: '' }
  try {
    const snap = JSON.parse(decodeURIComponent(decodeURIComponent(enc)))
    return { nickname: String(snap.nickname ?? ''), uid: String(snap.uid ?? '') }
  } catch {
    return { nickname: '', uid: '' }
  }
}

/** 页面正文(压成单行,便于包含判断) */
export async function readBodyText(target, winIndex = 0) {
  const r = await winEval(
    target,
    winIndex,
    `(()=>(document.body?.innerText||'').replace(/\\n+/g,' | '))()`,
  )
  return String(r?.v ?? '')
}

/**
 * 切到「专家·技能·连接器」面板的专家 tab。
 * 实测次序:先点侧栏「专家·技能·连接器」⇒ 等面板展开 ⇒ 再点面板内「专家」tab。
 */
export async function openExpertCenter(target, winIndex = 0) {
  await winEval(
    target,
    winIndex,
    `(() => {
      const b=[...document.querySelectorAll('button')].find((e)=>(e.innerText||'').includes('专家·技能·连接器'))
      if(b) b.click()
      return 'ok'
    })()`,
  )
  await sleep(2200)
  await winEval(
    target,
    winIndex,
    `(() => {
      const b=[...document.querySelectorAll('button')].find((e)=>(e.innerText||'').trim()==='专家')
      if(b) b.click()
      return 'ok'
    })()`,
  )
  await sleep(1800)
}

/**
 * 在专家页搜索框里搜关键字,回车后等结果渲染。
 * 搜的是**关键字**,不是完整专家名 —— 官方专家会被搜索过滤掉(实测搜「轻量云」列表里
 * 没有「腾讯轻量云专家」),所以搜完还要靠召唤按钮做二次定位。
 */
export async function searchExperts(target, keyword, winIndex = 0) {
  const res = await winEval(
    target,
    winIndex,
    `(async()=>{
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
      const q=${JSON.stringify(keyword)}
      const box=[...document.querySelectorAll('input')].find((i)=>i.type==='text'||!i.type)
      if(!box) return JSON.stringify({ok:false,reason:'无搜索框'})
      box.focus()
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
      setter.call(box,q); box.dispatchEvent(new InputEvent('input',{bubbles:true}))
      await sleep(1200)
      box.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}))
      await sleep(3000)
      const buttons=[...document.querySelectorAll('button[aria-label^="召唤"]')].map((b)=>b.getAttribute('aria-label'))
      return JSON.stringify({ok:true,结果按钮:[...new Set(buttons)]})
    })()`,
  )
  const raw = res?.v ?? res
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return { ok: false, reason: '搜索结果解析失败', raw: String(raw).slice(0, 200) }
  }
}

/**
 * 定位目标专家的召唤入口(纯函数产出脚本,便于单测断言脚本形态)。
 * 两类入口:
 *   ① 市场卡片:`button[aria-label="召唤{专家名}"]`;
 *   ② 「我的专家」区:专家名本身是按钮/文本(祖先里有召唤按钮)。
 */
export function locateExpertScript(expertName) {
  return `(() => {
    const name=${JSON.stringify(expertName)}
    const vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}
    const exact=document.querySelector('button[aria-label="召唤'+name+'"]')
    if(exact) return {found:true, via:'summon-aria'}
    const els=[...document.querySelectorAll('*')].filter((e)=>e.children.length===0 && (e.innerText||'').trim()===name)
    const el=els.find(vis) ?? els[0]
    if(!el) return {found:false}
    let n=el, btn=null
    for(let i=0;i<8 && n;i++,n=n.parentElement){
      const b=n.querySelector && n.querySelector('button[aria-label^="召唤"]')
      if(b){ btn=b; break }
    }
    return {found:true, via: btn ? 'summon-ancestor' : 'name-element', isButton: el.tagName==='BUTTON'}
  })()`
}

/**
 * 召唤目标专家并**确认对话对象**。
 * 判据(严格三要素之①):召唤后页面正文必须出现目标专家名 ⇒ 才算进对对话。
 * 确认失败 ⇒ 返回 {ok:false, reason},调用方**绝不可**发消息。
 */
export async function summonExpert(target, expertName, winIndex = 0) {
  const res = await winEval(
    target,
    winIndex,
    `(async()=>{
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
      const q=${JSON.stringify(expertName)}
      const cands=[...document.querySelectorAll('button[aria-label="召唤'+q+'"]')]
      if(!cands.length){
        const named=[...document.querySelectorAll('*')].filter((e)=>e.children.length===0&&(e.innerText||'').trim()===q)
        const el=named.find((e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0})
        if(el){ el.click(); await sleep(4000) }
        return JSON.stringify({ok:false,reason:'无精确召唤候选'})
      }
      for(let i=cands.length-1;i>=0;i--){
        cands[i].click()
        await sleep(4000)
        if((document.body?.innerText||'').includes(q)) return JSON.stringify({ok:true,via:'aria',index:i})
        const b=[...document.querySelectorAll('button')].find((x)=>/^(召唤|开始对话|免费对话|立即体验)$/.test((x.innerText||'').trim()))
        if(b){
          b.click(); await sleep(4000)
          if((document.body?.innerText||'').includes(q)) return JSON.stringify({ok:true,via:'overlay',index:i})
        }
      }
      return JSON.stringify({ok:false,reason:'全部候选都没进目标专家'})
    })()`,
  )
  const raw = res?.v ?? res
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return { ok: false, reason: '召唤结果解析失败', raw: String(raw).slice(0, 200) }
  }
}

/**
 * 在对话页输入并回车发送一条消息(React 受控 contenteditable:原生 setter + input + keydown)。
 * 只负责"发出";**发出后是否真在页面上**由 `waitForMessageEcho` 判。
 */
export async function sendMessage(target, message, winIndex = 0) {
  const res = await winEval(
    target,
    winIndex,
    `(() => {
      const el=document.querySelector('[contenteditable="true"]')
      if(!el) return {ok:false, reason:'no-input'}
      el.focus()
      const txt=${JSON.stringify(message)}
      let ok=false
      try { document.execCommand('insertText', false, txt); ok=(el.innerText||'').includes(txt.slice(0,6)) } catch(e){ ok=false }
      if(!ok){
        const setter=Object.getOwnPropertyDescriptor(window.HTMLDivElement.prototype,'textContent').set
        setter.call(el, txt)
        el.dispatchEvent(new InputEvent('input',{bubbles:true}))
      }
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}))
      return {ok:true, text:(el.innerText||'').slice(0,50)}
    })()`,
  )
  return res?.v ?? { ok: false, reason: 'no-input' }
}

/** 对话页是否就绪(有可编辑输入框) */
export async function isConversationReady(target, winIndex = 0) {
  const res = await winEval(
    target,
    winIndex,
    `(()=>!!document.querySelector('[contenteditable="true"]'))()`,
  )
  return res?.v === true
}

/**
 * 等消息文本回显在页面上(严格三要素之③)。
 * 回显才算"真发出去了";只调了发送动作但没回显 ⇒ 不算。
 */
export async function waitForMessageEcho(
  target,
  message,
  { winIndex = 0, attempts = 8, intervalMs = 1500 } = {},
) {
  const key = String(message).slice(0, 10)
  for (let i = 0; i < attempts; i += 1) {
    await sleep(intervalMs)
    if ((await readBodyText(target, winIndex)).includes(key)) return { ok: true, attempts: i + 1 }
  }
  return { ok: false, attempts }
}

/**
 * 端到端驱动一次"召唤某专家并与它对话"。
 *
 * 严格三要素全中才算成功:
 *   ① 页面出现目标专家名(召唤后确认);
 *   ② 对话页有可编辑输入框;
 *   ③ 消息文本回显在页面上。
 * 任一不满足 ⇒ 返回 {ok:false, reason},**不重试到别的专家**(绝不误伤别的会话)。
 *
 * 本函数负责**断开 inspector**(finally),否则主进程会被调试通道占住导致关不掉。
 */
export async function driveExpert(target, expertName, message, { winIndex = 0, keyword } = {}) {
  const log = []
  const detached = { ok: false }
  try {
    await openExpertCenter(target, winIndex)
    if (keyword) {
      const s = await searchExperts(target, keyword, winIndex)
      log.push({ step: 'search', ok: s?.ok === true, count: s?.结果按钮?.length ?? 0 })
    }
    const summoned = await summonExpert(target, expertName, winIndex)
    log.push({ step: 'summon', ok: summoned?.ok === true, via: summoned?.via })
    if (!summoned?.ok) return { ok: false, reason: summoned?.reason ?? '召唤失败', log }

    if (!(await isConversationReady(target, winIndex))) {
      return { ok: false, reason: '对话页无输入框(可能进了错误对象)', log }
    }
    const sent = await sendMessage(target, message, winIndex)
    if (!sent?.ok) return { ok: false, reason: `发消息失败:${sent?.reason ?? '未知'}`, log }
    const echo = await waitForMessageEcho(target, message, { winIndex })
    log.push({ step: 'echo', ok: echo.ok })
    if (!echo.ok) return { ok: false, reason: '消息未在页面回显', log }
    return { ok: true, log }
  } finally {
    detached.ok = (await detachClient(target)).ok
  }
}

export const __test__ = {
  locateExpertScript,
  findClientMain,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
