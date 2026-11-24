// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 客户端会话镜像桥(2026-11-11 立)—— 号池 OAuth 票"双消费者轮换竞态"根治的执行端。
//
// 立因(2026-11-11 minimax 死票取证):同一个 OAuth grant 的 rt 快照存在两份 ——
// 本机客户端(~/.minimax auth.json / Qoder auth.v1.dat / WorkBuddy 桌面端)与号池
// secretsEnc。两边各自刷新就各自轮转 rt,对方手里那份立即作废;上游看到同一 rt
// 在两个消费语境使用(IP 也漂移),按反滥用策略整条 grant 吊销(invalid_grant
// "start a new authorization"),票死且两端全灭。
//
// 根治 = 单一消费者化:号池刷新前先采纳客户端副本更新的 rt(pull),刷新成功后把
// 新凭据写回客户端副本(push)。上游视角永远只有一个按序轮换的消费者。
//
// 本桥由 apps/api/src/services/relay-client-session-mirror.ts 经 run-as-user
// 派发执行(桌面用户身份 ⇒ DPAPI 可解),协议:
//   stdin  = JSON {op:'pull'|'push', provider, payload}
//   stdout = 一行 JSON 结果(成功 {ok:true,...};失败 {ok:false,code,message})
// 凭据明文只经 stdin/stdout 管道流动,绝不落日志。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url)) // = <repo>/scripts

function readStdinJson() {
  return new Promise((resolve, reject) => {
    const chunks = []
    for (const stream of [process.stdin]) {
      stream.on('data', (c) => chunks.push(c))
      stream.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (e) {
          reject(new Error(`stdin 不是合法 JSON:${e instanceof Error ? e.message : String(e)}`))
        }
      })
      stream.on('error', reject)
    }
  })
}

/** minimax pull:auth.json 明文落盘(2026-10-27 实证),按池票 secrets 里的
 *  recordKey/sourcePath 定位同一条记录,读出客户端现役凭据与代次。 */
async function pullMinimax() {
  const extract = await import(pathToFileURL(path.join(HERE, 'lib', 'minimax-auth-extract.mjs')).href)
  const records = []
  for (const root of extract.candidateRoots({ env: process.env })) {
    for (const f of extract.discoverAuthFiles(root)) {
      try {
        const j = JSON.parse(fs.readFileSync(f.authPath, 'utf8'))
        for (const [recordKey, rec] of Object.entries(j.records ?? {})) {
          records.push({ recordKey, authPath: f.authPath, mtimeMs: fs.statSync(f.authPath).mtimeMs, rec: rec ?? {} })
        }
      } catch {
        /* 单文件坏不拖垮整体 */
      }
    }
  }
  return records
}

const PULLS = {
  minimax: pullMinimax,
  // qoder/workbuddy 走各自既有采集器(DPAPI 在 asUser 身份下可解):
  qoder: async () => {
    const extract = await import(pathToFileURL(path.join(HERE, 'lib', 'qoder-auth-extract.mjs')).href)
    const out = await extract.extractQoderAccounts({ env: process.env })
    return out
  },
  workbuddy: async () => {
    const extract = await import(pathToFileURL(path.join(HERE, 'lib', 'workbuddy-auth-extract.mjs')).href)
    const out = await extract.extractWorkbuddyAccount({ env: process.env })
    return out
  },
}

async function main() {
  const req = await readStdinJson()
  if (req?.op === 'pull') {
    const fn = PULLS[req.provider]
    if (!fn) throw new Error(`pull 不支持平台: ${req.provider}`)
    const data = await fn()
    process.stdout.write(JSON.stringify({ ok: true, data }))
    return
  }
  if (req?.op === 'push') {
    const localLogin = await import(pathToFileURL(path.join(HERE, 'local-login.mjs')).href)
    const apply = localLogin.ADAPTERS[req.provider]
    if (!apply) throw new Error(`push 不支持平台: ${req.provider}`)
    // 注意:镜像写回绝不关端/拉起 —— 只就地换凭据;客户端在跑时由 apply* 内部
    // 守卫决定拒写(WriteError),绝不强杀用户正在用的客户端。
    // extract 门面必须注入(2026-11-12 实测):apply* 的落点定位要按平台枚举候选根
    // (如 minimax 的 minimaxCandidateRoots),缺它则 push 必崩
    // `Cannot read properties of undefined` ⇒ 新票永远写不回 auth.json(签到票面断供)。
    const extract = await localLogin.__test__.loadExtract()
    const result = await apply(req.payload, { closeClient: false, relaunch: false, extract })
    process.stdout.write(JSON.stringify({ ok: true, provider: result?.provider ?? req.provider, file: result?.file ?? '' }))
    return
  }
  throw new Error(`未知 op: ${String(req?.op)}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    process.stdout.write(
      JSON.stringify({ ok: false, code: e?.code ?? 'mirror-error', message: String(e?.message ?? e).slice(0, 300) }),
    )
    process.exit(1)
  })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
