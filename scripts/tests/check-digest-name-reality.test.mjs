// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-digest-name-reality.mjs(守门 137,§22c 模式 —— 判据 import 源脚本,
 * **不在这里复制第二份**;判据本体的正反成对用例住在 `--self-test`(现测例数以该命令末行为准,
 * 本文不钉数字 —— 钉死的那份立刻变成假账)。本文件只管 self-test 结构上做不到的七件事,
 * 每条对应一次真实失效:
 *
 *  T1 装车证明(大括号配对取**本门那一条**注册项)—— 防"造好没装车"(守门 70/76/81/104/107 同型),
 *     并防门 136 镜像刚踩过的"取前后 N 字符跨进邻门:别人有 blocking 就算我有";
 *  T2 摘线不得被读成已装车 —— 未注册时判"未注册";同一构造面加上本门条目必须能找到(否则 T2 的
 *     null 是提取器空转的恒真);
 *  T3 预筛必须是判据关键字的**严格超集** + 名单正向证明 —— 预筛漏一个关键字,门对该形态整片
 *     失明而账面照报绿(守门 102 预筛超集对账同型;守门 120 的"名单不是死表");
 *  T4 阳性对照:喂**修复前**的两处真仓历史 blob(逐字 `git show 69a3d72f2:<path>`,立门会话即用
 *     此面得到"命中 2")—— 自编夹具只能证明实现自洽,证明不了门看得见本仓真实产出的形态
 *     (§22c G-182:"镜像测试若只复读实现,它就只是复读机");
 *  T5 反向锁:同一夹具换成真散列必须落放过 —— 判据若被改宽成"名字带 hash 就红",修好的代码
 *     仍红,那就是恒红门之始(§12e);
 *  T6 假阳性三型按名钉住(fingerprints / hashIdx / hashed→storedCandidates)—— 防下一个人把这
 *     三处误判成真缺陷去"修好代码"(sha256 一个 URL 片段位置是制造新缺陷);当时的处置是
 *     纯转传判未判定 / 带原因行内豁免 / **改名**,没有一条靠放宽判据;
 *  T7 取材面形状锁(源码级反向锁)—— 防守门 70 的"cwd 定根使夹具静默审真仓"与守门 118 的
 *     "引了 face-reader 却自己取内容"半接线;
 *  T8 豁免族必须进守门 108 存活期表(30 天)—— 防"豁免只有出生没有死亡";
 *  T9 CLI 端到端(临时 git 仓,经 mkScratch)—— 默认档只报数 / 存量不红 / 净新增必红 /
 *     两面旗同给与未知开关必 exit 2,全部走**生产入口**,不是函数层自证;
 *  T10 self-test 必须可跑且整绿 —— 本票"不得改源门"的反证:源门漂了会在这里现形。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  EXEMPT_MARK,
  SELF_SKIP_ENV,
  PROMISE_KEYWORDS,
  IRREVERSIBLE_KEYS,
  REDACTION_KEYS,
  prefilterPattern,
  listCandidates,
  classifyName,
  matchedKeys,
  scanFile,
  maskFaces,
} from '../check-digest-name-reality.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GATE_REL = 'check-digest-name-reality.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const ROOT = resolve(SCRIPTS_DIR, '..')
const GIT = resolveGitBin() || 'git'
const SRC = readFileSync(join(SCRIPTS_DIR, GATE_REL), 'utf8')
const RUNNER = readFileSync(join(SCRIPTS_DIR, 'guardian-runner.mjs'), 'utf8')

/**
 * 修复前一版的两个真站点(立门阳性对照用的同一枚历史版本,本会话实测该面"命中 2"):
 *   · Python `_fingerprint_hash` 文档写"计算指纹哈希",实现是 `"|".join(parts)`,含 UA/时区的
 *     明文经 `fingerprint_hash=` 存进设备图谱当比较键;
 *   · TS `hashInput` 返回 `JSON.stringify(整个工具入参)`,字段全程叫 `inputHash`,拼进 pattern
 *     POST 到 /api/memory/procedural 长期落库。
 * 取不到对象必须**大声失败**(跳过会把 T4 洗成恒绿)。
 */
const FIX_REF = '69a3d72f2'
const PY_REL = 'apps/ai-service/app/services/publish/anti_risk/cross_account_guard.py'
const TS_REL = 'apps/cli/src/doom-loop-detector.ts'

