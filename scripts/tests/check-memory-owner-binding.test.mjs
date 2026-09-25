// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-memory-owner-binding.mjs 的镜像测试。
 *
 * §22c 的"镜像常量"形态在这里**不需要**:源文件带 §22d 的 isDirectRun 守卫并直接 export
 * 判据函数,所以测试直接 import —— 两份真相只会带来漂移,不复制品判据。
 *
 * 每条正向判定配一条反向对照,重点是两类"看起来有、其实没有"的失效型:
 *   - 只认 Query 形态 ⇒ 所有 POST(Pydantic Field)整片隐身;
 *   - 对齐出口只写在注释里 ⇒ 自称已拆、实际没拆。
 * 另含两条**装车证明**(本仓最高频故障是"造好没接线"):runner 注册块必须在位且定级已升 blocking,
 * 以及 `--strict` 升档必须真能判红(否则"存量清零后升 blocking"永远升不上去)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import {
  scanSource,
  scanForwarders,
  decide,
  report,
} from '../check-memory-owner-binding.mjs'

const ROOT = resolve(import.meta.dirname, '../..')

const PY_QUERY_UNBOUND = `
@router.get("/api/memory/recall")
async def recall(user_id: str = Query(...), query: str = Query(...)):
    return await memory_service.recall(user_id, query)
`
const PY_FIELD_UNBOUND = `
class SaveReq(BaseModel):
    user_id: str = Field(..., description="用户 ID(UUID)")
    content: str = Field(...)
`
const PY_BOUND = `
from app.core.jwt_auth import require_request_user_id

@router.get("/api/memory/recall")
async def recall(query: str = Query(...), principal: str = Depends(require_request_user_id)):
    return await memory_service.recall(principal, query)
`
const PY_ALIGN_IN_COMMENT_ONLY = `
# from app.core.jwt_auth import require_request_user_id   <-- 只在注释里出现一次
@router.get("/api/memory/list")
async def lst(user_id: str = Query(...)):
    return await svc.list(user_id)
`
const PY_NO_ID = `
@router.get("/api/ping")
async def ping(q: str = Query(...)):
    return await svc.ping(q)
`

test('M1 Query 形态被认出并判未对齐', () => {
  const b = scanSource('memory.py', PY_QUERY_UNBOUND)
  assert.ok(b, '不收 user_id 才该返回 null')
  assert.deepEqual(b.forms, ['Query'])
  assert.equal(b.aligned, false)
  assert.ok(b.lines.includes(3), '必须给出可定位的行号')
})

test('M2 Pydantic Field 形态也必须被认出 —— 只认 Query 会让整类 POST 端点隐身', () => {
  const b = scanSource('memory.py', PY_FIELD_UNBOUND)
  assert.ok(b, 'Field 形态未认出 = 判据对该形态全盲')
  assert.deepEqual(b.forms, ['Field'])
  assert.equal(b.aligned, false)
})

test('M3 两形态同时在场要都记(不得只报第一条)', () => {
  const b = scanSource('m.py', PY_QUERY_UNBOUND + '\n' + PY_FIELD_UNBOUND)
  assert.ok(b.forms.includes('Query') && b.forms.includes('Field'), `实际=${b.forms}`)
})

test('M4 反向对照:既收 user_id 又与令牌主体比对的文件不得计为未对齐', () => {
  // 真·修法形状:入参保留做兼容,但先与 principal 比对,不等即 403。
  const src = `
from app.core.jwt_auth import require_request_user_id

class SaveReq(BaseModel):
    user_id: str = Field(..., description="用户 ID(UUID)")
    content: str = Field(...)

@router.post("/api/memory/save")
async def save(req: SaveReq, principal: str = Depends(require_request_user_id)):
    if req.user_id != principal:
        raise HTTPException(status_code=403, detail="user_id 与令牌主体不一致")
    return await memory_service.save(req)
`
  const b = scanSource('m.py', src)
  assert.ok(b, '它确实收 user_id(Field),应被扫到')
  assert.equal(b.aligned, true, '已对齐却被判未对齐 = 假红,会逼人绕过钩子')
  // 另一侧:端点根本不收 user_id(只用 principal)→ 返回 null,不得凭空造条目
  assert.equal(scanSource('n.py', PY_BOUND), null)
})

test('M5 反向对照:对齐出口只写在注释里 = 等于没写(自称已拆实际没拆那一型)', () => {
  const b = scanSource('c.py', PY_ALIGN_IN_COMMENT_ONLY)
  assert.ok(b, '它确实收 user_id')
  assert.equal(b.aligned, false, '注释里的 import 不得被当成对齐证据')
})

