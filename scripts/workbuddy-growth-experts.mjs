// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 成长任务「专家体验」项的真客户端驱动器(2026-11-05 立)。
 *
 * ## 它做什么
 *
 * 把运行中的 WorkBuddy 桌面端当"真行为发生器":打开专家页 → 按 **expertId** 定位
 * 目标专家 → 召唤 → 发一条真消息 → 确认消息在页面回显 → 断开 inspector。
 * 随后**回读成长任务列表**,只有业务态(`progress`/`accept_status`)真的前进了才算成。
 *
 * ## 为什么必须真客户端(不是发报文)
 *
 * 2026-11-05 报文级实证:合成遥测(`/v2/report`)16 次全部 HTTP 200 `code:0`,而成长任务
 * `progress`/`accept_status` 逐字段零变化;同一账号用真客户端召唤+对话后任务立刻
 * `accepted → completed`。⇒ **受理 ≠ 计分,计分只认真实行为链**(§0.3)。
 *
 * ## 对象判据:按 expertId,不按名字
 *
 * 专家市场里同名/近名专家极多(实测搜"中国电商运营专家"出 2 个精确候选 + 多个近似名),
 * 且 192 号召唤后对话页头部显示的是**定制版名**(「全平台电商运营操盘手」)而非任务名
 * (「中国电商运营专家」)。按名字判会误伤别的会话。
 * 权威判据 = 召唤按钮的 `data-track-props` 里的 `source` 字段(= expertId),
 * 实测 `{"scene":"ecommerce-operations","source":"ex_Weo3x2EZuSDm","version":"1.6.0"}`。
 *
 * ## 严格三要素(发消息的前置条件,全中才发)
 *
 *   ① 页面出现**目标专家名**(召唤后确认);② 有可编辑输入框;③ 消息文本**回显在页面上**。
 * 任一不满足 ⇒ **绝不发消息**(宁可少做一项,不做错对象)。
 *
 * ## 纪律
 *
 * · 用完**必须**断开 inspector:不断 ⇒ 主进程被调试通道占住 ⇒ `taskkill` 不带 /F 失败
 *   ⇒ 客户端关不掉、切不了号(实测 2026-11-05)。
 * · 只读回执不算数:计分判据 = 回读任务列表确认业务态前进。
 * · 凭据只在进程内流动;输出只报身份/键名/长度,绝不回显 token。
 *
 * ## 用法
 *
 *   node scripts/workbuddy-growth-experts.mjs --list
 *   node scripts/workbuddy-growth-experts.mjs --do ex_GDl31WahyIH0
 *   node scripts/workbuddy-growth-experts.mjs --do ex_GDl31WahyIH0 --message "..."
 *
 * 退出码:0 成功(业务态已前进) / 1 失败 / 2 未判定(环境·输入·对象不唯一·客户端没在跑)。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  attachClient,
  detachClient,
  findClientMain,
  readBodyText,
  winEval,
  sleep,
} from './lib/workbuddy-client-drive.mjs'
import { buildExpertIndex, isLocalNameOf } from './lib/workbuddy-expert-index.mjs'
import { isDirectRun as isDirectRunGuard } from './lib/direct-run.mjs'

/** 成长任务列表端点(WEB 域 = 18 项成长任务,含全部专家体验项) */
const TASKS_URL = 'https://www.workbuddy.cn/v2/activity/growth/tasks'
/** 号池明文备份目录(switch 自己解密后的缓存副本;含真 access/refresh) */
const POOL_DIR = path.join(os.homedir(), '.wb-switch', 'backups')

/** 专家体验类任务的 task_code 前缀(实测 4 项:maidehao/douyinyin/shangjia_xuanchuan/bowangwang) */
const EXPERT_TASK_PREFIX = 'expert_use_'

/**
 * 从 `jump_url` 里解出 expertId。
 * 形如 `https://www.workbuddy.cn/work/launch/?deeplink=workbuddy%3A%2F%2Fexperts%3FexpertId%3Dex_XXX&...`
 * ⇒ 解码 deeplink ⇒ 取 `expertId=` 参数。取不到 ⇒ ''(未判定,不猜)。
 */