function gitShowBlob(ref, rel) {
  try {
    return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', ROOT, 'show', `${ref}:${rel}`], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 32 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Error(
      `T4/T5 的阳性对照依赖历史 blob ${ref}:${rel}(修复前一版,不可再生)。` +
        `取不到即取证失效,必须先把对象找回(§22 tag 备份链),不得改成本地夹具凑数:` +
        String(e?.stderr ?? e?.message ?? e).slice(0, 200),
    )
  }
}

function runGate(args, cwd = ROOT) {
  try {
    const out = execFileSync(process.execPath, [join(cwd, 'scripts', GATE_REL), ...args], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300_000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return {
      code: typeof e?.status === 'number' ? e.status : -1,
      out: `${e?.stdout ?? ''}${e?.stderr ?? ''}`,
    }
  }
}

/**
 * 从注册表文本里按**大括号配对**取出某个 script 的那**一条**注册项(门 136 镜像同法)。
 * 上一版那种"脚本名前后各 N 字符"会跨进邻门条目 —— 别人有 blocking 就算我有,装车证明变成假证。
 */
function extractEntry(text, scriptName) {
  const needle = `script: '${scriptName}'`
  const at = text.indexOf(needle)
  if (at < 0) return null
  const open = text.lastIndexOf('{', at)
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return text.slice(open, i + 1)
    }
  }
  return null
}

