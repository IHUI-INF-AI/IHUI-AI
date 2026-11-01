// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autonomy-runner 镜像测试(§22c:判据一律 import 源实现,本文件零复算)。
 *
 * 接线锁的对象 = 自开发发起腿 2026-11-01 实测的三格病灶:
 *   ① 入库模板钉死他机盘符(`G:/IHUI-AI`)⇒ 归一到当次仓根;
 *   ② 归一后仍可能指向本机不存在的产物层(`apps/cli/npm-dist`)⇒ preflight 点名 missing;
 *   ③ 环境级失败被按票面失败计数 ⇒ 连败封票把好票冤杀 ⇒ classify 必须分出 environment。
 * 每条放行档都配反证(变异自证):摘掉对应判据即翻红,否则锁不住。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  repoRootVariants,
  expandRepoRootTemplate,
  rewriteForeignRepoRoot,
  resolveSessionCommand,
  extractAbsPathTokens,
  preflightSessionRunner,
  classifySessionFailure,
  gateTicketByHumanValve,
  REPO_ROOT_TOKEN,
} from '../lib/autonomy-runner.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
let pass = 0
let fail = 0
const ok = (name, cond) => {
  if (cond) {
    pass++
  } else {
    fail++
    console.log(`  ❌ ${name}`)
  }
}

