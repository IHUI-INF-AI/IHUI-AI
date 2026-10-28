// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder CLI 桥接 runner(纯 ESM,被 qoder-cli-bridge.ts 以 process.execPath <本文件> spawn)。
 *
 * 协议(NDJSON 逐行):
 * - stdin:读一行 JSON 请求 {prompt, cwd, model, configDir, sdkPath, cliPath};
 * - stdout:动态 import(sdkPath) 的 query() → for await 逐条消息写一行 JSON,
 *   result 终态后退出(成功 exit 0);
 * - 失败:stdout 输出一行 {type:'error', message} 并 exit 1(桥接层翻译为抛错)。
 *
 * SDK/CLI/configDir 全部由请求携带(不猜路径);登录态经 configDir 同时注入
 * 进程 env 与 query options.env(QODERCN_CONFIG_DIR / QODER_CONFIG_DIR)。
 * SDK/CLI 不入库:缺失时错误消息写明路径,由桥接层如实上报。
 */
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

const write = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`)

function fail(message) {
  write({ type: 'error', message })
  process.exit(1)
}

async function readRequest() {
  const rl = createInterface({ input: process.stdin })
  try {
    for await (const line of rl) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      return JSON.parse(trimmed)
    }
    return null
  } finally {
    rl.close()
  }
}

const req = await readRequest().catch((e) => fail(`invalid request: ${e?.message ?? e}`))
if (!req || typeof req.prompt !== 'string' || req.prompt === '') {
  fail('invalid request: prompt required')
}
if (typeof req.sdkPath !== 'string' || req.sdkPath === '') {
  fail('invalid request: sdkPath required')
}

let query
try {
  const mod = await import(pathToFileURL(req.sdkPath).href)
  query = mod.query
} catch {
  fail(`SDK not found: ${req.sdkPath}`)
}
if (typeof query !== 'function') fail(`SDK not found: ${req.sdkPath}`)

if (typeof req.configDir === 'string' && req.configDir !== '') {
  process.env.QODERCN_CONFIG_DIR = req.configDir
  process.env.QODER_CONFIG_DIR = req.configDir
}

try {
  const messages = query({
    prompt: req.prompt,
    options: {
      auth: { type: 'qodercli' },
      cwd: typeof req.cwd === 'string' && req.cwd !== '' ? req.cwd : process.cwd(),
      pathToQoderCLIExecutable: req.cliPath,
      env: {
        QODERCN_CONFIG_DIR: req.configDir,
        QODER_CONFIG_DIR: req.configDir,
      },
      model: typeof req.model === 'string' && req.model !== '' ? req.model : 'auto',
    },
  })
  for await (const message of messages) {
    write(message)
    if (message && typeof message === 'object' && message.type === 'result') break
  }
  process.exit(0)
} catch (e) {
  fail(`query failed: ${e?.message ?? String(e)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
