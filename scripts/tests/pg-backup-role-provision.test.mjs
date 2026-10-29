// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-70(2026-10-27)镜像测试:scripts/pg-backup-role-provision.mjs 的幂等建制判据。
//
// 立因:该工具是"换机后 PG 18.6 无 beifen 只读角色"的仓内那一半出口。它自己也可能退化成
// "看着跑过、其实没落"的尺子,故每条判据都成对:
//   ① 计划器:全新 ⇒ 三条语句且顺序固定;收敛态 ⇒ **零语句**(幂等第二跑不写东西);
//      漂移态 ⇒ 只补差值且**不碰口令**(默认绝不覆盖既有凭据);
//   ② 主流程三态:无连接 / 缺口令 / psql 不在位 ⇒ 一律 exit 2 且文案含「未判定」,
//      绝不把"没判"读成"判过了"(§0.3);
//   ③ dry-run 真的一次写都不发(逐条断言执行面的 SQL 全是 SELECT);
//   ④ --apply 落库后必须回读自证:回读不收敛 ⇒ exit 1;落库失败 ⇒ exit 1;
//   ⑤ 形状锁:生成器不含 DROP/DELETE/TRUNCATE/REVOKE(canonical 里也有 REVOKE 字样,
//      所以只锁"生成的 SQL"与源码里的自毁判据,不锁注释);口令取值链是 import 单一实现;
//   ⑥ 权限集漂移锁:ROLE_SPEC 每项都能在 deploy/win/ihui-pg-backup-role.sql 原文里找到。
// 运行:`node --test scripts/tests/pg-backup-role-provision.test.mjs`
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  main,
  planProvisioning,
  convergenceGaps,
  roleAttributeDiffs,
  parseRoleRow,
  parseArgs,
  resolveConnection,
  quoteLiteral,
  redactSql,
  assertSafeSql,
  ROLE_SPEC,
  FORBIDDEN_SQL,
} from '../pg-backup-role-provision.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = readFileSync(join(REPO, 'scripts', 'pg-backup-role-provision.mjs'), 'utf8')
const CANONICAL_SQL = readFileSync(join(REPO, 'deploy', 'win', 'ihui-pg-backup-role.sql'), 'utf8')

const CONVERGED_ROLE = {
  superuser: false,
  login: true,
  createdb: false,
  createrole: false,
  replication: false,
  bypassrls: true,
  inherit: true,
  connlimit: 2,
}
const convergedState = () => ({
  db: 'ihui_dev',
  role: { ...CONVERGED_ROLE },
  memberOfReadAllData: true,
  canConnect: true,
})
const freshState = () => ({
  db: 'ihui_dev',
  role: null,
  memberOfReadAllData: false,
  canConnect: false,
})

// ── 假执行器:按 SQL 文本给出探针应答,并记录"被真正发出去的每一条语句" ──────────
function fakeExec({ stateRef, writeRc = 0, writeStderr = '' }) {
  const sent = []
  const exec = ({ argv }) => {
    const sql = argv[argv.length - 1]
    sent.push({ sql, argv })
    if (/^\s*CREATE ROLE|^\s*ALTER ROLE|^\s*GRANT\b/i.test(sql)) {
      if (writeRc !== 0) return { rc: writeRc, stdout: '', stderr: writeStderr }
      // 落库成功后把"现状"推进到收敛态(回读自证必须看到它)
      stateRef.state = convergedState()
      return { rc: 0, stdout: '', stderr: '' }
    }
    const st = stateRef.state
    if (/SELECT current_database\(\)/.test(sql)) return { rc: 0, stdout: `${st.db}\n`, stderr: '' }
    if (/FROM pg_roles WHERE rolname/.test(sql)) {
      if (!st.role) return { rc: 0, stdout: '', stderr: '' }
      const r = st.role
      const b = (v) => (v ? 't' : 'f')
      return {
        rc: 0,
        stdout: `${b(r.superuser)}|${b(r.login)}|${b(r.createdb)}|${b(r.createrole)}|${b(r.replication)}|${b(r.bypassrls)}|${b(r.inherit)}|${r.connlimit}\n`,
        stderr: '',
      }
    }
    if (/FROM pg_auth_members/.test(sql))
      return { rc: 0, stdout: st.memberOfReadAllData ? '1\n' : '0\n', stderr: '' }
    if (/has_database_privilege/.test(sql))
      return { rc: 0, stdout: st.canConnect ? 't\n' : 'f\n', stderr: '' }
    return { rc: 0, stdout: '', stderr: '' }
  }
  return { exec, sent }
}

