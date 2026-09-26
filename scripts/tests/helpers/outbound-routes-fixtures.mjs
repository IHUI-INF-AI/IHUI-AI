// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试夹具:一个**最小真 git 仓**,专门喂给 scripts/check-declared-outbound-routes.mjs。
 *
 * 为什么要有这个文件(而不是在测试里就地拼):
 *   1. 该门把 ROOT 由**脚本自身位置**推导(AGENTS §15),所以 CLI 契约测试必须把门连同它的
 *      **相对 import 闭包**拷进 `<夹具仓>/scripts/` 再按 cwd=夹具仓跑 —— 手抄闭包清单这一坑
 *      已由 scripts/lib/scratch-module-closure.mjs 的注释记录过两次,这里一律走推导。
 *   2. 五个 CLI 用例(T2–T5)共用同一份现场,只在外面改索引/磁盘;搭建逻辑只此一份,
 *      断言差异留在测试里,不留在夹具里。
 *
 * 现场形状(刻意小,且**每条判据都有对应的在位证据**):
 *   - 注册面:Fastify 一条静态 `/api/rules/list`、FastAPI 两条 `/api/rules/execute` + `/api/rules/{rule_id}`
 *     ⇒ 两个解析器都不失明(注册集为 0 时门会判死,那会让端到端测的是一件无关的事)。
 *   - 声明面:hub 路径表 2 条 —— `/api/rules/execute` 命中(证明判据不是恒红)、
 *     `/api/ghost/orchestrate` 未匹配(给 strict 一条真红可点名)。
 *   - 另配一条 `/api/rules/orchestrate` 的**形状陷阱**不在这里,由 --self-test 的 G5b/G5c 打:
 *     夹具里放了 `/api/rules/{rule_id}`,静态声明按严格规则不得被它吞掉。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { copyScriptWithClosure } from '../../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 真仓根(夹具脚本住在 scripts/tests/helpers/) */
export const ROOT = resolve(HERE, '..', '..', '..')
export const SCRIPTS_DIR = join(ROOT, 'scripts')
export const GATE_REL = 'check-declared-outbound-routes.mjs'
export const GIT_BIN = 'git'

/** 未匹配的那条声明(测试用它点名) */
export const GHOST_PATH = '/api/ghost/orchestrate'

const FILES = {
  'apps/api/src/server.ts': [
    "import { ruleRoutes } from './routes/rules.js'",
    "server.register(ruleRoutes, { prefix: '/api' })",
    '',
  ].join('\n'),
  'apps/api/src/routes/rules.ts': [
    'export const ruleRoutes = async (server) => {',
    "  server.get('/rules/list', async () => ([]))",
    '}',
    '',
  ].join('\n'),
  'apps/ai-service/app/main.py': [
    'from fastapi import FastAPI',
    'from app.routers import rules',
    '',
    'app = FastAPI()',
    "app.include_router(rules.router, prefix='/api')",
    '',
  ].join('\n'),
  'apps/ai-service/app/routers/rules.py': [
    "router = APIRouter(prefix='/rules')",
    '',
    "@router.post('/execute')",
    'async def execute():',
    '    return {}',
    '',
    "@router.get('/{rule_id}')",
    'async def read_rule(rule_id: str):',
    '    return {}',
    '',
  ].join('\n'),
  // 声明面:表 + 一次带自家 base 的出站组装(E3),两条声明一条命中一条真未匹配
  'apps/ai-service/app/services/hub.py': [
    '_PILLAR_API_PATHS: dict[str, str] = {',
    '    "rules": "/api/rules/execute",',
    `    "ghost": "${GHOST_PATH}",`,
    '}',
    '',
    '',
    'def _resolve_api_base_url() -> str:',
    '    return "http://localhost:8802"',
    '',
    '',
    'async def _run(pillar: str) -> dict:',
    '    api_path = _PILLAR_API_PATHS.get(pillar)',
    '    base_url = _resolve_api_base_url()',
    '    url = f"{base_url}{api_path}"',
    '    async with aiohttp.ClientSession() as s:',
    '        async with s.post(url) as resp:',
    '            return await resp.json()',
    '',
  ].join('\n'),
}

function git(dir, args) {
  return execFileSync(GIT_BIN, ['-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
}

function put(dir, rel, content) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

/**
 * 只把门本体连同它的**相对 import 闭包**装进 `<dir>/scripts/`(门按自身位置推 ROOT,
 * 不装则它审的是真仓而不是夹具)。清单由 scratch-module-closure 推导,不手抄。
 */
export function installGate(dir) {
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    'lib/outbound-route-facts.mjs',
    'lib/outbound-route-registrations.mjs',
  ])
  return dir
}

/**
 * 在 mkScratch 出来的空目录里搭好现场:源码夹具 + 按 import 闭包拷来的门本体(+ 一次提交)。
 * 门本体必须在 `<dir>/scripts/` 下 —— 它按自身位置推 ROOT,否则它审的是真仓而不是夹具。
 * `commit:false` 用来造"有门、有文件、但没有提交"的仓(该面取不到 ⇒ 门必须判死而不是记绿)。
 */
export function writeRepo(dir, { commit = true } = {}) {
  git(dir, ['init', '-q'])
  git(dir, ['config', 'user.email', 'gate@fixture.local'])
  git(dir, ['config', 'user.name', 'gate-fixture'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  for (const [rel, text] of Object.entries(FILES)) put(dir, rel, text)
  installGate(dir)
  if (commit) {
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'fixture'])
  }
  return dir
}

export function gateScriptPath(dir) {
  return join(dir, 'scripts', GATE_REL)
}

/** 跑门的 CLI,返回 { code, out };非零退出不是异常,是被测行为本身 */
export function runGate(dir, args = []) {
  try {
    const out = execFileSync(process.execPath, [gateScriptPath(dir), ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e?.status ?? -1, out: String(e?.stdout || '') + String(e?.stderr || '') }
  }
}

export { git as gitIn, put as putFile }
export const FIXTURE_FILES = Object.keys(FILES)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