test('T1 装车证明:本门在 runner 里恰好一条,blocking + skipEnv + stagedTriggers 齐备', () => {
  const occurrences = RUNNER.split(GATE_REL).length - 1
  assert.equal(occurrences, 1, `runner 里出现 ${occurrences} 次本门脚本名(应 1;两块注册=重复登记,串失败归属)`)
  const block = extractEntry(RUNNER, GATE_REL)
  assert.ok(block, 'runner 里没有本门注册项 —— 判据存在而无人调度 = 没有(守门 89 R1 同型)')
  assert.match(block, /mode:\s*'blocking'/, "本仓 runner 的定级字段是 mode:'blocking';降级成 warn 等于不拦提交")
  assert.ok(block.includes(SELF_SKIP_ENV), `已注册但 skipEnv 与源门导出常量 SELF_SKIP_ENV 不一致(${SELF_SKIP_ENV})`)
  assert.equal(SELF_SKIP_ENV, 'HUSKY_SKIP_DIGEST_NAME_REALITY', '应急出口名漂了 —— 文档与 runner 会指向两个不同的 env')
  assert.match(block, /stagedTriggers:\s*\[[^\]]*'apps\//, "stagedTriggers 不含 apps/ ⇒ 撒谎函数最多的那一面根本不唤起本门(判据存在而永不调用=没有)")
  assert.match(block, /stagedTriggers:\s*\[[^\]]*'packages\//, 'stagedTriggers 不含 packages/ —— 立项四例之一就在 packages/types')
  // 不跨邻门:紧邻的门 136 的条目必须**不**在本块里
  assert.ok(!block.includes('check-background-task-type-parity.mjs'), '取到的条目跨进了邻门 —— 大括号配对失效')
})

test('T2 摘线不得被读成已装车;提取器对构造面成对有效(防 T1 的 null/非null 都是空转)', () => {
  // 构造面①:只含邻门(还是 blocking+skipEnv 齐备的那一条),没有本门 ⇒ 必须判"未注册"。
  const NEIGHBOR = [
    '  {',
    "    id: '136',",
    "    script: 'check-background-task-type-parity.mjs',",
    "    mode: 'blocking',",
    "    skipEnv: 'HUSKY_SKIP_BG_TASK_TYPE_PARITY',",
    '    stagedTriggers: [],',
    '  },',
  ].join('\n')
  assert.equal(extractEntry(NEIGHBOR, GATE_REL), null, '不含本门的注册表必须判未注册(否则"摘线必红"无从谈起)')
  // 构造面②:把本门条目以 **warn** 形贴在邻门之后(两者相邻)—— 提取块里不得混进邻门的 skipEnv,
  // 且必须如实带着本门自己的 warn(证明配对取的是"本门那一条",不是"附近那一片")。
  const fake = [
    NEIGHBOR,
    '  {',
    "    id: '137',",
    `    script: '${GATE_REL}',`,
    "    mode: 'warn',",
    `    skipEnv: '${SELF_SKIP_ENV}',`,
    '  },',
  ].join('\n')
  const blk = extractEntry(fake, GATE_REL)
  assert.ok(blk, '加上的条目必须能被提取到(否则上面那个 null 是提取器空转的恒真)')
  assert.match(blk, /mode:\s*'warn'/, '提取范围漂了:块里读不到本门自己的 warn')
  assert.ok(!blk.includes('HUSKY_SKIP_BG_TASK_TYPE_PARITY'), '块里混进了邻门 skipEnv ⇒ 正是"别人有 blocking 就算我有"那一型')
})

test('T3 预筛是判据关键字的严格超集 + 名单逐键在临时仓真命中(名单不是死表)', () => {
  const pat = prefilterPattern()
  const keys = [...new Set([...PROMISE_KEYWORDS, ...IRREVERSIBLE_KEYS, ...REDACTION_KEYS])]
  const missing = keys.filter((k) => !pat.includes(k))
  assert.deepEqual(missing, [], `预筛模式漏了:${missing.join(',')} —— 漏一个,门对该形态全盲而账面照报绿(守门 102 同型)`)
  // 预筛必须只有这一份来源:listCandidates 拼 -E 实参的那一行不许换成第二张表
  assert.match(SRC, /args\.push\('-E', prefilterPattern\(\)\)/, 'listCandidates 没有用唯一出口 prefilterPattern() ⇒ 第二份关键字表(§22c)')
  // 名单正向证明:每个关键字都要能以**声明名**被判据认出来(镜像侧补 IRREVERSIBLE/REDACTION 两半;
  // PROMISE_KEYWORDS 的整体正向证明住在 self-test 第 17 条,不在这里重抄)
  for (const k of [...IRREVERSIBLE_KEYS, ...REDACTION_KEYS]) {
    const name = /[㐀-鿿]/.test(k) ? `${k}字段` : `${k}ed`
    assert.ok(classifyName(name), `${k} 作声明名(${name})认不出来 ⇒ 名单可以是张死表(守门 120 那一型)`)
    assert.ok(matchedKeys(name).includes(k), `matchedKeys(${name}) 不含 ${k} —— 分档判据与该关键字脱钩`)
  }
  // 端到面:每关键字单独一文件,预筛必须逐名枚举到;无关键字的哨兵文件不得入面
  const dir = mkScratch('dgnr-prefilter-')
  try {
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, 'init', '-q'], { windowsHide: true, timeout: 60_000 })
    mkdirSync(join(dir, 'apps'), { recursive: true })
    keys.forEach((k, i) => {
      writeFileSync(join(dir, 'apps', `kw${i}.ts`), `const v${i} = 1 // ${k}\n`, 'utf8')
    })
    writeFileSync(join(dir, 'apps', 'zznotkw.ts'), 'const plain = 1 // zzqqx\n', 'utf8')
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, 'add', '-A'], { windowsHide: true, timeout: 60_000 })
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, '-c', 'user.email=g@f.local', '-c', 'user.name=g', 'commit', '-q', '-m', 'f'], {
      windowsHide: true,
      timeout: 60_000,
    })
    const listed = new Set(listCandidates(dir, 'head'))
    keys.forEach((_k, i) => assert.ok(listed.has(`apps/kw${i}.ts`), `关键字文件 apps/kw${i}.ts 没被预筛枚举到 ⇒ 超集是纸面的`))
    assert.ok(!listed.has('apps/zznotkw.ts'), '不含关键字的哨兵文件被枚举 ⇒ 预筛在放宽,不在超集')
  } finally {
    rmScratch(dir)
  }
})

test('T4 阳性对照:修复前两处真仓历史 blob 喂 scanFile,必须命中并点名(命中 2)', () => {
  const py = gitShowBlob(FIX_REF, PY_REL)
  const a = scanFile(PY_REL, py)
  const pyHit = a.hits.find((h) => h.name === '_fingerprint_hash')
  assert.ok(pyHit, `修复前的 _fingerprint_hash 必须命中,实得 hits=${JSON.stringify(a.hits.map((h) => h.name))}`)
  assert.match(pyHit.why, /拼接|序列化/, 'B 判据(实现只做字符串活)没出现在命中理由里')
  assert.match(pyHit.why, /出口|槽位|撒谎|对象字面量/, 'C 判据(值流向持久化)没出现在命中理由里')
  assert.equal(a.hits.length, 1, `该 blob 应恰 1 处命中(现读基准;变多=判据被放宽,见 T5)`)

  const ts = gitShowBlob(FIX_REF, TS_REL)
  const b = scanFile(TS_REL, ts)
  const tsHit = b.hits.find((h) => h.name === 'inputHash')
  assert.ok(tsHit, `修复前的 inputHash(hashInput 的持久化载体)必须命中,实得 hits=${JSON.stringify(b.hits.map((h) => h.name))}`)
  assert.match(tsHit.why, /拼接|序列化/)
  assert.match(tsHit.why, /出口|槽位|撒谎|对象字面量/)
  assert.equal(b.hits.length, 1, '该 blob 应恰 1 处命中')
})

