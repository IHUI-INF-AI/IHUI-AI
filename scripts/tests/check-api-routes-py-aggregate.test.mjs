// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildPyIncludeMaps,
  extractFastApiRegistrations,
  __test__,
} from '../lib/route-registration-extract.mjs'

// 镜像测试:守门 8(check-api-routes)FastAPI **二级聚合挂载图** 扩图(2026-11-08 P2)
//
// 生产形态(逐字复刻 apps/ai-service/app/main.py + app/api/v1/router.py +
// app/api/v1/sag2_lexical.py 的真实挂载链):
//   app.include_router(api_v1_router, prefix="/api/v1")        ← 聚合对象挂到根
//   api_v1_router.include_router(sag2_lexical.router,          ← 挂载对象非 app 的二级聚合
//       prefix="/ai/sag2")
//   @router.get("/status") ...                                  ← 叶文件装饰器
//   真路径 = /api/v1 + /ai/sag2 + /status
//
// 旧 buildPyIncludeMaps 的 PY_INCLUDE_A/B 只认 `app.include_router(...)`,这一族整片
// 落在裸 localPath 上 ⇒ 前端 6 个真调用被 ignore 台账豁免(假阳性)。
//
// 单一真相源:本文件只 import 源脚本的公开函数 / __test__ 导出,**不重抄**任何判据实现。
// 夹具只是输入数据(生产形态的复刻),不是第二份判据 —— 判据退回旧版 T1/T4/T5 会翻红。
//
// 覆盖面:
//   T0 单源锁:__test__ 导出与公开 import 同一引用
//   T1 正向(生产二级聚合形态):6 端点路径逐字等于 /api/v1/ai/sag2/*
//   T2 反向(注释掉 include):不得产出 /api/v1/ai/sag2 前缀(恒真锁)
//   T3 反向(换成别的调用 add_api_route):同上
//   T4 变异·改 prefix:/ai/sag2 → /ai/sag2-v2 ⇒ 路径随之变(证明随输入变化)
//   T5 变异·三级聚合:插一层 mid_agg ⇒ 路径多 /deep 段
//   T6 生产退回锁:源码里多级聚合段/通用边正则不得被删
//   T7 真实盘面(在面上时):直接读三个生产文件复验 T1

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const LIB = join(HERE, '..', 'lib', 'route-registration-extract.mjs')
const MAIN = 'apps/ai-service/app/main.py'
const ROUTER = 'apps/ai-service/app/api/v1/router.py'
const SAG2 = 'apps/ai-service/app/api/v1/sag2_lexical.py'

const MAIN_SRC = `from app.api.v1.router import api_v1_router
app.include_router(api_v1_router, prefix="/api/v1")
`
const SAG2_SRC = `from fastapi import APIRouter
router = APIRouter()
@router.get("/status")
async def status(): ...
@router.post("/documents")
async def add(): ...
@router.delete("/documents")
async def remove(): ...
@router.post("/search")
async def search(): ...
@router.post("/retrieve")
async def retrieve(): ...
@router.post("/fuse")
async def fuse(): ...
`

/** 生产形态夹具:router.py 的 include 行可替换(变异/反向),其余与真实链同形 */
function mkFace({
  includeLine = 'api_v1_router.include_router(sag2_lexical.router, prefix="/ai/sag2")',
  mid = null,
} = {}) {
  const routerSrc = `from fastapi import APIRouter
from . import sag2_lexical
${mid ? 'from .mid import mid_agg' : ''}
api_v1_router = APIRouter()
${includeLine}
`
  const map = new Map([
    [MAIN, MAIN_SRC],
    [ROUTER, routerSrc],
    [SAG2, SAG2_SRC],
  ])
  if (mid) map.set('apps/ai-service/app/api/v1/mid.py', mid)
  return map
}

const pathsOf = (face) =>
  extractFastApiRegistrations(face).entries.map((e) => `${e.method} ${e.path}`)