const okLocate = () => ({ psql: 'psql-fixture', tried: [] })
const lines = () => {
  const out = []
  const err = []
  return {
    say: (l) => out.push(String(l)),
    warn: (l) => err.push(String(l)),
    stdout: () => out.join('\n'),
    stderr: () => err.join('\n'),
    last: () => out[out.length - 1] || '',
  }
}
const envWithConn = (extra = {}) => ({
  IHUI_PG_SUPERUSER_URL: 'postgresql://postgres@localhost:8810/ihui_dev',
  ...extra,
})
const nullCred = () => ({ null: true, reason: '测试:两个出口都取不到' })
const credOf = (pw) => () => ({ user: 'beifen', password: pw, source: 'env IHUI_DB_BACKUP_*' })

// ── ① 计划器 ────────────────────────────────────────────────────────────────
test('全新实例:三条语句且顺序 = CREATE / GRANT 读 / GRANT 连接', () => {
  const p = planProvisioning(freshState(), { password: 'p'.repeat(8) })
  assert.equal(p.blocked, null)
  assert.equal(p.statements.length, 3)
  assert.match(
    p.statements[0].sql,
    /^CREATE ROLE beifen WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT BYPASSRLS CONNECTION LIMIT 2 PASSWORD '/,
  )
  assert.match(p.statements[1].sql, /^GRANT pg_read_all_data TO beifen$/)
  assert.match(p.statements[2].sql, /^GRANT CONNECT ON DATABASE ihui_dev TO beifen$/)
})

test('建角色缺口令 ⇒ blocked,且不产出一条跑不动的计划', () => {
  const p = planProvisioning(freshState(), {})
  assert.ok(p.blocked && /归机主供值/.test(p.blocked))
  assert.equal(p.statements.length, 0)
})

test('幂等第二跑:已收敛态零写入', () => {
  const p = planProvisioning(convergedState(), { password: null })
  assert.deepEqual(p.statements, [])
  assert.equal(p.blocked, null)
})

test('属性漂移只补差值,且默认不碰口令', () => {
  const st = convergedState()
  st.role = { ...st.role, inherit: false, bypassrls: false, connlimit: -1 }
  assert.deepEqual(
    roleAttributeDiffs(st.role).map((d) => d.key),
    ['bypassrls', 'inherit', 'connlimit'],
  )
  const p = planProvisioning(st, { password: 'IGNORED_PW_42' })
  assert.equal(p.statements.length, 1)
  assert.match(p.statements[0].sql, /^ALTER ROLE beifen WITH BYPASSRLS INHERIT CONNECTION LIMIT 2$/)
  assert.ok(!/PASSWORD/.test(p.statements[0].sql), '默认档不得出现 PASSWORD')
})

test('--set-password 才改口令;缺口令 ⇒ blocked', () => {
  const p = planProvisioning(convergedState(), { password: 'pw', setPassword: true })
  assert.equal(p.statements.length, 1)
  assert.match(p.statements[0].sql, /^ALTER ROLE beifen WITH PASSWORD 'pw'$/)
  assert.ok(planProvisioning(convergedState(), { setPassword: true }).blocked)
})

test('展示面口令打码', () => {
  const p = planProvisioning(freshState(), { password: 'SENTINEL_PW_42' })
  assert.ok(!redactSql(p.statements[0].sql).includes('SENTINEL_PW_42'))
  assert.match(redactSql(p.statements[0].sql), /PASSWORD '\*\*\*'/)
})

test('生成面永不含 DROP/DELETE/TRUNCATE/REVOKE(四种状态 × 两种档)', () => {
  const states = [freshState(), convergedState()]
  const drifted = convergedState()
  drifted.role = {
    ...drifted.role,
    superuser: true,
    login: false,
    createdb: true,
    createrole: true,
    replication: true,
  }
  const noMember = convergedState()
  noMember.memberOfReadAllData = false
  noMember.canConnect = false
  states.push(drifted, noMember)
  for (const st of states) {
    for (const opts of [
      { password: 'x'.repeat(8) },
      { password: 'x'.repeat(8), setPassword: true },
    ]) {
      const p = planProvisioning(st, opts)
      for (const s of p.statements) {
        assert.ok(!FORBIDDEN_SQL.test(s.sql), `生成出禁止动词: ${s.sql}`)
        assert.equal(assertSafeSql(s.sql), s.sql)
      }
    }
  }
  assert.throws(() => assertSafeSql('DROP ROLE beifen'), /判据自毁/)
})