test('T5 反向锁:同一夹具换成真散列必须落放过(判据不得改宽成"名字带 hash 就红")', () => {
  const py = gitShowBlob(FIX_REF, PY_REL)
  const pyFix = py.replace('return "|".join(parts)', 'return hashlib.sha256(str(parts)).hexdigest()')
  assert.notEqual(pyFix, py, '替换未发生 ⇒ 本条在空转(夹具文本漂了要说,不许静默绿)')
  assert.deepEqual(scanFile(PY_REL, pyFix).hits.map((h) => h.name), [], '换成 hashlib.sha256 后仍命中 ⇒ 判据已宽到"名字承诺即红",修好的代码会被钉成恒红门')

  const ts = gitShowBlob(FIX_REF, TS_REL)
  const tsFix = ts.replace(
    'return JSON.stringify(input ?? {})',
    'return createHash("sha256").update(String(input ?? "")).digest("hex")',
  )
  assert.notEqual(tsFix, ts, '替换未发生 ⇒ 本条在空转')
  assert.deepEqual(scanFile(TS_REL, tsFix).hits.map((h) => h.name), [], '换成 createHash 后仍命中 ⇒ 同上')
})

test('T6 假阳性三型按名钉住(现读当前工作树):fingerprints / hashIdx / hashed→storedCandidates', () => {
  // ① fingerprints = **哈希值的集合**(容器,不是摘要生产者)⇒ 必须落"未判定(纯转传)",绝不算命中。
  const riskRel = 'apps/ai-service/app/services/publish/anti_risk/risk_scoring.py'
  const risk = scanFile(riskRel, readFileSync(resolve(ROOT, riskRel), 'utf8'))
  assert.ok(classifyName('fingerprints'), '门对该名字必须仍是候选 —— 否则下面"无命中"是失明不是放过')
  assert.ok(!risk.hits.some((h) => h.name === 'fingerprints'), 'fingerprints(集合容器)被判红 ⇒ 会指使人去给集合加 sha256,那才是新缺陷')
  assert.ok(risk.undetermined.some((u) => u.name === 'fingerprints'), 'fingerprints 应落未判定(兑现发生在生产者一侧),档位变了要同步本条')
  // ② hashIdx = **URL 片段位置**(indexOf('#'))⇒ 现以带原因行内豁免放过;不得被"顺手 sha256"修好。
  const pageRel = 'apps/web/app/(main)/feature-center/documents/page.tsx'
  const page = scanFile(pageRel, readFileSync(resolve(ROOT, pageRel), 'utf8'))
  assert.ok(classifyName('hashIdx'), '门对 hashIdx 必须仍是候选(同上)')
  assert.ok(!page.hits.some((h) => h.name === 'hashIdx'), 'hashIdx 被判红 ⇒ 处置被改宽/被删豁免,把它记成"该修代码"就修坏了')
  assert.ok(page.passes.some((p) => p.name === 'hashIdx' && p.why.includes(EXEMPT_MARK)), 'hashIdx 的现处置=带原因行内豁免;换通道(如放宽判据)必须同步本条')
  // ③ hashed 一型当年的正确处置是**改名**(packages/auth/src/oauth2.ts → storedCandidates),
  //    不是放宽判据 —— 旧名在判据里仍必须是候选(门没瞎),而文件里两名的任何档位都不该出现(改名真生效)。
  const oauthRel = 'packages/auth/src/oauth2.ts'
  const oauth = scanFile(oauthRel, readFileSync(resolve(ROOT, oauthRel), 'utf8'))
  assert.ok(classifyName('hashed'), 'hashed 一名不得从判据里豁免掉 —— 它仍是候选才谈得上"靠改名解决"')
  assert.equal(matchedKeys('storedCandidates').length, 0, '新名 storedCandidates 不该是承诺名(改名方案的基线)')
  for (const name of ['hashed', 'storedCandidates']) {
    for (const bucket of [oauth.hits, oauth.undetermined, oauth.passes]) {
      assert.ok(!bucket.some((x) => x.name === name), `oauth2.ts 里出现 ${name} 的档位记录 ⇒ 该处形态变了,本条与守门 137 的处置说明都要重读`)
    }
  }
})