const SAG2_PREFIX = '/api/v1/ai/sag2/'
const EXPECTED = [
  'DELETE /api/v1/ai/sag2/documents',
  'GET /api/v1/ai/sag2/status',
  'POST /api/v1/ai/sag2/documents',
  'POST /api/v1/ai/sag2/fuse',
  'POST /api/v1/ai/sag2/retrieve',
  'POST /api/v1/ai/sag2/search',
].sort()

test('T0 单一真相源:__test__ 导出与公开 import 同一引用', () => {
  assert.equal(typeof buildPyIncludeMaps, 'function')
  assert.equal(__test__.extractFastApiRegistrations, extractFastApiRegistrations)
})

test('T1 正向·生产二级聚合:6 个 SAG2 端点逐字在册', () => {
  const face = mkFace()
  const { byModule, byFile } = buildPyIncludeMaps(face)
  assert.equal(byFile.get('sag2_lexical'), '/api/v1/ai/sag2')
  assert.equal(byModule.get('apps.ai-service.app.api.v1.sag2_lexical'), '/api/v1/ai/sag2')
  assert.deepEqual(pathsOf(face).filter((p) => p.includes(SAG2_PREFIX)).sort(), EXPECTED)
})

test('T2 反向·注释掉 include:不得产出 /api/v1/ai/sag2 前缀(恒真锁)', () => {
  const face = mkFace({
    includeLine: '# api_v1_router.include_router(sag2_lexical.router, prefix="/ai/sag2")',
  })
  assert.equal(pathsOf(face).filter((p) => p.includes(SAG2_PREFIX)).length, 0)
})

test('T3 反向·换成别的调用:不得产出 /api/v1/ai/sag2 前缀', () => {
  const face = mkFace({ includeLine: 'api_v1_router.add_api_route("/x", lambda: None)' })
  assert.equal(pathsOf(face).filter((p) => p.includes(SAG2_PREFIX)).length, 0)
})

test('T4 变异·改 prefix:/ai/sag2 → /ai/sag2-v2 路径随之变', () => {
  const face = mkFace({
    includeLine: 'api_v1_router.include_router(sag2_lexical.router, prefix="/ai/sag2-v2")',
  })
  const got = pathsOf(face).filter((p) => p.includes('sag2'))
  assert.equal(got.length, 6)
  assert.ok(got.every((p) => p.includes('/api/v1/ai/sag2-v2/')))
  assert.equal(got.filter((p) => p.includes(SAG2_PREFIX)).length, 0)
})

test('T5 变异·三级聚合:插入 mid_agg 层,路径多 /deep 段', () => {
  const mid = `from fastapi import APIRouter
from . import sag2_lexical
mid_agg = APIRouter()
mid_agg.include_router(sag2_lexical.router, prefix="/deep")
`
  const face = mkFace({
    includeLine: 'api_v1_router.include_router(mid_agg, prefix="/ai/sag2")',
    mid,
  })
  const got = pathsOf(face).filter((p) => p.includes('sag2'))
  assert.equal(got.length, 6)
  assert.ok(got.every((p) => p.includes('/api/v1/ai/sag2/deep/')))
})

test('T6 生产退回锁:多级聚合段/通用边正则不得被删', () => {
  const src = readFileSync(LIB, 'utf8')
  assert.match(src, /PY_INCLUDE_EDGE_SRC/)
  assert.match(src, /objectPrefix/)
  assert.match(src, /多级聚合累加/)
})

test('T7 真实盘面(在面上时):直接读三个生产文件复验 T1', (t) => {
  if (!existsSync(join(ROOT, SAG2))) {
    t.skip(`真实 SAG2 文件不在当前面: ${SAG2}`)
    return
  }
  const face = new Map(
    [MAIN, ROUTER, SAG2].map((rel) => [rel, readFileSync(join(ROOT, rel), 'utf8')]),
  )
  assert.deepEqual(pathsOf(face).filter((p) => p.includes(SAG2_PREFIX)).sort(), EXPECTED)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