test('M6 不收 user_id 的文件返回 null(不产噪声条目)', () => {
  assert.equal(scanSource('p.py', PY_NO_ID), null)
})

test('M7 空枚举判"无法判定"而不是记绿 —— 判据失明不是通过', () => {
  const d = decide({ bindings: [], unbound: [], undetermined: [], strict: false, scannedFiles: 0 })
  assert.equal(d.code, 2)
  assert.match(d.undeterminedOut.join('|'), /判据失明/)
})

test('M8 有文件但不收 user_id ⇒ 正常 0(与空枚举必须区分开)', () => {
  assert.equal(decide({ bindings: [], unbound: [], undetermined: [], strict: false, scannedFiles: 12 }).code, 0)
})

test('M9 默认档未对齐不判红;--strict 必须判红(升级路径没牙 = 永远升不上去)', () => {
  const b = scanSource('m.py', PY_QUERY_UNBOUND)
  assert.equal(decide({ bindings: [b], unbound: [b], undetermined: [], strict: false, scannedFiles: 5 }).code, 0)
  assert.equal(decide({ bindings: [b], unbound: [b], undetermined: [], strict: true, scannedFiles: 5 }).code, 1)
})

test('M10 decide 不得改动投入参的 undetermined(多条用例共用一份数组时会互相咬)', () => {
  const shared = []
  decide({ bindings: [], unbound: [], undetermined: shared, strict: false, scannedFiles: 0 })
  assert.equal(shared.length, 0, '被就地 push = 污染调用方')
})

test('M11 转发面:原样透传客户端 body 才进清单;已换成服务端身份的不进', () => {
  const passthrough = scanForwarders(
    () => `forwardAiService(reply, '/api/memory/save', jsonInit(parsed.data), (d) => d)`,
    ['v1.ts'],
  )
  assert.equal(passthrough.length, 1)
  assert.equal(passthrough[0].path, '/api/memory/save')
  const serverOwned = scanForwarders(
    () => `forwardAiService(reply, '/api/memory/save', jsonInit({ user_id: request.userId }), (d) => d)`,
    ['m.ts'],
  )
  assert.equal(serverOwned.length, 0, '服务端自绑的行径被列进"客户端自报"清单 = 夸大爆炸半径')
})

test('M12 报告必须同时给出"已对齐/未对齐"两个数与透传清单(只报一个数就是半瞎)', () => {
  const b = scanSource('m.py', PY_QUERY_UNBOUND)
  const f = scanForwarders(() => `forwardAiService(reply, '/api/memory/save', jsonInit(parsed.data), x)`, ['v1.ts'])
  const r = report({ bindings: [b], unbound: [b], forwards: f, undetermined: [], face: 'head', strict: false }).join('\n')
  assert.match(r, /已对齐令牌主体\*\*\s*0\s*个/)
  assert.match(r, /未对齐\*{0,2}\s*1\s*个/)
  assert.match(r, /透传/)
})

test('M13 装车证明:runner 里真有本门条目,且定级已升 blocking(前置=存量归零)', () => {
  const runner = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const i = runner.indexOf("script: 'check-memory-owner-binding.mjs'")
  assert.ok(i > 0, '本门未接进守门链 = 造好没装车')
  const block = runner.slice(Math.max(0, i - 800), i + 900)
  // 升档的正当性只有"HEAD 面未对齐 = 0"这一条能给;若它回潮,本断言就是提醒先去清偿,
  // 而不是把定级降回 warn(降档 = 把已经收口的敞口重新打开)。
  assert.match(block, /mode:\s*'blocking'/, '存量归零后必须保持 blocking —— 退回 warn 等于放开新增敞口')
  assert.match(block, /args:\s*\[['"]--strict['"]\]/, "runner 必须带 --strict,否则脚本默认档不判红('接了 blocking 却是绿的'")
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_MEMORY_OWNER_BINDING'/, '应急出口命名必须与门一致')
  assert.match(block, /stagedTriggers:[^]*?apps\/ai-service/, '触发面必须覆盖被审的 ai-service 路由目录')
  // 方向性对照:未注册/未升档时上面两条必须拿不到 —— 否则本条装车证明是恒真的
  assert.ok(!/mode:\s*'warn'/.test(runner.slice(i - 400, i + 60)), '本门就近不得再写 warn')
})

test('M14 根 package.json 有手动入口(问责出口必须存在)', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  assert.ok(pkg.scripts['check:memory-owner'], '缺手动入口 → 想查的人无从下手')
  assert.match(pkg.scripts['check:memory-owner'], /--strict/, '手动入口应默认走 strict 档(它是问责出口,不是报数)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