test('收敛判据:四维各自点名(角色/属性/成员/连接)', () => {
  assert.deepEqual(convergenceGaps(convergedState()), [])
  const gaps = convergenceGaps({
    db: 'ihui_dev',
    role: null,
    memberOfReadAllData: false,
    canConnect: false,
  })
  assert.equal(gaps.length, 3)
  assert.match(gaps[0], /仍不存在/)
  const drifted = convergedState()
  drifted.role = { ...drifted.role, bypassrls: false }
  assert.deepEqual(convergenceGaps(drifted), ['属性 bypassrls 未收敛'])
})

test('角色行解析:8 列,空行 = 不存在,列数不符即抛', () => {
  assert.equal(parseRoleRow(''), null)
  assert.equal(parseRoleRow('\n'), null)
  assert.deepEqual(parseRoleRow('f|t|f|f|f|t|t|2\n'), CONVERGED_ROLE)
  assert.throws(() => parseRoleRow('f|t|f'), /形状不符/)
})

test('连接面:DSN 优先 / libpq 单键即认 / 皆无 ⇒ null', () => {
  assert.equal(resolveConnection({}), null)
  assert.equal(resolveConnection({ PGHOST: 'localhost' }).source, 'libpq env(PGHOST)')
  assert.equal(
    resolveConnection({ IHUI_PG_SUPERUSER_URL: 'postgresql://u@h/db', PGHOST: 'x' }).dsn,
    'postgresql://u@h/db',
  )
})

// ── ② 主流程三态:一律 exit 2 且说「未判定」 ────────────────────────────────
test('无超管连接信息 ⇒ exit 2 且含「未判定」', () => {
  const l = lines()
  const { exec } = fakeExec({ stateRef: { state: freshState() } })
  const rc = main(
    ['--dry-run'],
    {},
    {
      say: l.say,
      warn: l.warn,
      exec,
      locate: okLocate,
      resolveCredential: credOf('pw'),
      credentialPath: () => null,
    },
  )
  assert.equal(rc, 2)
  assert.match(l.stderr(), /未判定/)
  assert.match(l.stderr(), /IHUI_PG_SUPERUSER_URL/)
})

test('psql 不在位 ⇒ exit 2 且不假装判过', () => {
  const l = lines()
  const { exec } = fakeExec({ stateRef: { state: freshState() } })
  const rc = main(['--dry-run'], envWithConn(), {
    say: l.say,
    warn: l.warn,
    exec,
    locate: () => ({ psql: null, tried: ['C:/x/psql.exe(缺)'] }),
    resolveCredential: credOf('pw'),
    credentialPath: () => null,
  })
  assert.equal(rc, 2)
  assert.match(l.stderr(), /未判定/)
  assert.match(l.stderr(), /未找到 psql 客户端/)
})

test('建角色而两出口都取不到口令 ⇒ exit 2,点名归机主供值', () => {
  const l = lines()
  const { exec } = fakeExec({ stateRef: { state: freshState() } })
  const rc = main(['--dry-run'], envWithConn(), {
    say: l.say,
    warn: l.warn,
    exec,
    locate: okLocate,
    resolveCredential: nullCred,
    credentialPath: () => 'F:/x/密钥/db-backup/ihui-backup.txt',
  })
  assert.equal(rc, 2)
  assert.match(l.stdout(), /归机主供值/)
  assert.match(l.stdout(), /db-backup\/ihui-backup\.txt/)
  assert.match(l.stdout(), /\[缺口\]/)
})

test('未知开关 / 多余位置参数 ⇒ exit 2', () => {
  assert.equal(main(['--nope'], {}, {}), 2)
  assert.equal(main(['extra'], {}, {}), 2)
  assert.equal(main(['--role'], {}, {}), 2)
})

