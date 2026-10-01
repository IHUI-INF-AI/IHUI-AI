// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent-event-coverage.mjs — D139(承 V4 #97)步 2/3:对话流事件 parity 门的
 * 多端消费面取材 + 端能力档案判据(与门脚本 check-agent-event-parity.mjs 分离)。
 *
 * 职责边界(门与档案分离):
 *   - 本层只回答三件事:① 各端消费面取材(默认 HEAD 面,病窗自愈兜底);
 *     ② 档案表(config/agent-event-end-capability.json)装载;
 *     ③ 纯函数判据 judgeEndCoverage —— 给定(后端事件集, 各端消费集, 档案, 今日)判红绿。
 *   - 后端事件怎么扫、报错怎么汇总,是门的事;本层不重复。
 *
 * 判据口径(D139 步 2/3 收口,取代第一轮"只点名不判红"):
 *   每端档案 = { events(该端声明已接的回调集合), knownGaps(已知缺口:reason+until+events) }。
 *   后端生产事件 e、该端未消费时:
 *     - e ∈ knownGaps.events  ⇒ 放行(登记的已知缺口;棘轮基线 = 各端 HEAD 自身存量,
 *       绝不造恒红门 —— RN 只接 7/30 这类存量按档案登记,门对已登记缺口不红);
 *     - e ∈ events            ⇒ 红("声明已接却测不到消费" —— 摘掉监听必红,这就是牙);
 *     - 都不在                ⇒ 红(档案外缺口必须报名,不得静默);
 *   - 端无档案条目 ⇒ 红(留空档案等于默认放行,那正是本票要防的静默);
 *   - until 过期   ⇒ 红(未过期 until 是档案的生效条件,到期要续或删);
 *   - 取材失败     ⇒ 未判定(不冒红也绝不记绿,face-reader 同口径)。
 *
 * 消费判定 = 提及口径:剥注释后的源码字符串里出现该事件名,或以
 * AGENT_TASK_EVENTS.<常量> 形态出现(常量经单源 agent-events.ts 解析回 wire 名)。
 * 它宽于真监听 —— 宽着登记只会让 knownGaps 偏小、牙更尖,不会造出假缺口。
 *
 * 取材面(守门 118 同口径):默认 **HEAD blob**;`--worktree` 是人工逃生舱
 * (验收"摘掉一个回调必须红"只能在磁盘面演示 —— 摘工作区文件对 HEAD 面不可见)。
 *
 * 病窗兜底(2026-09-30 实证):本会话 Node 给子进程创建 stdin 管道必 EBUSY,
 * `cat-file --batch`(请求靠 stdin 喂)全灭。兜底链(2026-10-02 收编,原中段
 * "本文件自带临时 fd 批"已进层,判据同源、自拼出口删除):
 *   catBatch(层内已带临时文件 fd 兜底,9dcaf345b1)→ 逐文件 `cat-file blob`
 *   (无 stdin,gitRaw 的 input===undefined 那一支)。
 *   两条通道读的是同一批 HEAD blob,取材语义零漂移;喂内容一律走临时文件,
 *   不经 input/--stdin(D139 红线 4)。
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { catBatch, gitRaw, Undetermined } from './face-reader.mjs';

/** 端目录表:七端(第一轮六端 + apps/web/src —— 摘掉 web 一个回调也必须红)。 */
export const END_CAPABILITY_DIRS = {
  'apps/web/src': 'Web',
  'apps/miniapp-taro/src': '小程序',
  'apps/mobile-rn/src': 'App(RN)',
  'packages/app/src': '共享屏层',
  'apps/extension': '浏览器扩展',
  'apps/desktop': '桌面端',
  'apps/cli/src': 'CLI',
};

/** 端能力档案表路径(仓库相对)。 */
export const PROFILE_REL = 'config/agent-event-end-capability.json';

/** t4 单源常量文件(AGENT_TASK_EVENTS 常量 → wire 事件名,消费扫描解析用)。 */
const AGENT_EVENTS_REL = 'packages/shared/src/sse/agent-events.ts';

const firstLine = (e) => String(e?.message ?? e).split('\n')[0];

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 剥 TS 注释(块注释置空白保换行 + 纯行注释行清空),防注释示例误报。与门内同语义。 */
export function stripTsComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => (l.trim().startsWith('//') ? '' : l))
    .join('\n');
}


/**
 * 按面读一批文件文本。face='head' 走两条兜底链(语义同为 HEAD blob);
 * face='worktree' 读磁盘(人工逃生舱:盘上可能是并行会话的半编辑态,只作验收演示)。
 * 返回 Map<rev, string|null>,null = 该面取不到(调用方跳过,不算消费)。
 */
