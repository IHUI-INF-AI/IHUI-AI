// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * psql 客户端定位共用层的镜像测试(G-815987,2026-10-07 / §22c)。
 * 跑法:node --test scripts/tests/psql-client-locate.test.mjs
 *
 * 纯度边界:候选序、版本取最大、全落空清单全部用**构造面**证明(fixture 目录造假 bin 结构),
 * 不赌本机此刻装没装 PG、不起任何子进程(PATH 档的探针可注入)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { locatePsqlClient, psqlLocateMissText } from '../lib/psql-client-locate.mjs'

/** 在 root 下造 `<版本>/bin/psql.exe` 结构(空文件即可,定位层只做 existsSync)。 */
function makePgRoot(root, versions) {
  for (const v of versions) {
    const bin = join(root, v, 'bin')
    mkdirSync(bin, { recursive: true })
    writeFileSync(join(bin, 'psql.exe'), '')
  }
  return root
}

test('候选①:$IHUI_PSQL 在位即命中,不再往下探', () => {
  const dir = mkScratch('psql-locate-t1')
  try {
    const psql = join(dir, 'explicit', 'psql.exe')
    mkdirSync(join(dir, 'explicit'), { recursive: true })
    writeFileSync(psql, '')
    const r = locatePsqlClient({ IHUI_PSQL: psql }, { programFilesRoot: join(dir, 'nope'), pathProbe: () => false })
    assert.equal(r.psql, psql)
    assert.equal(r.tried.length, 1)
    assert.match(r.tried[0], /\$IHUI_PSQL,在位\)$/)
  } finally {
    rmScratch(dir)
  }
})

test('候选①缺 → 候选②:$PG_CLIENT_DIR/psql.exe 在位命中', () => {
  const dir = mkScratch('psql-locate-t2')
  try {
    const clientDir = join(dir, 'client')
    mkdirSync(clientDir, { recursive: true })
    writeFileSync(join(clientDir, 'psql.exe'), '')
    const r = locatePsqlClient({ PG_CLIENT_DIR: clientDir }, { programFilesRoot: join(dir, 'nope'), pathProbe: () => false })
    assert.equal(r.psql, join(clientDir, 'psql.exe'))
    assert.ok(r.tried.some((t) => t.includes('$PG_CLIENT_DIR,在位)')))
  } finally {
    rmScratch(dir)
  }
})

test('候选③:自动探测按版本号数值取最大 —— 9.6 与 18 并存必须 18 胜(字典序反向锁)', () => {
  const dir = mkScratch('psql-locate-t3')
  try {
    const pgRoot = makePgRoot(join(dir, 'pf'), ['9.6', '18'])
    const r = locatePsqlClient({}, { programFilesRoot: pgRoot, pathProbe: () => false })
    assert.equal(r.psql, join(pgRoot, '18', 'bin', 'psql.exe'), `'9.6' > '18' 按字典序成立,会抢走安装位;必须数值比较`)
  } finally {
    rmScratch(dir)
  }
})

test('候选③根不可读 → 按"没有版本目录"处理,不抛异常;候选④约定档兜底', () => {
  const dir = mkScratch('psql-locate-t4')
  try {
    const legacy = join(dir, 'legacy', 'psql.exe')
    mkdirSync(join(dir, 'legacy'), { recursive: true })
    writeFileSync(legacy, '')
    const r = locatePsqlClient({}, { programFilesRoot: join(dir, 'nope'), legacyPath: legacy, pathProbe: () => false })
    assert.equal(r.psql, legacy)
    assert.ok(r.tried.some((t) => t.includes('约定档,在位)')))
  } finally {
    rmScratch(dir)
  }
})

test('候选④缺 → 候选⑤:PATH 实探命中给裸 psql', () => {
  const dir = mkScratch('psql-locate-t5')
  try {
    const r = locatePsqlClient({}, { programFilesRoot: join(dir, 'nope'), legacyPath: join(dir, 'nope2', 'psql.exe'), pathProbe: () => true })
    assert.equal(r.psql, 'psql')
    assert.ok(r.tried.some((t) => t.includes('PATH,在位)')))
  } finally {
    rmScratch(dir)
  }
})

test('全落空:psql=null,tried 逐条留痕,结论句逐字含「不代表本机没有 PostgreSQL 服务」', () => {
  const dir = mkScratch('psql-locate-t6')
  try {
    const r = locatePsqlClient({}, { programFilesRoot: join(dir, 'nope'), legacyPath: join(dir, 'nope2', 'psql.exe'), pathProbe: () => false })
    assert.equal(r.psql, null)
    // 五档候选里,env 未给的不算"试过":此处 env 全空 ⇒ PG_CLIENT_DIR 档跳过,其余三档必须留痕
    assert.ok(r.tried.length >= 3, `tried 应覆盖 自动探测/约定档/PATH 三档,实得 ${r.tried.length}`)
    const miss = psqlLocateMissText(r.tried)
    assert.ok(miss.includes('未找到 psql 客户端(不代表本机没有 PostgreSQL 服务)'), '结论句必须把"定位失败"与"服务缺席"分开')
    assert.ok(miss.includes(r.tried.join(' | ')), '试过的候选必须逐条在场')
    assert.ok(miss.includes('IHUI_PSQL'), '结论句要指路可用的 env')
  } finally {
    rmScratch(dir)
  }
})

test('真机态兜底:自动探测根不存在 + PATH 真探针,全程不抛异常', () => {
  // 本测试只证明"不抛异常":命中与否随机器态而异(§22c 不赌机器态),只证探测层自身零异常、结构完整
  const r = locatePsqlClient({}, { programFilesRoot: 'G:/IHUI-AI/.ihui-agent/tmp/g815987-nope' })
  assert.ok(r.psql === null || typeof r.psql === 'string')
  assert.ok(Array.isArray(r.tried) && r.tried.length >= 3)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
