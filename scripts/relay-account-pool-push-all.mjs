// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机号池全量推送生产(2026-11-10 立)。
 *
 * 一条命令把**本机开发库号池里的所有平台账号**倒进生产库的同一枚个人池:
 *   1) 复用 apps/api/scripts/relay-account-export.ts(库里 → 各平台原生导入形状,含明文凭据);
 *   2) 整个导出目录一次 scp 到生产临时目录;
 *   3) 一条 SSH 内以批量模式(导入器 --file 重复给)一次导入全部平台文件(--owner 显式,不落运营池);
 *   4) 无论成败,本机导出目录与生产临时目录都删净(明文不留在任何盘上)。
 *
 * 用法:
 *   node scripts/relay-account-pool-push-all.mjs
 *     [--provider <code>]        只推该平台(缺省全池)
 *     [--prod-owner <users.id>]  生产侧归属(= 生产 users.id;缺省按 email 从本机 pool-owner 翻译)
 *     [--prod-host <alias>]      SSH 别名(默认 ssh.aizhs.top)
 *     [--prod-checkout <path>]   生产 checkout 根(默认 D:\DevEnv\ihui-prod)
 *     [--keep-export]            保留本机导出目录(调试用;默认删)
 *
 * 退出码:0 全部平台导入成功 / 1 有平台导入失败 / 2 参数或环境未判定。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { fetchLocalOwnerIdEmailMap, fetchProdOwnerEmailMap, runProcess } from './relay-account-pool.mjs'
import {
  POOL_OWNER_TRANSLATE_REASON_TEXT,
  UUID_LIKE_RE,
  maskPoolOwner,
  resolveDefaultPoolOwner,
  translatePoolOwnerToTargetId,
} from './lib/pool-owner.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const EXPORTER = path.join(API_DIR, 'scripts', 'relay-account-export.ts')
const PROD_TEMP = 'D:\\DevEnv\\Temp'

const HELP = `本机号池全量推送生产

用法:
  node scripts/relay-account-pool-push-all.mjs [--provider <code>] [--prod-owner <users.id>]
    [--prod-host <alias>] [--prod-checkout <path>] [--keep-export]

流程:本机库导出(每平台一个 JSON) → 一次 scp → 一条 SSH 逐平台导入生产 → 双端删净明文。
退出码:0 全部成功 / 1 有平台失败 / 2 参数或环境未判定。`

function parseArgs(argv) {
  const options = {
    providerCode: '',
    prodOwner: '',
    prodHost: 'ssh.aizhs.top',
    prodCheckout: 'D:\\DevEnv\\ihui-prod',
    keepExport: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--provider') options.providerCode = (argv[++i] ?? '').trim()
    else if (arg === '--prod-owner') options.prodOwner = (argv[++i] ?? '').trim()
    else if (arg === '--prod-host') options.prodHost = (argv[++i] ?? '').trim()
    else if (arg === '--prod-checkout') options.prodCheckout = (argv[++i] ?? '').trim()
    else if (arg === '--keep-export') options.keepExport = true
    else return { options: null, error: `未知参数: ${arg}` }
  }
  if (options.help) return { options, error: null }
  if (options.prodOwner && !UUID_LIKE_RE.test(options.prodOwner)) {
    return { options: null, error: `--prod-owner 不像 users.id: ${options.prodOwner}` }
  }
  if (!options.prodHost) return { options: null, error: '--prod-host 需要 SSH 别名' }
  if (!options.prodCheckout) return { options: null, error: '--prod-checkout 需要路径' }
  return { options, error: null }
}