export function readFaceTexts(root, revs, { face = 'head', paths = null } = {}) {
  if (face === 'worktree') {
    const out = new Map();
    revs.forEach((rev, i) => {
      const rel = paths?.[i] ?? rev.replace(/^HEAD:/, '');
      const abs = path.join(root, rel);
      try {
        out.set(rev, existsSync(abs) ? readFileSync(abs, 'utf8') : null);
      } catch (e) {
        throw new Undetermined(`工作树面取不到 ${rel}: ${firstLine(e)}`);
      }
    });
    return out;
  }
  // face = 'head':catBatch(层内已带 EBUSY 临时文件 fd 兜底,2026-10-01 9dcaf345b1)→ 逐文件。
  // 两链读同一批 HEAD blob;原中段"本文件自带临时 fd 批"已收编进层(判据同源,自拼出口删除,
  // face-reader.test 的 selfBatch 棘轮因此从 1 归 0)。喂内容一律走临时文件,不经 input/--stdin(D139 红线 4)。
  try {
    return catBatch(root, revs, { maxBuffer: 512e6 });
  } catch (batchErr) {
    try {
      const out = new Map();
      for (const rev of revs) {
        try {
          out.set(rev, gitRaw(['cat-file', 'blob', rev], root));
        } catch {
          out.set(rev, null); // 单个取不到 ≠ 整门失明;由调用方对 null 记"未消费"
        }
      }
      return out;
    } catch (e) {
      throw new Undetermined(`HEAD 面两条兜底链全失败: batch=${firstLine(batchErr)}; perfile=${firstLine(e)}`);
    }
  }
}

/** AGENT_TASK_EVENTS 常量名 → wire 事件名(从 t4 单源提取,消费扫描解析回 wire 名用)。 */
export function extractAgentTaskConstants(root, face = 'head') {
  const out = new Map();
  let text;
  try {
    const rev = `HEAD:${AGENT_EVENTS_REL}`;
    const texts = readFaceTexts(root, [rev], { face, paths: [AGENT_EVENTS_REL] });
    text = texts.get(rev);
  } catch {
    return out; // 单源取不到:门 1j 另有显式红,这里只降级(常量形态匹配不到而已)
  }
  if (typeof text !== 'string' || text === '') return out;
  const start = text.indexOf('export const AGENT_TASK_EVENTS');
  if (start === -1) return out;
  const end = text.indexOf('} as const', start);
  const body = end === -1 ? text.slice(start, start + 3000) : text.slice(start, end);
  for (const m of body.matchAll(/([A-Z][A-Z_0-9]+):\s*'([a-z_-]+)'/g)) out.set(m[1], m[2]);
  return out;
}

/**
 * 七端消费面扫描(提及口径:字面事件名 ∪ AGENT_TASK_EVENTS 常量解析)。
 * 文件清单来自 HEAD ls-tree(两面共用同一份清单,worktree 面只换内容来源)。
 * 返回 Map<dir, {label, files, consumed:Set, error?}>;取材失败的端带 error,
 * 由判据折成"未判定",不冒红也绝不记绿。
 */
export function scanEndConsumption(root, { backendNames, face = 'head' }) {
  if (!backendNames || backendNames.size === 0) {
    throw new Undetermined('backendNames 为空:消费扫描将空转,判据拒跑(防空转变绿)');
  }
  const nameAlt = [...backendNames].sort().map(escapeRe).join('|');
  const mentionRe = new RegExp(`["'\`](${nameAlt})["'\`]`, 'g');
  const constRe = /AGENT_TASK_EVENTS\.([A-Z][A-Z_0-9]*)/g;
  const constants = extractAgentTaskConstants(root, face);
  const out = new Map();
  for (const [dir, label] of Object.entries(END_CAPABILITY_DIRS)) {
    let files = [];
    try {
      files = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', dir], root)
        .split('\n')
        .map((s) => s.trim())
        .filter((f) => f && /\.(ts|tsx|js|jsx|mjs)$/.test(f));
    } catch (e) {
      out.set(dir, { label, files: 0, consumed: new Set(), error: firstLine(e) });
      continue;
    }
    let texts;
    try {
      texts = readFaceTexts(root, files.map((f) => `HEAD:${f}`), { face, paths: files });
    } catch (e) {
      out.set(dir, { label, files: files.length, consumed: new Set(), error: firstLine(e) });
      continue;
    }
    const consumed = new Set();
    for (const t of texts.values()) {
      if (typeof t !== 'string' || t === '') continue; // 该面取不到/被删:不计消费,由判据对账
      const s = stripTsComments(t);
      for (const m of s.matchAll(mentionRe)) consumed.add(m[1]);
      for (const m of s.matchAll(constRe)) {
        const wire = constants.get(m[1]);
        if (wire) consumed.add(wire);
      }
    }
    out.set(dir, { label, files: files.length, consumed });
  }
  return out;
}

/**
 * 端能力档案装载。档案是**声明输入**,按"最近声明"判:工作树有且可解析 ⇒ 用工作树
 * (落地前的验收只能靠它;HEAD 版滞后会 note 出来,不静默);工作树取不到 ⇒ HEAD 兜底。
 * 双面都取不到 ⇒ profile:null(门必须显式红,不得当"无档案"放行)。
 * @returns {{profile:object|null, source:'worktree'|'head'|null, note:string|null}}
 */