// 当次实测仓根(不写死盘符,§0 现读):从本文件自身位置推到仓根
const liveRoot = ROOT.replace(/\\/g, '/')
const liveRootBack = ROOT.replace(/\//g, '\\')
const BASE = ROOT.split(/[\\/]/).pop()

ok('T1 repoRootVariants 合法仓根给两形且长形优先', (() => {
  const v = repoRootVariants(liveRootBack)
  return v.length === 2 && v[0].includes('\\') && v[1].includes('/')
})())

ok('T2 变异:形态坏的仓根(丢了分隔符)一律不收,交上层判未判定', (() => {
  const bad = repoRootVariants(`${liveRoot.slice(0, 2)}${BASE}`)
  const none = repoRootVariants('')
  const rel = repoRootVariants('relative/path')
  return bad.length === 0 && none.length === 0 && rel.length === 0
})())

ok('T3 令牌展开吃进仓根', expandRepoRootTemplate(`node ${REPO_ROOT_TOKEN}/a.js`, liveRootBack) === `node ${liveRootBack}/a.js`)

ok('T4 他机钉死归一:同仓根基名的他盘符前缀 → 当次仓根', (() => {
  const foreign = `node Q:/${BASE}/apps/cli/dist/index.js --workspace Q:\\${BASE}`
  const out = rewriteForeignRepoRoot(foreign, liveRootBack)
  return out.includes(`${liveRootBack}/apps/cli/dist/index.js`) && !out.includes(`Q:/`) && !out.includes(`Q:\\`)
})())

ok('T5 变异:盘外路径(node.exe 在别处)不得被改写 —— 改了就是把执行体搬到错地方', (() => {
  const out = rewriteForeignRepoRoot(`C:\\Users\\someone\\node.exe ${REPO_ROOT_TOKEN}\\x.js`, liveRootBack)
  return out.includes('C:\\Users\\someone\\node.exe')
})())

ok('T6 变异:基名不同名的他机根不得被误当本仓根(仓根改名/同盘他目录不受侵蚀)', rewriteForeignRepoRoot(`D:\\Other-Repo\\a.js`, liveRootBack) === `D:\\Other-Repo\\a.js`)

ok('T7 resolve 顺序:先救他机钉死再展开令牌,两形同归一个命令', (() => {
  const cmd = resolveSessionCommand(`node ${REPO_ROOT_TOKEN}/apps/cli/dist/index.js -w G:/${BASE}`, liveRootBack)
  return cmd.includes(`${liveRootBack}/apps/cli/dist/index.js`) && cmd.includes(`${liveRootBack}`) && !cmd.includes(REPO_ROOT_TOKEN)
})())

ok('T8 token 抽取去重且不把 file:/// 咬错位', (() => {
  const t = extractAbsPathTokens(`node ${liveRootBack}/a.js --w ${liveRootBack}/a.js --url file:///${liveRoot}/b.js`)
  return t.length === 2 && t.every((x) => /(^|\s)[A-Za-z]:/.test(x) || x.startsWith('/'))
})())

ok('T9 preflight 在本机真实入口上 = ready(病灶①②已修的直接凭据)', (() => {
  const pf = preflightSessionRunner(`node ${REPO_ROOT_TOKEN}/apps/cli/dist/index.js -w ${REPO_ROOT_TOKEN}`, liveRootBack)
  return pf.state === 'ready' && pf.missing.length === 0 && pf.checked.length >= 2
})())

// 夹具必须是「结构性不存在」的一层,而不是某台机上恰好没建出来的产物目录:
// 2026-11-02 实测本机 apps/cli/npm-dist/ 已被别的会话真建出来,原写法当场翻红 ——
// 判"缺不缺在位"的用例若靠机器偶然状态,换一台机/建一次产物就自锁(§0.1 现读同义)。
ok('T10 病灶②:归一后仍指向本机不存在的产物层 ⇒ missing 并点名(不是 ready)', (() => {
  const pf = preflightSessionRunner(`node ${REPO_ROOT_TOKEN}/apps/cli/__ihui-absent-fixture__/dist/index.js`, liveRootBack)
  return pf.state === 'missing' && pf.missing.length === 1 && pf.missing[0].includes('__ihui-absent-fixture__')
})())

ok('T11 病灶①:他机盘符钉死经归一后落到本机在位入口 ⇒ ready', (() => {
  const pf = preflightSessionRunner(`node Z:/${BASE}/apps/cli/dist/index.js --workspace Z:/${BASE}`, liveRootBack)
  return pf.state === 'ready'
})())

ok('T12 枚举到 0 个可核验路径判死不记绿(§0.3)', preflightSessionRunner('ihui --json', liveRootBack).state === 'undetermined')

ok('T13 仓根取不到 ⇒ 未判定,不回落放行', preflightSessionRunner(`node ${REPO_ROOT_TOKEN}/a.js`, '').state === 'undetermined')

ok('T14 空模板 = dry-run 档,不算缺也不算过', preflightSessionRunner('   ', liveRootBack).state === 'template-empty')

ok('T15 病灶③:模块级失败分型为 environment(不计票连败)', (() => {
  const c = classifySessionFailure({ status: 1, stderr: "Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'G:/IHUI-AI/apps/cli/npm-dist/dist/index.js'" })
  return c.kind === 'environment' && c.sign === 'ERR_MODULE_NOT_FOUND'
})())

ok('T16 变异:真·会话失败仍归 session —— 分型不得把票的失败也一并免掉(否则封票机制形同虚设)', classifySessionFailure({ status: 1, stderr: 'typecheck failed in 3 files' }).kind === 'session')

ok('T17 退出码取不到 ⇒ undetermined,不冒充成功也不记票失败', classifySessionFailure({ status: null, stderr: '' }).kind === 'undetermined')

ok('T18 exit=0 ⇒ ok', classifySessionFailure({ status: 0, stderr: '' }).kind === 'ok')

ok('T19 活配置自证:gates.json 的模板经 preflight 必须 ready(病灶真除,不是只在测试里好)', (() => {
  const gates = JSON.parse(readFileSync(join(ROOT, 'scripts', 'data', 'auto-evolve-gates.json'), 'utf8'))
  const pf = preflightSessionRunner(gates.sessionCommandTemplate, liveRootBack)
  if (pf.state !== 'ready') console.log(`     现读 state=${pf.state} missing=${pf.missing.join(',')} why=${pf.why}`)
  return pf.state === 'ready'
})())

// ---- 人工阀前置闸(判据 import lib,human-valve.mjs 的分类器;本文件只验接线语义) ----
const valveText = readFileSync(join(ROOT, 'scripts', 'data', 'human-valve-list.json'), 'utf8')
ok('T20 命中停机类 + enforce ⇒ block(闸真的拦得住)', gateTicketByHumanValve({ ticketText: '替换生产模型密钥并重启发信服务', mode: 'enforce', valveListText: valveText }).action === 'block')
ok('T21 同一张票 + observe ⇒ 只记账不拦(放量前先看命中分布)', gateTicketByHumanValve({ ticketText: '替换生产模型密钥并重启发信服务', mode: 'observe', valveListText: valveText }).action === 'observe-stop')
ok('T22 自决类 ⇒ allow(闸不能把日常改代码也停掉)', (() => {
  const v = gateTicketByHumanValve({ ticketText: '给 check-xxx.mjs 补一条镜像测试并跑守门', mode: 'enforce', valveListText: valveText })
  return v.action === 'allow'
})())
ok('T23 变异:动作不在已知清单 ⇒ enforce 下必须 block(fail-closed 不被放宽)', gateTicketByHumanValve({ ticketText: '把这批东西按神秘方式咕一下', mode: 'enforce', valveListText: valveText }).action === 'block')
ok('T24 清单取不到 ⇒ unjudged,不猜成放行也不猜成拦', gateTicketByHumanValve({ ticketText: 'x', mode: 'enforce', valveListText: '' }).action === 'unjudged')
ok('T25 档位取值非法 ⇒ unjudged(缺省档只能由调用方显式决定)', gateTicketByHumanValve({ ticketText: 'x', mode: 'yolo', valveListText: valveText }).action === 'unjudged')
ok('T26 空票面 ⇒ 落停机而非放行', gateTicketByHumanValve({ ticketText: '   ', mode: 'enforce', valveListText: valveText }).action === 'block')

console.log(fail === 0 ? `autonomy-runner: ${pass} 例全绿` : `autonomy-runner: ${pass} 绿 / ${fail} 红`)
process.exitCode = fail === 0 ? 0 : 1
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