// ── ③ dry-run 真的一次写都不发 ──────────────────────────────────────────────
test('dry-run:执行面全是 SELECT,计划含 CREATE,exit 0,末行 state=planned', () => {
  const l = lines()
  const stateRef = { state: freshState() }
  const { exec, sent } = fakeExec({ stateRef })
  const rc = main(['--dry-run'], envWithConn(), {
    say: l.say,
    warn: l.warn,
    exec,
    locate: okLocate,
    resolveCredential: credOf('pw12345678'),
    credentialPath: () => null,
  })
  assert.equal(rc, 0)
  assert.ok(sent.length >= 2)
  for (const s of sent) assert.match(s.sql, /^\s*SELECT\b/i, `dry-run 发出了非 SELECT: ${s.sql}`)
  assert.match(l.stdout(), /CREATE ROLE beifen .*PASSWORD '\*\*\*'/)
  assert.ok(!l.stdout().includes('pw12345678'), 'dry-run 输出不得出现口令')
  assert.match(l.last(), /^PROVISION-RESULT state=planned statements=3 mode=dry-run/)
  // DSN 必须真的传给 psql(否则探针会连到默认实例上,判据面就换了)
  for (const s of sent)
    assert.ok(
      s.argv.includes('-d') && s.argv.includes('postgresql://postgres@localhost:8810/ihui_dev'),
    )
})

test('dry-run 在收敛态:零语句、exit 0、末行 statements=0', () => {
  const l = lines()
  const stateRef = { state: convergedState() }
  const { exec, sent } = fakeExec({ stateRef })
  const rc = main(['--dry-run'], envWithConn(), {
    say: l.say,
    warn: l.warn,
    exec,
    locate: okLocate,
    resolveCredential: nullCred,
    credentialPath: () => null,
  })
  assert.equal(rc, 0)
  assert.match(l.last(), /^PROVISION-RESULT state=planned statements=0/)
  for (const s of sent) assert.match(s.sql, /^\s*SELECT\b/i)
})

// ── ④ --apply:落库 + 回读自证 ───────────────────────────────────────────────
test('--apply 落库并在回读收敛后报 converged', () => {
  const l = lines()
  const stateRef = { state: freshState() }
  const { exec, sent } = fakeExec({ stateRef })
  const rc = main(['--apply'], envWithConn({ IHUI_DB_BACKUP_PASSWORD: 'pw' }), {
    say: l.say,
    warn: l.warn,
    exec,
    locate: okLocate,
    resolveCredential: credOf('pw'),
    credentialPath: () => null,
  })
  assert.equal(rc, 0, l.stderr())
  const writes = sent.filter((s) => !/^\s*SELECT\b/i.test(s.sql))
  assert.equal(writes.length, 1, '三条语句必须并成一次 psql 调用(一个隐式事务)')
  assert.match(writes[0].sql, /^CREATE ROLE beifen/)
  assert.match(writes[0].sql, /GRANT pg_read_all_data TO beifen;/)
  assert.match(writes[0].sql, /GRANT CONNECT ON DATABASE ihui_dev TO beifen;$/)
  assert.ok(!FORBIDDEN_SQL.test(writes[0].sql))
  assert.match(l.last(), /^PROVISION-RESULT state=converged statements=3 mode=apply/)
})

test('--apply 落库返回非 0 ⇒ exit 1,且不改口说成功', () => {
  const l = lines()
  const stateRef = { state: freshState() }
  const { exec } = fakeExec({ stateRef, writeRc: 1, writeStderr: 'ERROR: must be superuser' })
  const rc = main(['--apply'], envWithConn(), {
    say: l.say,
    warn: l.warn,
    exec,
    locate: okLocate,
    resolveCredential: credOf('pw'),
    credentialPath: () => null,
  })
  assert.equal(rc, 1)
  assert.match(l.stderr(), /落库失败/)
  assert.ok(!l.stdout().includes('state=converged'))
})

test('--apply 落库成功但回读不收敛 ⇒ exit 1 并逐条点名', () => {
  const l = lines()
  const stateRef = { state: freshState() }
  // 写成功但不推进状态 —— 回读必须把"没落成"说出来
  const { exec } = fakeExec({ stateRef })
  const stuck = ({ argv }) => {
    const sql = argv[argv.length - 1]
    if (/^\s*CREATE ROLE|^\s*ALTER ROLE|^\s*GRANT\b/i.test(sql))
      return { rc: 0, stdout: '', stderr: '' }
    if (/current_database/.test(sql)) return { rc: 0, stdout: 'ihui_dev\n', stderr: '' }
    if (/FROM pg_roles WHERE rolname/.test(sql)) return { rc: 0, stdout: '', stderr: '' }
    if (/FROM pg_auth_members/.test(sql)) return { rc: 0, stdout: '0\n', stderr: '' }
    return { rc: 0, stdout: 'f\n', stderr: '' }
  }
  const rc = main(['--apply'], envWithConn(), {
    say: l.say,
    warn: l.warn,
    exec: stuck,
    locate: okLocate,
    resolveCredential: credOf('pw'),
    credentialPath: () => null,
  })
  assert.equal(rc, 1)
  assert.match(l.stderr(), /回读仍不收敛/)
  assert.match(l.stderr(), /仍不存在/)
  void exec
})