export function loadEndProfile(root) {
  const out = { profile: null, source: null, note: null };
  let disk = null;
  try {
    disk = JSON.parse(readFileSync(path.join(root, PROFILE_REL), 'utf-8'));
  } catch {
    disk = null;
  }
  let head = null;
  try {
    head = JSON.parse(gitRaw(['show', `HEAD:${PROFILE_REL}`], root));
  } catch {
    head = null;
  }
  if (disk && disk !== null && typeof disk === 'object') {
    out.profile = disk;
    out.source = 'worktree';
    if (head && JSON.stringify(head) !== JSON.stringify(disk)) {
      out.note = '档案 HEAD 版与工作树版不一致(HEAD 版未提交或滞后),以工作树声明为准';
    } else if (!head) {
      out.note = '档案仅存在于工作树(HEAD 面还没有这份文件),落地后以 HEAD 为准';
    }
  } else if (head && typeof head === 'object') {
    out.profile = head;
    out.source = 'head';
  }
  return out;
}

/**
 * 端能力判据(**纯函数**,不碰 fs/git —— self-test 的构造正反例靠这一点可证)。
 * 返回逐端行 + 合计;红绿结论由行内 status 与各清单给出,报错文案由门统一写。
 */
export function judgeEndCoverage({ backendNames, consumption, profile, today }) {
  const backend = new Set(backendNames);
  const profiles = Array.isArray(profile?.profiles) ? profile.profiles : [];
  const perEnd = [];
  const totals = { registered: 0, unregistered: 0, declaredMissing: 0, stale: 0 };
  for (const [dir, info] of consumption) {
    const row = {
      dir,
      label: info.label,
      files: info.files,
      consumedCount: info.consumed.size,
      status: 'green',
      hasProfile: false,
      registered: 0,
      unregistered: [],
      declaredMissing: [],
      staleGaps: [],
      violations: [],
      error: info.error ?? null,
    };
    if (info.error) {
      row.status = 'undetermined';
      perEnd.push(row);
      continue;
    }
    const p =
      profiles.find(
        (x) => x && (x.app === dir || dir.startsWith(String(x.app ?? '').replace(/\/$/, '') + '/')),
      ) ?? null;
    row.hasProfile = !!p;
    const declared = new Set(p?.events ?? []);
    const gapCfg = p?.knownGaps ?? null;
    const gaps = new Set(gapCfg?.events ?? []);
    if (p) {
      if (!p.reason || !String(p.reason).trim()) row.violations.push('档案缺 reason —— 半个声明比没有更危险');
      if (typeof p.until !== 'string' || !p.until.trim()) row.violations.push('档案缺 until —— 无生效期限的声明不可核验');
      else if (p.until < today) row.violations.push(`档案 until(${p.until})已过期 —— 到期要续或删,不得静默续命`);
      if (!gapCfg) row.violations.push('档案缺 knownGaps —— 已知缺口不显式登记就是静默,必须给出(reason/until/events,可为空表)');
      else {
        if (!gapCfg.reason || !String(gapCfg.reason).trim()) row.violations.push('knownGaps 缺 reason');
        if (typeof gapCfg.until !== 'string' || !gapCfg.until.trim()) row.violations.push('knownGaps 缺 until');
        else if (gapCfg.until < today) row.violations.push(`knownGaps until(${gapCfg.until})已过期 —— 到期要续或删`);
      }
      for (const e of declared) {
        if (!backend.has(e)) row.violations.push(`声明已接的事件 "${e}" 不在后端生产面 —— 台账腐烂(拼写漂移或事件已回收)`);
      }
      for (const e of gaps) {
        if (!backend.has(e)) row.violations.push(`knownGaps 登记 "${e}" 不在后端生产面 —— 缺口已消失或拼写漂移,请移出档案`);
      }
    } else {
      row.violations.push('端无档案条目 —— 逐端声明是硬要求,留空档案等于默认放行');
    }
    for (const e of [...backend].sort()) {
      if (info.consumed.has(e)) {
        if (gaps.has(e)) row.staleGaps.push(e); // 缺口已收口:提示清台账,不判红
        continue;
      }
      if (gaps.has(e)) {
        row.registered++;
        continue;
      }
      if (declared.has(e)) {
        row.declaredMissing.push(e);
        continue;
      }
      row.unregistered.push(e);
    }
    totals.registered += row.registered;
    totals.declaredMissing += row.declaredMissing.length;
    totals.unregistered += row.unregistered.length;
    totals.stale += row.staleGaps.length;
    row.status =
      row.violations.length || row.unregistered.length || row.declaredMissing.length ? 'red' : 'green';
    perEnd.push(row);
  }
  return { perEnd, totals };
}