test('T7 取材面形状锁:走 face-reader 的读取入口,不得 cwd 定根/自派生 git 读内容(门 70/118 同型)', () => {
  // 判据面必须**先剥注释**:源门头注里就写着「禁止 `process.cwd()`」与「半接线」这些字样,
  // 按原文判 ⇒ 门把"解释自己的散文"判成违规现场(守门 131/70 同型,本条第一版就栽在 comment
  // 里的 process.cwd() 上)。遮噪复用门自己导出的 maskFaces —— 不在测试里再抄一台状态机(§22c)。
  const CODE = maskFaces(SRC, 'ts').noComment
  assert.match(CODE, /from '\.\/lib\/face-reader\.mjs'/, '未引统一取材层')
  assert.match(CODE, /catBatch\(/, "没调用层的读取入口 catBatch( ⇒ 内容仍可能自派生 git/按磁盘取 —— 守门 118 的半接线")
  assert.match(CODE, /selectFace\(/, '未走 selectFace ⇒ 两面旗同给/默认档的行为没人保证')
  assert.match(CODE, /def: 'head'/, "默认档必须是 head;改成磁盘就是恒红与假绿来回抛那一型(§12e)")
  assert.doesNotMatch(CODE, /process\.cwd\(\)/, 'ROOT 必须由脚本自身位置推导;按 cwd 定根 ⇒ 夹具测试静默审真仓(守门 70 的 13/14 恒红同型)')
  assert.doesNotMatch(CODE, /from 'node:child_process'/, '自己派生 git 读被审内容 = 半接线(守门 118 判的就是这一型)')
  assert.doesNotMatch(CODE, /execSync\(|execFileSync\(/, '不得绕过取材层自跑 git 子进程')
  assert.equal((CODE.match(/readFileSync\(/g) || []).length, 1, 'readFileSync 只允许一处:读基线台账(被审内容必须走 catBatch/readWorktreeFile)')
  assert.match(CODE, /resolve\(root, BASELINE_FILE\)[\s\S]{0,120}readFileSync\(abs/, '唯一一处 readFileSync 的对象必须是基线文件,不是被审源码')
  // §22d 双形态入口:被 import 时绝不触发 main(否则本测试收集期就会把全仓扫一遍)
  assert.match(CODE, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL/, '缺 isDirectRun 守卫 ⇒ import 即触发 CLI(§22d)')
})

test('T8 跨文件锁:digest-name-exempt 必须进守门 108 的 FAMILY_LIFETIME_DAYS(30 天)', () => {
  assert.equal(EXEMPT_MARK, 'digest-name-exempt', '豁免族名漂了 —— 下面这把锁与所有行内标记会一起失效')
  const expiry = readFileSync(join(SCRIPTS_DIR, 'check-exemption-expiry.mjs'), 'utf8')
  const m = /'digest-name-exempt':\s*(\d+)/.exec(expiry)
  assert.ok(m, "digest-name-exempt 没进存活期表 ⇒ 走 90 天默认档:'名字撒过谎'被登记成半永久豁免(豁免只出生不死亡那一型)")
  assert.equal(m[1], '30', '该族是待偿迁移债(改名或真散列),30 天;改档要走守门 108 的表旁注释,不得就地放宽')
})

/** 构造夹具(自造形状,只用来验 CLI 契约;"真仓产出的形态"的证明住在 T4,不混用)。 */
const FIX_PY = [
  'def _fingerprint_hash(fp) -> str:',
  '    """计算指纹哈希(构造夹具,非真仓形态)。"""',
  '    parts = [fp.user_agent, fp.timezone_id]',
  '    return "|".join(parts)',
  '',
  'async def record_async(fingerprint):',
  '    fp_hash = _fingerprint_hash(fingerprint)',
  '    await guard.record_binding(fingerprint_hash=fp_hash)',
  '',
].join('\n')
const FIX_PY_GROW = [
  'def _fingerprint_hash_b(fp) -> str:',
  '    """计算另一枚指纹哈希(构造夹具 b)。"""',
  '    parts = [fp.user_agent, fp.screen]',
  '    return "|".join(parts)',
  '',
  'async def record_async_b(fingerprint):',
  '    fp_hash_b = _fingerprint_hash_b(fingerprint)',
  '    await guard.record_binding(fingerprint_hash_b=fp_hash_b)',
  '',
].join('\n')

test('T9 CLI 端到端(临时 git 仓):存量只报数 / 相等不红 / 净新增必红 / 两面旗同给与未知开关判死', () => {
  const dir = mkScratch('dgnr-cli-')
  const rel = 'apps/ai-service/app/services/publish/x_guard.py'
  try {
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, 'init', '-q'], { windowsHide: true, timeout: 60_000 })
    for (const c of [['user.email', 'gate@fixture.local'], ['user.name', 'gate-fixture'], ['commit.gpgsign', 'false']]) {
      execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, 'config', ...c], { windowsHide: true, timeout: 60_000 })
    }
    mkdirSync(join(dir, ...rel.split('/').slice(0, -1)), { recursive: true })
    writeFileSync(join(dir, rel), FIX_PY, 'utf8')
    // 门按自身位置推 ROOT,不装它 + 它的相对 import 闭包,夹具里跑的就是真仓那份门(守门 70 同型)
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/face-reader.mjs', 'lib/gitdir.mjs'])
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, 'add', '-A'], { windowsHide: true, timeout: 60_000 })
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, 'commit', '-q', '-m', 'fixture'], { windowsHide: true, timeout: 60_000 })

    // ① 默认档(HEAD 面):有命中也**只报数不判红** —— 与改动无关的恒红门唯一结局是逼人 --no-verify
    const def = runGate(['--root', dir], dir)
    assert.equal(def.code, 0, `默认档对存量必须 0,实得 ${def.code}:${def.out}`)
    assert.match(def.out, /🔴 .*x_guard\.py.*_fingerprint_hash/, `默认档必须逐条点名命中(报数不是静默):${def.out}`)
    assert.match(def.out, /默认档只报数/)

    // ② 提交链档(索引==HEAD):棘轮锚点=该文件 HEAD 自身存量 ⇒ 相等不得红
    const same = runGate(['--staged', '--root', dir], dir)
    assert.equal(same.code, 0, `索引与 HEAD 持平时必须 0(否则恒红),实得 ${same.code}:${same.out}`)
    assert.doesNotMatch(same.out, /棘轮/, `存量持平不应出棘轮行:${same.out}`)

    // ③ 净新增必须红:同一文件再加一处同型撒谎 ⇒ 索引 > HEAD 锚点
    writeFileSync(join(dir, rel), FIX_PY + FIX_PY_GROW, 'utf8')
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, 'add', '--', rel], { windowsHide: true, timeout: 60_000 })
    const grew = runGate(['--staged', '--root', dir], dir)
    assert.equal(grew.code, 1, `净新增必须 exit 1,实得 ${grew.code}:${grew.out}`)
    const m = /HEAD 存量 (\d+) → 索引 (\d+)/.exec(grew.out)
    assert.ok(m && Number(m[2]) > Number(m[1]), `棘轮行必须报出"锚点 < 现值",实得:${grew.out}`)

    // ④ 问责档:strict 下 HEAD 面命中即红(默认档与它只差在退出码,不缺在看见)
    assert.equal(runGate(['--root', dir, '--strict'], dir).code, 1, '--strict 有命中必须 1')

    // ⑤ 契约护栏:两面旗同给 / 未知开关 ⇒ exit 2(不任选一面冒充判定,也不让打错的问责静默通过)
    const both = runGate(['--staged', '--worktree', '--root', dir], dir)
    assert.equal(both.code, 2, `两面旗同给必须 2,实得 ${both.code}:${both.out}`)
    assert.match(both.out, /无法判定/)
    const bogus = runGate(['--stadge', '--root', dir], dir)
    assert.equal(bogus.code, 2, `未知开关必须 2(打错字母的问责看起来像成功=什么都没判),实得 ${bogus.code}:${bogus.out}`)
    assert.match(bogus.out, /未知开关/)
  } finally {
    rmScratch(dir)
  }
})

test('T10 源门未被本票碰坏:--self-test 必须整绿(判据本体的正反成对用例都住在那里)', () => {
  const r = runGate(['--self-test'], ROOT)
  assert.equal(r.code, 0, `--self-test 红 ⇒ 源门判据漂了或本票动过它(镜像只准加锁,不准动门):\n${r.out}`)
  assert.match(r.out, /--self-test:\d+ 条断言,失败 0 条/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