test('--json 输出机器可读且同样打码', () => {
  const l = lines()
  const stateRef = { state: freshState() }
  const { exec } = fakeExec({ stateRef })
  const rc = main(['--dry-run', '--json'], envWithConn(), {
    say: l.say,
    warn: l.warn,
    exec,
    locate: okLocate,
    resolveCredential: credOf('SENTINEL_PW_42'),
    credentialPath: () => null,
  })
  assert.equal(rc, 0)
  const j = JSON.parse(l.stdout())
  assert.equal(j.mode, 'dry-run')
  assert.equal(j.roleExists, false)
  assert.ok(!l.stdout().includes('SENTINEL_PW_42'))
  assert.equal(j.credential.len, 'SENTINEL_PW_42'.length)
})

// ── ⑤⑥ 源码形状锁 ──────────────────────────────────────────────────────────
test('形状锁:口令取值链 import 单一实现,不自立门户', () => {
  assert.match(SRC, /import \{ resolveCredential \} from '\.\/pg-restore-drill\.mjs'/)
  assert.ok(!/readFileSync\([^)]*ihui-backup\.txt/.test(SRC), '不得自己读写凭据文件')
  assert.ok(!/writeFileSync/.test(SRC), '本工具不写任何文件(不造凭据)')
})

test('形状锁:默认 dry-run(默认值不是 apply)', () => {
  assert.equal(parseArgs([]).apply, false)
  assert.equal(parseArgs(['--apply']).apply, true)
  assert.equal(parseArgs(['--apply', '--dry-run']).apply, false)
  assert.match(SRC, /if \(!opts\.apply\)/)
})

test('漂移锁:ROLE_SPEC 每一项都能在 canonical SQL 原文里找到', () => {
  assert.match(CANONICAL_SQL, new RegExp(`CONNECTION LIMIT ${ROLE_SPEC.connlimit}`))
  for (const dial of ROLE_SPEC.login ? ['LOGIN'] : ['NOLOGIN'])
    assert.ok(CANONICAL_SQL.includes(dial))
  for (const name of ['NOSUPERUSER', 'NOCREATEDB', 'NOCREATEROLE', 'NOREPLICATION', 'INHERIT']) {
    assert.ok(CANONICAL_SQL.includes(name), `canonical SQL 缺 ${name}`)
  }
  assert.ok(CANONICAL_SQL.includes(`ALTER ROLE ${ROLE_SPEC.name} BYPASSRLS`))
  assert.ok(CANONICAL_SQL.includes(`GRANT ${ROLE_SPEC.readAllDataRole} TO ${ROLE_SPEC.name}`))
  assert.ok(CANONICAL_SQL.includes(`GRANT CONNECT ON DATABASE ihui_dev TO ${ROLE_SPEC.name}`))
  // 由 ROLE_SPEC 反推出的建角色语句,与 canonical 的 ALTER 段逐项同义(不比对全文,只比对词元集合)
  const p = planProvisioning(freshState(), { password: 'x'.repeat(8) })
  for (const token of [
    'LOGIN',
    'NOSUPERUSER',
    'NOCREATEDB',
    'NOCREATEROLE',
    'NOREPLICATION',
    'INHERIT',
    'BYPASSRLS',
    `CONNECTION LIMIT ${ROLE_SPEC.connlimit}`,
  ]) {
    assert.ok(p.statements[0].sql.includes(token), `建角色语句缺 ${token}`)
  }
})

test('形状锁:canonical 文件仍是一次性载体 —— 本工具存在的理由还在', () => {
  // canonical 若哪天自己改成幂等(IF NOT EXISTS / DO 块),本工具的理由就消失,这条会提醒复核
  assert.match(CANONICAL_SQL, /一次性建制,故不用 DO\/EXECUTE 包一层幂等/)
  assert.match(CANONICAL_SQL, /^CREATE ROLE beifen;$/m)
})

test('单引号转义:口令含单引号不得拼出注入', () => {
  assert.equal(quoteLiteral("a'b"), "'a''b'")
  const p = planProvisioning(freshState(), { password: "x' OR 1=1 --" })
  assert.match(p.statements[0].sql, /PASSWORD 'x'' OR 1=1 --'$/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