function resolveTsx() {
  for (const candidate of [
    path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/** 生产 checkout 的导入器是否已含批量模式(判据:文件里出现"批量模式"标记,不猜版本号) */
async function remoteSupportsBatch(options, sshOpts) {
  const probe = await runProcess('ssh', [
    ...sshOpts,
    options.prodHost,
    `cd /d "${options.prodCheckout}" & findstr /c:"IHUI_BATCH_FILE" apps\\api\\scripts\\relay-account-import.ts >nul && echo BATCH_YES || echo BATCH_NO`,
  ])
  return /BATCH_YES/.test(probe.stdout ?? '')
}

/** 解析生产导入器的人类面摘要行:导入完成:平台=x 新增=n 更新=n 跳过=n 失败=n */
function parseImportLines(text) {
  const rows = []
  for (const line of String(text).split(/\r?\n/)) {
    const m = /导入完成:平台=(\S+)\s+新增=(\d+)\s+更新=(\d+)\s+跳过=(\d+)\s+失败=(\d+)/.exec(line)
    if (m) {
      rows.push({
        providerCode: m[1],
        imported: Number(m[2]),
        updated: Number(m[3]),
        skipped: Number(m[4]),
        failed: Number(m[5]),
      })
    }
  }
  return rows
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP}\n`)
    return 2
  }
  const options = parsed.options
  if (options.help) {
    process.stdout.write(`${HELP}\n`)
    return 0
  }

  const tsxCli = resolveTsx()
  if (!tsxCli) {
    process.stderr.write('❌ 未找到 tsx(apps/api/node_modules/tsx);请先在仓根跑 pnpm install\n')
    return 2
  }
  // 生产归属:显式 --prod-owner 视为生产 users.id;否则本机 pool-owner 里的 users.id 必须
  // 按 email 翻成生产 users.id(两端 id 各自库生成,原样透传会造生产悬空行,2026-11-12 亲踩)。
  // 翻译不出 ⇒ 在任何导出/传输前 exit 2,不制造需要事后清理的悬空行。
  let owner = options.prodOwner
  if (!owner) {
    const localOwner = resolveDefaultPoolOwner().owner
    if (!localOwner) {
      process.stderr.write(
        '❌ 生产归属未判定:带 --prod-owner <users.id>,或在本机 ~/.wb-switch/pool-owner 写入本人 users.id\n',
      )
      return 2
    }
    const local = await fetchLocalOwnerIdEmailMap()
    if (local.error) {
      process.stderr.write(`❌ 本机归属对照不可用:${local.error} ⇒ 不导出、不传输\n`)
      return 2
    }
    const prod = await fetchProdOwnerEmailMap(options)
    if (prod.error) {
      process.stderr.write(`❌ 生产归属对照不可用:${prod.error} ⇒ 不导出、不传输\n`)
      return 2
    }
    const r = translatePoolOwnerToTargetId({
      ownerId: localOwner,
      idToEmail: local.map,
      targetEmailToId: prod.map,
    })
    if (r.reason !== 'ok') {
      process.stderr.write(
        `❌ 生产归属无法翻译(${POOL_OWNER_TRANSLATE_REASON_TEXT[r.reason] ?? r.reason}):` +
          `本机 pool-owner=${maskPoolOwner(localOwner)} ⇒ 不导出、不传输,避免在生产造悬空行\n`,
      )
      return 2
    }
    owner = r.owner
    process.stdout.write(
      `ℹ️ 生产归属已按 email 翻译:${maskPoolOwner(localOwner)} → ${maskPoolOwner(owner)}(${r.email})\n`,
    )
  }

  const stamp = `${Date.now().toString(36)}-${process.pid}`
  const exportDir = path.join(os.tmpdir(), `ihui-pool-push-${stamp}`)
  const exportName = path.basename(exportDir)
  const remoteDir = `${PROD_TEMP}\\${exportName}`
  const sshOpts = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20']
  process.stdout.write(
    `归属=个人池 ${maskPoolOwner(owner)}(${options.prodOwner ? '生产侧显式 --owner' : '按 email 从本机 pool-owner 翻译'})\n`,
  )

  let remotePrepared = false
  // 能力探针与本地导出并行(SSH 握手约 8s,不串行进关键路径);单平台导出时探针结果用不上。
  const probePromise = options.providerCode ? null : remoteSupportsBatch(options, sshOpts)
  try {
    const exportArgs = [tsxCli, EXPORTER, '--out', exportDir]
    if (options.providerCode) exportArgs.push('--provider', options.providerCode)
    const exported = await runProcess(process.execPath, exportArgs, { inherit: true })
    if (exported.code === 2) return 2

    const files = fs
      .readdirSync(exportDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
    if (files.length === 0) {
      process.stderr.write('❌ 本机号池没有可导出的账号(导出目录为空)\n')
      return 1
    }

    // 传输与执行合并成一条 SSH:导出内容 base64 走 stdin,远端 node -e 落盘后立刻导入。
    // (scp + ssh 要付两次 Cloudflare 握手≈16s,合并后只付一次;本机明文读进内存即删。)
    const bundle = {}
    for (const f of files) bundle[f] = fs.readFileSync(path.join(exportDir, f), 'utf8')
    const payload = Buffer.from(JSON.stringify(bundle), 'utf8').toString('base64')
    if (!options.keepExport) fs.rmSync(exportDir, { recursive: true, force: true })
    const writer =
      `const fs=require('fs'),p=require('path'),d='${remoteDir.replaceAll('\\', '/')}';` +
      `fs.mkdirSync(d,{recursive:true});` +
      `const o=JSON.parse(Buffer.from(fs.readFileSync(0,'utf8'),'base64').toString('utf8'));` +
      `for(const k of Object.keys(o))fs.writeFileSync(p.join(d,k),o[k]);`
    remotePrepared = true

    // 生产 checkout 可能还停在批量模式之前:先探一次(--file 重复给是新增能力),
    // 支持则一个 tsx 进程导入全部平台;不支持则退回逐平台调用生产 CLI(慢但结果一致)。
    const batchReady =
      files.length === 1 || (await (probePromise ?? remoteSupportsBatch(options, sshOpts)))
    const runSteps = batchReady
      ? [
          `node apps\\api\\node_modules\\tsx\\dist\\cli.mjs apps\\api\\scripts\\relay-account-import.ts ` +
            `${files.map((f) => `--file "${remoteDir}\\${f}"`).join(' ')} ` +
            `--owner ${owner} --owner-source explicit-flag --no-health`,
        ]
      : files.map(
          (f) =>
            `node scripts\\relay-account-pool.mjs --file "${remoteDir}\\${f}" --owner ${owner} --no-health`,
        )
    if (!batchReady) {
      process.stderr.write(
        'ℹ️ 生产 checkout 未含批量模式(导入器 --file 重复给),本次按平台逐个导入;推 main 部署后自动改走批量\n',
      )
    }
    const remoteCmd = `cd /d "${options.prodCheckout}" & node -e "${writer}" && ${runSteps.join(' & ')} && rmdir /s /q "${remoteDir}"`
    const ssh = await runProcess('ssh', [...sshOpts, options.prodHost, remoteCmd], {
      inherit: false,
      input: payload,
    })
    if (ssh.code === 0) remotePrepared = false
    const output = `${ssh.stdout ?? ''}${ssh.error ? `${ssh.error}\n` : ''}`
    const rows = parseImportLines(output)
    for (const row of rows) {
      process.stdout.write(
        `生产 ${row.providerCode}: 新增=${row.imported} 更新=${row.updated} 跳过=${row.skipped} 失败=${row.failed}\n`,
      )
    }
    const totalFailed = rows.reduce((n, r) => n + r.failed, 0)
    const ok = ssh.code === 0 && totalFailed === 0 && rows.length > 0
    if (!ok && output) process.stderr.write(`${output}\n`)
    process.stdout.write(
      `汇总: 平台=${rows.length}/${files.length} 失败行=${totalFailed} ⇒ ${ok ? '全部成功' : '有失败'}\n`,
    )
    return ok ? 0 : 1
  } finally {
    if (remotePrepared) {
      const del = await runProcess('ssh', [
        ...sshOpts,
        options.prodHost,
        `rmdir /s /q "${remoteDir}"`,
      ])
      if (del.code !== 0) process.stderr.write(`⚠️ 生产临时目录未删净: ${remoteDir}\n`)
    }
    if (!options.keepExport) {
      try {
        fs.rmSync(exportDir, { recursive: true, force: true })
      } catch {
        process.stderr.write(`⚠️ 本机导出目录未删净: ${exportDir}\n`)
      }
    }
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