export function parseExpertIdFromJumpUrl(jumpUrl) {
  const raw = String(jumpUrl ?? '')
  if (!raw) return ''
  const idx = raw.indexOf('deeplink=')
  if (idx < 0) return ''
  const decoded = decodeURIComponent(raw.slice(idx + 'deeplink='.length))
  const m = decoded.match(/[?&]expertId=([^&]+)/)
  return m ? m[1] : ''
}

/**
 * 从 task_desc 里解出专家显示名。
 * 形如「在专家页搜索并召唤「中国电商运营专家」，完成一次对话。」
 */
export function parseExpertNameFromDesc(taskDesc) {
  const m = String(taskDesc ?? '').match(/「([^」]+)」/)
  return m ? m[1] : ''
}

/** 任务是否已完成(终态 = claimed / completed,或 progress 达 target) */
export function isGrowthTaskDone(task) {
  if (!task || typeof task !== 'object') return false
  const status = String(task.accept_status ?? task.status ?? '')
    .trim()
    .toLowerCase()
  if (status === 'claimed' || status === 'completed') return true
  const p = task.progress ?? {}
  return (
    Number.isFinite(Number(p.current)) &&
    Number.isFinite(Number(p.target)) &&
    Number(p.current) >= Number(p.target)
  )
}

/**
 * 从成长任务列表里挑出"专家体验"项,并把每项解析成驱动目标。
 * 只认 task_code 前缀 + jump_url 里能解出 expertId 的项;解不出的**点名列出**,不静默丢弃。
 */
export function selectExpertTasks(tasks) {
  const rows = []
  const unresolved = []
  for (const t of Array.isArray(tasks) ? tasks : []) {
    const code = String(t?.task_code ?? '')
    if (!code.startsWith(EXPERT_TASK_PREFIX)) continue
    const expertId = parseExpertIdFromJumpUrl(t?.jump_url)
    const expertName =
      parseExpertNameFromDesc(t?.task_desc) || String(t?.title ?? '').replace(/^体验「|」$/g, '')
    if (!expertId) {
      unresolved.push({
        task_code: code,
        title: String(t?.title ?? ''),
        reason: 'jump_url 里解不出 expertId',
      })
      continue
    }
    rows.push({
      task_code: code,
      title: String(t?.title ?? ''),
      expertId,
      expertName,
      accept_status: String(t?.accept_status ?? ''),
      progress: t?.progress ?? null,
      done: isGrowthTaskDone(t),
    })
  }
  return { rows, unresolved }
}

/** 读本机号池里某个 uid 的凭据(明文副本)。取不到 ⇒ null(未判定) */
export function readPoolCredential(uid) {
  try {
    const files = fs
      .readdirSync(POOL_DIR)
      .filter((f) => f.startsWith(`workbuddy-desktop.pool-${uid}`) && f.endsWith('.info'))
    if (!files.length) return null
    const tree = JSON.parse(fs.readFileSync(path.join(POOL_DIR, files[0]), 'utf8'))
    const auth = tree?.auth ?? {}
    const account = tree?.account ?? {}
    if (!auth.accessToken) return null
    return {
      uid: String(account.uid ?? uid),
      nickname: String(account.nickname ?? ''),
      accessToken: String(auth.accessToken),
      refreshToken: String(auth.refreshToken ?? ''),
      domain: String(auth.domain ?? 'copilot.tencent.com'),
    }
  } catch {
    return null
  }
}

/** 列号池里所有可用账号(明文副本里的) */
export function listPoolAccounts() {
  try {
    return fs
      .readdirSync(POOL_DIR)
      .filter((f) => f.startsWith('workbuddy-desktop.pool-') && f.endsWith('.info'))
      .map((f) => {
        try {
          const tree = JSON.parse(fs.readFileSync(path.join(POOL_DIR, f), 'utf8'))
          const account = tree?.account ?? {}
          return {
            uid: String(account.uid ?? ''),
            nickname: String(account.nickname ?? ''),
            phone: String(account.phoneNumber ?? ''),
          }
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

/** 读成长任务列表(只读)。返回 {ok, tasks, reason} */
export async function fetchGrowthTasks(cred) {
  if (!cred?.accessToken || !cred?.uid) return { ok: false, tasks: [], reason: '缺凭据(未判定)' }
  try {
    const r = await fetch(TASKS_URL, {
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        'Content-Type': 'application/json',
        'X-User-Id': cred.uid,
        'x-user-id': cred.uid,
        'X-Domain': cred.domain,
      },
    })
    const j = await r.json()
    const data = j?.data ?? {}
    const arr = Array.isArray(data) ? data : (data.tasks ?? data.list ?? data.items ?? [])
    if (!Array.isArray(arr))
      return { ok: false, tasks: [], reason: `响应形状无法判定(code=${j?.code})` }
    return { ok: true, tasks: arr, code: j?.code }
  } catch (e) {
    return {
      ok: false,
      tasks: [],
      reason: `请求失败:${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

/**
 * 在专家页里定位目标专家的召唤按钮。
 *
 * ## 判据链(三级,逐级放宽,但每级都是**可核验**的)
 *
 * ① **本地专家名 == 卡片 source**:市场ID → 本地专家名的映射来自本机会话落盘库的
 *    `marketExpertId` 权威对照(`lib/workbuddy-expert-index.mjs`)。实测:
 *    `ex_GDl31WahyIH0` ⇄ `ChinaEcommerceOperationsExpert`、`ex_FbY5nlWTqDod` ⇄ `DouyinStrategist`、
 *    `ex_WZY136wV5aMt` ⇄ `LivestreamEcommerceCoach`、`ex_Weo3x2EZuSDm` ⇄ 自身(本地即市场)。
 * ② **卡片 source == 市场ID 本身**(少数专家本地即市场)。
 * ③ **卡片标题精确等于任务里的专家名**(前两条都不中时的兜底;一字不差才认)。
 *
 * ## 为什么必须"同卡片"绑定
 *
 * 实测 2026-11-05:同一张卡上,标题与 aria-label 可以完全不是一回事 —— 标题
 * 「全平台电商运营操盘手」的卡,aria-label 却是「召唤中国电商运营专家」;
 * 另有卡的 aria-label 是「召唤卖得好」而标题正是「中国电商运营专家」。
 * ⇒ **按 aria-label / 名字挑必然挑错**,只有"卡片内的 source"才与该专家绑定。
 */
export async function locateExpertEntry(
  target,
  marketExpertId,
  expertName,
  { winIndex = 0, index } = {},
) {
  const localName = index ? (index[marketExpertId]?.expertName ?? '') : ''
  const res = await winEval(
    target,
    winIndex,
    `(() => {
      const eid=${JSON.stringify(marketExpertId)}, local=${JSON.stringify(localName)}, want=${JSON.stringify(expertName)}
      const srcOf=(el)=>{ const p=el.getAttribute&&el.getAttribute('data-track-props'); if(!p) return ''
        try{ return JSON.parse(p).source||'' }catch(e){ return '' } }
      const rows=[]
      const seen=new Set()
      for(const card of document.querySelectorAll('article')){
        const btn=card.querySelector('button[data-track-props]')
        if(!btn) continue
        const src=srcOf(btn)
        if(!src) continue
        // 卡片标题 = _role_ 里的专家名(第一行);取不到就退回所有短文本
        const role=card.querySelector('div[class*="_role_"]')
        let title=((role||{}).innerText||'').trim()
        if(!title){
          const cands=[...card.querySelectorAll('*')].filter((e)=>e.children.length===0&&(e.innerText||'').trim()&&(e.innerText||'').trim().length<26).map((e)=>(e.innerText||'').trim())
          title=cands[0]||''
        }
        const key=src+'|'+title
        if(seen.has(key)) continue
        seen.add(key)
        rows.push({source:src, 标题:title.slice(0,28), aria:(btn.getAttribute('aria-label')||'').slice(0,28), btnClass:String(btn.className||'').slice(0,34)})
      }
      const byLocal=local? rows.find((r)=>r.source===local):null
      if(byLocal) return JSON.stringify({ok:true, via:'本地专家名', 行:byLocal, 全部:rows.slice(0,10)})
      const byId=rows.find((r)=>r.source===eid)
      if(byId) return JSON.stringify({ok:true, via:'市场ID', 行:byId, 全部:rows.slice(0,10)})
      const byTitle=rows.find((r)=>r.标题===want)
      if(byTitle) return JSON.stringify({ok:true, via:'标题精确', 行:byTitle, 全部:rows.slice(0,10)})
      return JSON.stringify({ok:false, reason:'专家页里找不到该专家(本地名/市场ID/标题三条都不中)', 全部:rows.slice(0,12)})
    })()`,
  )
  const raw = res?.v ?? res
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return { ok: false, reason: '定位结果解析失败', raw: String(raw).slice(0, 200) }
  }
}

/**
 * 发一条消息并确认回显。
 *
 * ## 手法(实测 2026-11-05,三种手法对比)
 *
 *   A) `execCommand('insertText')` + Enter ⇒ **发不出去**(草稿还在,React 状态没同步);
 *   B) 逐字派发 `beforeinput`/`input`/`keydown` + Enter ⇒ **发得出去**(推荐);
 *   C) 原生 `textContent` setter + `input` 事件 + Enter ⇒ **发得出去**(备胎)。
 * A 失败的原因:编辑器是 React 受控组件,`execCommand` 只改了 DOM 没改 React 状态。
 *
 * ## 回显判据
 *
 * 消息文本出现在页面正文 **且不在输入框草稿里** ⇒ 已上屏(= 已发出)。
 * 注意:风控期(11140)模型回复被拦,但**用户消息仍会上屏** ⇒ 判据必须落在用户消息气泡上,
 * 不能等助手回复(等不到)。
 */
export async function sendAndConfirmEcho(
  target,
  message,
  { winIndex = 0, attempts = 10, intervalMs = 1500 } = {},
) {
  const sent = await winEval(
    target,
    winIndex,
    `(() => {
      const el=document.querySelector('[contenteditable="true"]')
      if(!el) return {ok:false, reason:'no-input'}
      const txt=${JSON.stringify(message)}
      // 原生 setter(输入框未必是 div ⇒ 按实际原型取)
      const proto=Object.getPrototypeOf(el)
      const d=Object.getOwnPropertyDescriptor(proto,'textContent')||Object.getOwnPropertyDescriptor(HTMLDivElement.prototype,'textContent')
      const setText=(v)=>{ if(d&&d.set) d.set.call(el,v) }
      el.focus()
      // 手法 B:逐字派发输入事件(React 才能跟上)
      for(const ch of txt){
        el.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,data:ch,inputType:'insertText'}))
        setText((el.innerText||'')+ch)
        el.dispatchEvent(new InputEvent('input',{bubbles:true,data:ch,inputType:'insertText'}))
        el.dispatchEvent(new KeyboardEvent('keydown',{key:ch,bubbles:true,cancelable:true}))
      }
      const draft=(el.innerText||'')
      if(!draft.includes(txt.slice(0,6))){
        // 手法 C 兜底
        setText(txt)
        el.dispatchEvent(new InputEvent('input',{bubbles:true,data:txt,inputType:'insertText'}))
      }
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}))
      return {ok:true, 草稿:(el.innerText||'').slice(0,40)}
    })()`,
  )
  if (!sent?.v?.ok) return { ok: false, reason: `发消息失败:${sent?.v?.reason ?? '未知'}` }
  const key = String(message).slice(0, 8)
  for (let i = 0; i < attempts; i += 1) {
    await sleep(intervalMs)
    const check = await winEval(
      target,
      winIndex,
      `(() => {
        const key=${JSON.stringify(key)}
        const el=document.querySelector('[contenteditable="true"]')
        const draft=(el?.innerText||'')
        const body=(document.body?.innerText||'')
        return {onScreen: body.includes(key) && !draft.includes(key)}
      })()`,
    )
    if (check?.v?.onScreen) return { ok: true, attempts: i + 1 }
  }
  return { ok: false, reason: '消息未在页面回显' }
}

/**
 * 打开专家页(侧栏 → 专家 tab)。
 *
 * 必做的**复位**:上一次跑完可能停在对话页,此时专家面板没打开、入口元素不在 DOM 里
 * (实测 2026-11-05:第二次跑直接报"入口不存在")。故先点「新建任务」离开对话页,
 * 再开侧栏面板 ⇒ 每次进入的状态一致。
 */
export async function openExpertPage(target, winIndex = 0) {
  // ① 复位:点「新建任务」离开可能残留的对话页
  await winEval(
    target,
    winIndex,
    `(() => {
      const b=[...document.querySelectorAll('button')].find((e)=>(e.innerText||'').trim()==='新建任务')
      if(b) b.click()
      return 'ok'
    })()`,
  )
  await sleep(1200)
  // ② 开侧栏面板
  await winEval(
    target,
    winIndex,
    `(() => {
      const b=[...document.querySelectorAll('button')].find((e)=>(e.innerText||'').includes('专家·技能·连接器'))
      if(b) b.click()
      return 'ok'
    })()`,
  )
  await sleep(2500)
  // ③ 切到「专家」tab
  await winEval(
    target,
    winIndex,
    `(() => {
      const b=[...document.querySelectorAll('button')].find((e)=>(e.innerText||'').trim()==='专家')
      if(b) b.click()
      return 'ok'
    })()`,
  )
  await sleep(2500)
}

/**
 * 在专家页按**关键字**搜索,回车后等结果渲染。
 * 只搜市场区(「我的专家」区不受搜索影响)。
 *
 * 返回的每个候选都带 `source`(= expertId)与 `标题`(卡片上显示的专家名)——
 * 二者**可以不一致**(实测:标题「全平台电商运营操盘手」的卡,aria-label 却是「召唤中国电商运营专家」)。
 * 故定位一律按 `source`,不按标题/aria。
 */
export async function searchExperts(target, keyword, { winIndex = 0 } = {}) {
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
      await sleep(1300)
      box.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}))
      await sleep(3200)
      const srcOf=(el)=>{ const p=el.getAttribute&&el.getAttribute('data-track-props'); if(!p) return ''
        try{ return JSON.parse(p).source||'' }catch(e){ return '' } }
      const rows=[]
      for(const card of document.querySelectorAll('article')){
        const btn=card.querySelector('button[data-track-props]')
        if(!btn) continue
        const role=card.querySelector('div[class*="_role_"]')
        const title=((role||{}).innerText||'').trim()
        if(!title) continue
        rows.push({source:srcOf(btn), 标题:title.slice(0,26), aria:btn.getAttribute('aria-label')||''})
      }
      return JSON.stringify({ok:true, 候选:[...new Map(rows.map((r)=>[r.source+'|'+r.标题, r])).values()]})
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
 * 点召唤并**确认对话对象**。
 *
 * 点的对象 = 定位阶段绑定的那个按钮(同卡片的名字↔source 绑定),**不是**全页按 source 再找一遍
 * —— 同一 source 可能出现在多处,再找会点到别的卡片。
 *
 * 召唤后若还没进对话页(页面显示「点击上方按钮开始新任务」),兜底找开始按钮再点一次。
 * 确认不到 ⇒ {ok:false},调用方**绝不可**发消息。
 */
export async function summonAndConfirm(
  target,
  marketExpertId,
  expertName,
  { winIndex = 0, localName = '' } = {},
) {
  const res = await winEval(
    target,
    winIndex,
    `(async()=>{
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
      const eid=${JSON.stringify(marketExpertId)}, local=${JSON.stringify(localName)}, want=${JSON.stringify(expertName)}
      const srcOf=(el)=>{ const p=el.getAttribute&&el.getAttribute('data-track-props'); if(!p) return ''
        try{ return JSON.parse(p).source||'' }catch(e){ return '' } }
      // 同卡片绑定:标题 == 目标专家名 的卡片里,取 source 命中(本地名优先,再市场ID)的召唤按钮
      let btn=null, via=''
      for(const card of document.querySelectorAll('article')){
        const b=card.querySelector('button[data-track-props]')
        if(!b) continue
        const src=srcOf(b)
        const role=card.querySelector('div[class*="_role_"]')
        const title=((role||{}).innerText||'').trim()
        if(title!==want) continue
        if(local && src===local){ btn=b; via='本地专家名'; break }
        if(src===eid){ btn=b; via='市场ID'; break }
        if(!btn){ btn=b; via='标题精确' }
      }
      if(!btn) return JSON.stringify({ok:false, reason:'入口不存在(同卡片绑定没命中)'})
      btn.click()
      await sleep(4500)

      // 兜底:若停在「点击上方按钮开始新任务」,找提示上方的可点元素再点
      let extra=''
      if(!document.querySelector('[contenteditable="true"]')){
        const hint=[...document.querySelectorAll('*')].find((e)=>e.children.length===0&&/点击上方按钮开始新任务/.test(e.innerText||''))
        if(hint){
          const hr=hint.getBoundingClientRect()
          const cands=[...document.querySelectorAll('button,[role="button"]')].map((b)=>({b, r:b.getBoundingClientRect()}))
            .filter((x)=>x.r.width>0&&x.r.height>0&&x.r.top<=hr.top+4)
            .sort((a,b)=>b.r.top-a.r.top)
          for(const c of cands.slice(0,5)){
            c.b.click()
            await sleep(3500)
            if(document.querySelector('[contenteditable="true"]')){ extra='点了开始按钮'; break }
          }
        }
      }

      const body=document.body?.innerText||''
      const hasInput=!!document.querySelector('[contenteditable="true"]')
      const head=[...document.querySelectorAll('*')].filter((el)=>{
        const t=(el.innerText||'').trim()
        return el.children.length===0 && t && t.length<40 && /[一-龥]/.test(t) && /专家|策略师|设计师|教练|操盘手|家|员/.test(t)
      }).slice(0,6).map((el)=>(el.innerText||'').trim())
      return JSON.stringify({ok:hasInput, 有输入框:hasInput, 入口判据:via, 兜底:extra, 页面含目标名:body.includes(want), 头部名:head, 页面前段:body.replace(/\\n+/g,' | ').slice(0,180)})
    })()`,
  )
  const raw = res?.v ?? res
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return { ok: false, reason: '召唤结果解析失败', raw: String(raw).slice(0, 200) }
  }
}

/** 客户端当前登录的 uid(读落盘会话文件;判"我是谁"只认它,不信首屏快照) */
export function readSessionUid() {
  const authFile = path.join(
    os.homedir(),
    'AppData',
    'Local',
    'CodeBuddyExtension',
    'Data',
    'Public',
    'auth',
    'workbuddy-desktop.info',
  )
  try {
    const raw = JSON.parse(fs.readFileSync(authFile, 'utf8'))
    const uid = raw?.account?.uid
    if (typeof uid === 'string' && uid) return uid
    return ''
  } catch {
    return ''
  }
}

function parseArgs(argv) {
  const opts = { list: false, doId: '', doAll: false, message: '', help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--list') opts.list = true
    else if (a === '--do-all') opts.doAll = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a.startsWith('--do=')) opts.doId = a.slice(5)
    else if (a === '--do') opts.doId = String(argv[i + 1] ?? '')
    else if (a.startsWith('--message=')) opts.message = a.slice(10)
    else if (a === '--message') opts.message = String(argv[i + 1] ?? '')
  }
  return opts
}

const HELP = `用法:
  node scripts/workbuddy-growth-experts.mjs --list
      列出号池各账号的成长任务「专家体验」项及状态(只读)

  node scripts/workbuddy-growth-experts.mjs --do <expertId> [--message "文本"]
      按 expertId 驱动真客户端:打开专家页 → 搜索 → 召唤 → 发一条消息 → 回读任务列表确认计分

  node scripts/workbuddy-growth-experts.mjs --do-all [--message "文本"]
      一键跑完**当前登录号**所有未完成的专家体验项(逐项召唤+对话,逐项回读确认计分)
`

/**
 * 驱动一个专家体验项的完整链路(召唤 + 对话),返回 {ok, reason, log}。
 *
 * 链路:复位并打开专家页 → 按名字搜索 → **按 expertId**(data-track-props.source)精确挑召唤按钮
 *      → 召唤 → 确认进了对话页 → 发一条消息 → 确认消息回显。
 *
 * 定位两条腿(缺一不可):
 *   ① 搜索结果里 source == expertId 的卡(市场卡);
 *   ② 搜索不到时,全页翻找 source == expertId 的元素(专家可能只在「我的专家」区)。
 *   ⚠ **绝不按标题/aria-label 挑**:实测标题「全平台电商运营操盘手」的卡,aria-label 却是
 *      「召唤中国电商运营专家」,按名字挑会召唤到别的专家 ⇒ 污染别的会话。
 *
 * 严格三要素:① 对话页出现目标专家名;② 有可编辑输入框;③ 消息文本回显在页面上。
 * 任一不满足 ⇒ 失败,**绝不发消息**。
 */
async function driveOne(target, task, message, index) {
  const log = []
  const localName = index?.[task.expertId]?.expertName ?? ''
  await openExpertPage(target, 0)
  // 先按名字搜一次:让市场把相关卡片渲染出来(搜不到官方专家也不致命,定位器另有三条腿)
  const search = await searchExperts(target, task.expertName)
  const candidates = Array.isArray(search?.候选) ? search.候选 : []
  log.push({ step: 'search', ok: search?.ok === true, candidates: candidates.length })
  const located = await locateExpertEntry(target, task.expertId, task.expertName, { index })
  log.push({
    step: 'locate',
    ok: !!located?.ok,
    via: located?.via,
    row: located?.行,
    reason: located?.reason,
    本地专家名: localName,
  })
  if (!located?.ok) {
    return {
      ok: false,
      reason: `找不到专家入口(${located?.reason ?? '未判定'};搜索 source: ${candidates.map((c) => c.source).join(', ')})`,
      log,
    }
  }
  const summoned = await summonAndConfirm(target, task.expertId, task.expertName, { localName })
  log.push({ step: 'summon', ok: summoned?.ok === true, detail: summoned })
  if (!summoned?.ok) {
    return { ok: false, reason: `召唤后未进对话页(${summoned?.reason ?? '无输入框'})`, log }
  }
  const echoed = await sendAndConfirmEcho(target, message)
  log.push({ step: 'message', ok: echoed?.ok === true, detail: echoed })
  if (!echoed?.ok) return { ok: false, reason: echoed?.reason ?? '发消息失败', log }
  return { ok: true, log }
}

/**
 * 轮询等待计分落地。
 *
 * 计分是**异步**的:实测 2026-11-05,消息发出后立刻回读任务列表仍是 `accepted`,
 * 数十秒后才翻成 `completed` ⇒ 只读一次会把"已完成"误报成"未前进"。
 * 故这里按固定节拍轮询到终态或超时;超时 ⇒ 如实报"未前进(未判定)",不猜。
 */
export async function waitForScoreAdvance(cred, task, { attempts = 12, intervalMs = 5000 } = {}) {
  let last = null
  for (let i = 0; i < attempts; i += 1) {
    const after = await fetchGrowthTasks(cred)
    if (!after.ok) {
      return { ok: false, status: '', progress: null, reason: `回读任务列表失败:${after.reason}` }
    }
    const now = selectExpertTasks(after.tasks).rows.find((r) => r.task_code === task.task_code)
    if (!now)
      return { ok: false, status: '', progress: null, reason: '回读后任务不在列表里(未判定)' }
    last = now
    if (now.done && !task.done) {
      return { ok: true, status: now.accept_status, progress: now.progress, attempts: i + 1 }
    }
    if (i < attempts - 1) await sleep(intervalMs)
  }
  return {
    ok: false,
    status: last?.accept_status ?? '',
    progress: last?.progress ?? null,
    reason: `等待 ${attempts * Math.round(intervalMs / 1000)}s 仍未见计分前进`,
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(HELP)
    return 0
  }
  const accounts = listPoolAccounts()
  if (!accounts.length) {
    console.error('号池里没有可用账号副本(未判定)')
    return 2
  }

  if (opts.list) {
    for (const acc of accounts) {
      const cred = readPoolCredential(acc.uid)
      if (!cred) {
        console.log(`\n[${acc.uid.slice(0, 8)}] 取不到凭据(未判定)`)
        continue
      }
      const res = await fetchGrowthTasks(cred)
      if (!res.ok) {
        console.log(`\n[${acc.uid.slice(0, 8)}] 读任务失败:${res.reason}`)
        continue
      }
      const { rows, unresolved } = selectExpertTasks(res.tasks)
      console.log(`\n===== ${acc.uid.slice(0, 8)} ${acc.nickname} 任务数=${res.tasks.length} =====`)
      for (const r of rows) {
        console.log(
          `  ${r.task_code.padEnd(30)} ${r.accept_status.padEnd(10)} ${r.expertId.padEnd(18)} ${r.expertName}${r.done ? '  [已完成]' : ''}`,
        )
      }
      for (const u of unresolved) console.log(`  ⚠ ${u.task_code} ${u.title} —— ${u.reason}`)
    }
    return 0
  }

  if (!opts.doId && !opts.doAll) {
    console.error(HELP)
    return 2
  }

  const sessionUid = readSessionUid()
  const cred = readPoolCredential(sessionUid.slice(0, 8))
  if (!cred) {
    console.error(`取不到当前登录号(${sessionUid.slice(0, 8)})的凭据(未判定)`)
    return 2
  }
  const before = await fetchGrowthTasks(cred)
  if (!before.ok) {
    console.error(`读成长任务失败:${before.reason}`)
    return 2
  }
  const { rows } = selectExpertTasks(before.tasks)
  const targets = opts.doAll
    ? rows.filter((r) => !r.done)
    : rows.filter((r) => r.expertId === opts.doId)
  if (!targets.length) {
    console.error(
      opts.doAll ? '当前号没有未完成的专家体验项' : `任务列表里没有 expertId=${opts.doId}(未判定)`,
    )
    return 2
  }

  const main_ = findClientMain()
  if (!main_) {
    console.error('客户端没在跑(未判定)')
    return 2
  }
  console.log(`[驱动] pid=${main_.pid} 账号=${cred.uid.slice(0, 8)} 待做 ${targets.length} 项`)
  const target2 = await attachClient(main_.pid)
  const message = opts.message || `你好，请用一句话介绍你能帮我做什么。`
  const index = buildExpertIndex()
  const results = []
  try {
    for (const task of targets) {
      console.log(
        `\n──── ${task.task_code} ${task.expertName} (${task.expertId}) 现状=${task.accept_status} ────`,
      )
      let drive
      try {
        drive = await driveOne(target2, task, message, index)
      } catch (e) {
        drive = { ok: false, reason: `驱动异常:${e instanceof Error ? e.message : String(e)}` }
      }
      for (const l of drive.log ?? []) console.log(`  · ${JSON.stringify(l)}`)
      if (!drive.ok) {
        console.error(`  ❌ ${drive.reason}`)
        results.push({ ...task, ok: false, reason: drive.reason })
        continue
      }
      // 计分判据:回读任务列表,确认业务态真的前进了(受理回执不算数,§0.3)。
      // ⚠ 计分是**异步落地**的:实测 2026-11-05,消息发出后立刻回读仍是 accepted,
      // 数十秒后才变 completed ⇒ 必须轮询等待,不能只读一次就下结论。
      const advanced = await waitForScoreAdvance(cred, task)
      console.log(
        `  ${advanced.ok ? '✅' : '❌'} 计分 ${task.accept_status} → ${advanced.status ?? '?'} ${JSON.stringify(advanced.progress ?? null)}`,
      )
      results.push({
        ...task,
        ok: advanced.ok,
        status: advanced.status,
        reason: advanced.ok ? '' : advanced.reason,
      })
    }
  } finally {
    const det = await detachClient(target2)
    console.log(`\n[断开] ${JSON.stringify(det)}`)
  }

  const done = results.filter((r) => r.ok).length
  console.log(`\n[汇总] ${done}/${results.length} 项计分已前进`)
  for (const r of results)
    console.log(
      `  ${r.ok ? '✅' : '❌'} ${r.task_code} ${r.expertName} ${r.reason ?? r.status ?? ''}`,
    )
  return done === results.length ? 0 : 1
}

/**
 * 直接跑 ⇒ 执行;被 import(测试/复用)⇒ 不执行。
 * 判据 = 本文件是不是入口(`process.argv[1]` 指向本文件),实现见
 * `lib/direct-run.mjs`(单一真相源,§0.6;此处不得另抄一份)。
 * 被 import 时若照跑,测试进程会被 `process.exit` 直接掐掉 ⇒ 必须有这道守卫。
 *
 * 退出码用 `process.exitCode` 而非 `process.exit()`:
 * `process.exit()` 会在 pending 的 fetch/socket 上硬断,Node 退出时抛
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`(实测 2026-11-05),
 * 退出码被污染成 -1073740791 ⇒ CI 会把"正常退出"当成崩溃。
 * 故:设 exitCode 后正常返回,让事件循环自然收尾。
 */
const isDirectRun = isDirectRunGuard(import.meta.url, process.argv[1])

if (isDirectRun) {
  process.exitCode = await main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
