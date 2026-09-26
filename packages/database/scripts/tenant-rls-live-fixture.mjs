// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13 第二格的**夹具与判据层**(被 tenant-rls-live-check.mjs 使用,也被镜像测试直接 import)。
 *
 * 为什么单独成文件:AGENTS §11e 给新建文件立了 800 行上限,而本票的"夹具 × 判据矩阵"
 * 与"集群生命周期"是两件不同的事 —— 拆开之后,判据层可以脱离真实数据库被单测(镜像测试
 * 在 CI 上没有 PG 也要能核 judgeOne 有没有牙),生命周期层才需要真二进制。
 *
 * 与 §22c 的关系:judgeOne 是本文件**唯一**的断言实现,tenant-rls-live-check.mjs 与
 * tests/tenant-rls-live.test.ts 都 import 它;禁止在任何一侧再抄一份"看起来一样"的判据。
 *
 * 夹具的三个设计约束(违反任何一条,判据就变成自证的空话):
 *  1. 每个主体的"应见行集"写在 expectedIds() 里,是**期望值**,不从库里读;
 *     库里读回来的是实际值。两者不等即 FAIL —— 反过来若期望值也从库里读,整轮判据恒绿。
 *  2. 全局语料(owner_uuid='')与公开笔记(is_public=true)按迁移头注是**刻意保留**的
 *     无主体读路径,不参与 fail-closed 判据(见 allTenantIds 的剔除),但由 S3/S4/S5/S6
 *     四条判据单独核对。把这两支混进"C 判据"会得到一台出生即红的门。
 *  3. 每个主体的行集必须**互不相同且都非空**,否则"看不到别人的行"这一类判据在空表上
 *     也会通过(守门 77/105 那条"空扫不报绿"的同型要求)。
 */
import { randomUUID } from 'node:crypto'

import { TENANT_RLS_TABLES } from './tenant-rls-policy-check.mjs'

/** 两个被审主体角色的名字。属主角色是 FORCE 判据的唯一载体(见 tenant-rls-live-check.mjs 头注)。 */
export const OWNER_ROLE = 'ihui_rls_owner'
export const MEMBER_ROLE = 'ihui_rls_member'

/* =================================================================== *
 * 2) 夹具:四个主体 + 三个空间 + 八张表的锚点行
 *    身份设计刻意覆盖迁移里三支**不同形状**的可见性来源:
 *      created_by 命中 / space_member 命中 / team_members 命中(owner|admin|member × visibility)
 *    以及两支"故意比应用层严"的分支(zhs 的 owner_uuid='' 只在读侧、notes 的公开面只在读侧)。
 * =================================================================== */

export const U1 = '11111111-1111-1111-1111-111111111111'
export const U2 = '22222222-2222-2222-2222-222222222222'
export const U3 = '33333333-3333-3333-3333-333333333333'
export const U4 = '44444444-4444-4444-4444-444444444444'
const T1 = 'aaaa0000-0000-0000-0000-000000000001'
const T2 = 'aaaa0000-0000-0000-0000-000000000002'
export const SP1 = 'bbbb0000-0000-0000-0000-000000000001'
export const SP2 = 'bbbb0000-0000-0000-0000-000000000002'
export const SP3 = 'bbbb0000-0000-0000-0000-000000000003'
const IT1 = 'cccc0000-0000-0000-0000-000000000001'
const IT2 = 'cccc0000-0000-0000-0000-000000000002'
const IT3 = 'cccc0000-0000-0000-0000-000000000003'
const RV1 = 'dddd0000-0000-0000-0000-000000000001'
const RV2 = 'dddd0000-0000-0000-0000-000000000002'
const RV3 = 'dddd0000-0000-0000-0000-000000000003'
const UM1 = 'eeee0000-0000-0000-0000-000000000001'
const UM2 = 'eeee0000-0000-0000-0000-000000000002'
const IF1 = 'ffff0000-0000-0000-0000-000000000001'
const IF2 = 'ffff0000-0000-0000-0000-000000000002'
export const NO1 = '00001111-1111-1111-1111-111111111111'
export const NO2 = '00002222-2222-2222-2222-222222222222'
export const NO3 = '00003333-3333-3333-3333-333333333333' // U2 的公开笔记:测"公开面只读不写"那一支

/** 每张表"属于 U1 的行"与"属于 U2 的行"的锚点 —— 跨租户断言就打在这两个 id 上。 */
export const TABLE_ANCHORS = Object.freeze({
  team_knowledge_spaces: { u1: SP1, u2: SP2 },
  team_knowledge_items: { u1: IT1, u2: IT2 },
  team_knowledge_revisions: { u1: RV1, u2: RV2 },
  zhs_knowledge_doc: { u1: '900001', u2: '900002' },
  zhs_knowledge_chunk: { u1: '910001', u2: '910002' },
  user_memories: { u1: UM1, u2: UM2 },
  image_gen_favorites: { u1: IF1, u2: IF2 },
  notes: { u1: NO1, u2: NO2 },
})

export function seedSql() {
  return `
INSERT INTO public.users (id, username, nickname, status) VALUES
  ('${U1}', 'rls_u1', 'RLS 租户一', 1),
  ('${U2}', 'rls_u2', 'RLS 租户二', 1),
  ('${U3}', 'rls_u3', 'RLS 团队管理员', 1),
  ('${U4}', 'rls_u4', 'RLS 团队成员', 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.teams (id, name, slug, owner_id) VALUES
  ('${T1}', 'RLS Team One', 'rls-team-one', '${U1}'),
  ('${T2}', 'RLS Team Two', 'rls-team-two', '${U2}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_members (team_id, user_id, role) VALUES
  ('${T1}', '${U1}', 'owner'),
  ('${T1}', '${U3}', 'admin'),
  ('${T1}', '${U4}', 'member'),
  ('${T2}', '${U2}', 'owner')
ON CONFLICT (team_id, user_id) DO NOTHING;

INSERT INTO public.team_knowledge_spaces (id, team_id, name, visibility, status, created_by) VALUES
  ('${SP1}', '${T1}', 'SP1 team-visible creator U1', 'team', 'active', '${U1}'),
  ('${SP2}', '${T2}', 'SP2 team-two creator U2', 'team', 'active', '${U2}'),
  ('${SP3}', '${T1}', 'SP3 restricted with U2 as space member', 'restricted', 'active', '${U1}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_knowledge_space_members (space_id, user_id, role) VALUES
  ('${SP3}', '${U2}', 'viewer')
ON CONFLICT (space_id, user_id) DO NOTHING;

INSERT INTO public.team_knowledge_items (id, space_id, kind, title, status, created_by) VALUES
  ('${IT1}', '${SP1}', 'card', 'item in SP1', 'draft', '${U1}'),
  ('${IT2}', '${SP2}', 'card', 'item in SP2', 'draft', '${U2}'),
  ('${IT3}', '${SP3}', 'card', 'item in SP3', 'draft', '${U1}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.team_knowledge_revisions (id, item_id, space_id, revision_no, action, actor_user_id) VALUES
  ('${RV1}', '${IT1}', '${SP1}', 1, 'create', '${U1}'),
  ('${RV2}', '${IT2}', '${SP2}', 1, 'create', '${U2}'),
  ('${RV3}', '${IT3}', '${SP3}', 1, 'create', '${U1}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.zhs_knowledge_doc (id, owner_uuid, title, status) VALUES
  (900001, '${U1}', 'doc of U1', 'active'),
  (900002, '${U2}', 'doc of U2', 'active'),
  (900003, '', 'global corpus doc', 'active')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.zhs_knowledge_chunk (id, doc_id, owner_uuid, chunk_index, content) VALUES
  (910001, 900001, '${U1}', 0, 'chunk of U1'),
  (910002, 900002, '${U2}', 0, 'chunk of U2'),
  (910003, 900003, '', 0, 'chunk of global doc')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('public.zhs_knowledge_doc', 'id'), 900100, false);
SELECT setval(pg_get_serial_sequence('public.zhs_knowledge_chunk', 'id'), 910100, false);

INSERT INTO public.user_memories (id, user_id, memory_type, content) VALUES
  ('${UM1}', '${U1}', 'preference', 'memory of U1'),
  ('${UM2}', '${U2}', 'preference', 'memory of U2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.image_gen_favorites (id, user_id, prompt, image_url) VALUES
  ('${IF1}', '${U1}', 'p1', 'https://example.invalid/u1.png'),
  ('${IF2}', '${U2}', 'p2', 'https://example.invalid/u2.png')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notes (id, user_id, title, content, is_public) VALUES
  ('${NO1}', '${U1}', 'private note of U1', 'body', false),
  ('${NO2}', '${U2}', 'private note of U2', 'body', false),
  ('${NO3}', '${U2}', 'public note of U2', 'body', true)
ON CONFLICT (id) DO NOTHING;

-- harness 自证:夹具行数必须真落进库,否则整轮判据是对着空气打分。
SELECT 'SEED|users=' || (SELECT count(*) FROM public.users WHERE id IN ('${U1}','${U2}','${U3}','${U4}'))
     || '|teams=' || (SELECT count(*) FROM public.teams WHERE id IN ('${T1}','${T2}'))
     || '|spaces=' || (SELECT count(*) FROM public.team_knowledge_spaces)
     || '|items=' || (SELECT count(*) FROM public.team_knowledge_items)
     || '|revisions=' || (SELECT count(*) FROM public.team_knowledge_revisions)
     || '|docs=' || (SELECT count(*) FROM public.zhs_knowledge_doc)
     || '|chunks=' || (SELECT count(*) FROM public.zhs_knowledge_chunk)
     || '|memories=' || (SELECT count(*) FROM public.user_memories)
     || '|favorites=' || (SELECT count(*) FROM public.image_gen_favorites)
     || '|notes=' || (SELECT count(*) FROM public.notes);
`
}

/**
 * 跨租户 UPDATE 判据要写的列**必须真存在** —— 第一轮用了统一的 `updated_at`,而
 * `team_knowledge_revisions` / `image_gen_favorites` 只有 `created_at`,于是那两条判据
 * 量到的是 "column does not exist" 而不是策略行为(现象是 FAIL/无输出,归因会错到 RLS 上)。
 * 逐表点名一个可空可写的普通列,让"改不动"这件事只可能由策略造成。
 */
export const MUTABLE_COLUMN = Object.freeze({
  team_knowledge_spaces: "name = 'harness-touched'",
  team_knowledge_items: "title = 'harness-touched'",
  team_knowledge_revisions: "change_note = 'harness-touched'",
  zhs_knowledge_doc: "title = 'harness-touched'",
  zhs_knowledge_chunk: "content = 'harness-touched'",
  user_memories: "content = 'harness-touched'",
  image_gen_favorites: "prompt = 'harness-touched'",
  notes: "title = 'harness-touched'",
})

/** 每张表"属于某个主体的行"的 id 集(夹具定义,不从库里读 —— 它是期望值)。 */
export function expectedIds(table, subject) {
  switch (table) {
    case 'team_knowledge_spaces':
      return subject === U1 ? [SP1, SP3] : subject === U2 ? [SP2, SP3] : subject === U3 ? [SP1, SP3] : subject === U4 ? [SP1] : []
    case 'team_knowledge_items':
      return subject === U1 ? [IT1, IT3] : subject === U2 ? [IT2, IT3] : subject === U3 ? [IT1, IT3] : subject === U4 ? [IT1] : []
    case 'team_knowledge_revisions':
      return subject === U1 ? [RV1, RV3] : subject === U2 ? [RV2, RV3] : subject === U3 ? [RV1, RV3] : subject === U4 ? [RV1] : []
    case 'zhs_knowledge_doc':
      return subject === U1 ? ['900001', '900003'] : subject === U2 ? ['900002', '900003'] : []
    case 'zhs_knowledge_chunk':
      return subject === U1 ? ['910001', '910003'] : subject === U2 ? ['910002', '910003'] : []
    case 'user_memories':
      return subject === U1 ? [UM1] : subject === U2 ? [UM2] : []
    case 'image_gen_favorites':
      return subject === U1 ? [IF1] : subject === U2 ? [IF2] : []
    case 'notes':
      return subject === U1 ? [NO1, NO3] : subject === U2 ? [NO2, NO3] : []
    default:
      return []
  }
}

/**
 * "租户行"= 只因为**有主体**才应被看到的行。
 * 全局语料(900003/910003)与公开笔记(NO3)按迁移头注是**刻意保留**的无主体读路径,
 * 不参与 fail-closed 判据,但由 S3/S4 两条判据单独核对(不得混成一句"全表 fail-closed")。
 */
export function allTenantIds(table) {
  const all = new Set()
  for (const subject of [U1, U2, U3, U4]) for (const id of expectedIds(table, subject)) all.add(id)
  const sharedNoSubject = new Set(['900003', '910003', NO3])
  return [...all].filter((x) => !sharedNoSubject.has(x))
}

export function seedRowCount(table) {
  return { team_knowledge_spaces: 3, team_knowledge_items: 3, team_knowledge_revisions: 3, zhs_knowledge_doc: 3, zhs_knowledge_chunk: 3, user_memories: 2, image_gen_favorites: 2, notes: 3 }[table] ?? 0
}

function quoteId(id) {
  return /^\d+$/.test(id) ? id : `'${id}'`
}

/* =================================================================== *
 * 3) 判据矩阵:一次 SQL 观测 + 一个 JS 期望
 * =================================================================== */

function gucPrefix(gucs) {
  // 未设的键**什么都不发**(每条判据都是一条全新连接 ⇒ 默认就是未设);
  // 写 `RESET app.user_id` 在没设过的会话上是 ERROR: unrecognized configuration parameter。
  if (!gucs) return ''
  return gucs
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `SELECT set_config('${k}', '${v}', false);`)
    .join('')
}

const selProbe = (table, gucs) => ({
  sql: `${gucPrefix(gucs)}SELECT 'ROWS|' || coalesce(string_agg(id::text, ',' ORDER BY id::text), '') FROM public.${table};`,
})
const updProbe = (table, keyId, setClause, gucs) => ({
  sql:
    `${gucPrefix(gucs)}BEGIN;` +
    `WITH u AS (UPDATE public.${table} SET ${setClause} WHERE id = ${keyId} RETURNING 1) SELECT 'AFFECTED=' || count(*) FROM u;` +
    `ROLLBACK;`,
})
const delProbe = (table, keyId, gucs) => ({
  sql: `${gucPrefix(gucs)}BEGIN;WITH d AS (DELETE FROM public.${table} WHERE id = ${keyId} RETURNING 1) SELECT 'AFFECTED=' || count(*) FROM d;ROLLBACK;`,
})
const insProbe = (insertSql, gucs) => ({ sql: `${gucPrefix(gucs)}BEGIN;${insertSql}ROLLBACK;` })

/**
 * 八张表 × 判据的完整计划(只描述,不执行)。
 * 两条主体角色各跑一遍:A/B/C/U/D/P × 8 表 × 2 角色 = 96 条,加 F 变异对照 8 条、语义分支 7 条。
 */
export function buildJudgementPlan() {
  /** @type {Array<object>} */
  const plan = []
  for (const table of TENANT_RLS_TABLES.map((t) => t.table)) {
    const anchor = TABLE_ANCHORS[table]
    for (const role of [OWNER_ROLE, MEMBER_ROLE]) {
      plan.push({
        table,
        role,
        id: 'A 设 app.user_id=U1 ⇒ 只应见 U1 的行集',
        probe: selProbe(table, [['app.user_id', U1]]),
        expect: `rows=${expectedIds(table, U1).length}`,
        note: `期望集 ${expectedIds(table, U1).join(',')}`,
      })
      plan.push({
        table,
        role,
        id: 'B 设 app.user_id=U2 ⇒ 看不到 U1 的行',
        probe: selProbe(table, [['app.user_id', U2]]),
        expect: `missing=${anchor.u1}`,
      })
      plan.push({
        table,
        role,
        id: 'C 不设 app.user_id ⇒ 租户行一律不可见(fail-closed;若可见即 P0)',
        probe: selProbe(table, [['app.user_id', null]]),
        expect: `missing=${allTenantIds(table).join(',')}`,
      })
      plan.push({
        table,
        role,
        id: 'U 以 U2 身份 UPDATE U1 的行 ⇒ 拦得住(0 行或被策略拒)',
        probe: updProbe(table, quoteId(anchor.u1), MUTABLE_COLUMN[table], [['app.user_id', U2]]),
        expect: 'affected=0',
      })
      plan.push({
        table,
        role,
        id: 'D 以 U2 身份 DELETE U1 的行 ⇒ 0 行',
        probe: delProbe(table, quoteId(anchor.u1), [['app.user_id', U2]]),
        expect: 'affected=0',
      })
      plan.push({
        table,
        role,
        id: 'P 设 app.bypass_rls=true ⇒ 全量可见(withBypassRls 运维通道在位)',
        probe: selProbe(table, [['app.bypass_rls', 'true']]),
        expect: `rows=${seedRowCount(table)}`,
      })
    }
    plan.push({
      table,
      role: OWNER_ROLE,
      id: 'F 变异对照:NO FORCE 后属主必须越权 ⇒ 证明 C 那一串绿是 FORCE 给的,不是恒真',
      mutate: 'no-force',
      probe: selProbe(table, [['app.user_id', null]]),
      expect: `rows=${seedRowCount(table)}`,
    })
  }

  plan.push({
    table: 'team_knowledge_spaces',
    role: MEMBER_ROLE,
    id: 'S1 space_member 分支:U2 是 SP3 的成员 ⇒ SP3 应可见',
    probe: selProbe('team_knowledge_spaces', [['app.user_id', U2]]),
    expect: `contains=${SP3}`,
  })
  plan.push({
    table: 'team_knowledge_spaces',
    role: MEMBER_ROLE,
    id: 'S2 team admin 分支:U3 是 T1 的 admin ⇒ 不看 visibility 全可见',
    probe: selProbe('team_knowledge_spaces', [['app.user_id', U3]]),
    expect: `contains=${SP1},${SP3}`,
  })
  plan.push({
    table: 'team_knowledge_spaces',
    role: MEMBER_ROLE,
    id: 'S3 team member + restricted ⇒ 不可见(谓词里的 visibility 门)',
    probe: selProbe('team_knowledge_spaces', [['app.user_id', U4]]),
    expect: `missing=${SP3}`,
  })
  plan.push({
    table: 'zhs_knowledge_doc',
    role: MEMBER_ROLE,
    id: "S4 DELETE 不含 owner_uuid='' 支 ⇒ 普通主体删不掉全局语料",
    probe: delProbe('zhs_knowledge_doc', '900003', [['app.user_id', U1]]),
    expect: 'affected=0',
  })
  plan.push({
    table: 'notes',
    role: MEMBER_ROLE,
    id: 'S5 公开笔记:只改 title ⇒ 拦得住(WITH CHECK 拒改写归属:0 行或 42501)',
    probe: updProbe('notes', quoteId(NO3), "title = 'touched'", [['app.user_id', U1]]),
    expect: 'affected=0',
  })
  plan.push({
    table: 'notes',
    role: MEMBER_ROLE,
    id: 'S6 反向对照:同一条 UPDATE 顺带把 user_id 改成自己 ⇒ 实测是否放行',
    probe: updProbe('notes', quoteId(NO3), `user_id = '${U1}'`, [['app.user_id', U1]]),
    expect: 'affected=?',
    informational: true,
  })
  plan.push({
    table: 'notes',
    role: MEMBER_ROLE,
    id: 'S7 INSERT 伪冒他人身份 ⇒ 必须被 WITH CHECK 拒(42501)',
    probe: insProbe(
      `INSERT INTO public.notes (id, user_id, title, content, is_public) VALUES ('${randomUUID()}', '${U2}', 'forged', 'x', false);`,
      [['app.user_id', U1]],
    ),
    expect: 'rls-error',
  })
  return plan
}

/**
 * JS 侧断言:一次观测 + 一个期望式子 ⇒ PASS|FAIL|P0|SKIP|INFO。
 * 镜像测试直接调它(§22c:判据只有一份实现)。
 */
/**
 * 从 psql 的 -tA 输出里取**本次探针**的读数。
 * 只认带标记的行(ROWS|… / AFFECTED=n),其余行(set_config 的 'true'、命令行回显等)一律忽略。
 * 空 ROWS| ⇒ [] 行(不是 null:null 在判据里会被读成"什么都没看见",而这里是"确实 0 行" —— 
 * 两者必须可区分,否则 SKIP 与 PASS 会混为一谈)。
 * @returns {{value: string|null, kind: 'rows'|'affected'|null}}
 */
export function parseProbeOutput(stdout) {
  const lines = toLines(stdout)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const l = lines[i]
    if (l.startsWith('ROWS|')) return { value: l.slice(5), kind: 'rows' }
    const m = /^AFFECTED=(\d+)$/.exec(l)
    if (m) return { value: m[1], kind: 'affected' }
  }
  return { value: null, kind: null }
}

/** psql -tA 的输出按行拆开(Windows 换行是 CRLF,统一剥掉)。 */
function toLines(stdout) {
  return String(stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
}

/**
 * **没有标记**的管理/诊断语句用的取法(select 1、show server_version、pg_roles 回读)。
 * 与 parseProbeOutput 刻意分成两个出口:合并成一个字段,就会把探针噪音(set_config 打的 true)
 * 当成探针读数;反过来只用标记,`select 1` 会被读成 null ⇒ 数据库明明 ready 却报"未就绪"。
 * 上一轮真跑同时踩过这两个方向,所以两个出口必须分开、且都有各自的对照用例。
 */
export function lastNonEmptyLine(stdout) {
  const lines = toLines(stdout)
  return lines.find((l) => l.length > 0) ?? null
}

export function judgeOne(spec, observation) {
  if (!observation) return { verdict: 'SKIP', detail: '没有拿到任何观测(子进程未返回)' }
  if (observation.transportFailure) return { verdict: 'SKIP', detail: `psql 派生失败:${observation.detail || ''}`.slice(0, 240) }
  if (spec.expect === 'affected=?') return { verdict: 'INFO', detail: `实测 affected=${observation.value ?? '(无输出)'}` }
  if (spec.expect === 'rls-error') {
    const msg = observation.stderr || ''
    const isRls = /row-level security|42501/.test(msg)
    return {
      verdict: isRls ? 'PASS' : observation.status === 0 ? 'FAIL' : 'SKIP',
      detail: isRls
        ? `被策略拒:${firstLine(msg)}`
        : observation.status === 0
          ? `没被拒:psql rc=0(写入成功 ⇒ WITH CHECK 没起作用)`
          : `rc=${observation.status} 但不是 RLS 报错:${firstLine(msg) || '(空)'}`,
    }
  }
  if (spec.expect.startsWith('affected=')) {
    const want = spec.expect.slice('affected='.length)
    const got = observation.value
    const msg = observation.stderr || ''
    // 三态必须可区分,否则"判据没跑成"会被读成"策略拦住了"(反向也会被读成"没拦住"):
    //   ① 拿到 AFFECTED=n ⇒ 按数字判;
    //   ② 没拿到但报的是 RLS 错 ⇒ 同样是"拦得住"(UPDATE 的 USING 为假时 PostgreSQL 给 0 行,
    //      而 WITH CHECK 为假时给 42501 —— 两种都是正当形态,不能只认前者);
    //   ③ 没拿到且报的是别的错(列名写错、表不存在、权限不足)⇒ **SKIP** 并印错误首行,
    //      绝不记 PASS 也绝不记 FAIL(第一轮就是把 "column updated_at does not exist" 判成了 FAIL)。
    if (/row-level security|42501/.test(msg)) {
      return { verdict: want === '0' ? 'PASS' : 'FAIL', detail: `被策略拒:${firstLine(msg)}` }
    }
    if (got === null || got === undefined) {
      if (observation.status !== 0) return { verdict: 'SKIP', detail: `探针没跑出读数(rc=${observation.status}):${firstLine(msg) || '(stderr 空)'}` }
      return { verdict: 'FAIL', detail: `期望 affected=${want},但输出里没有 AFFECTED 行(rc=0)` }
    }
    return { verdict: got === want ? 'PASS' : 'FAIL', detail: `期望 affected=${want},实测=${got}` }
  }
  if (spec.expect.startsWith('rows=')) {
    const want = Number(spec.expect.slice('rows='.length))
    const ids = splitIds(observation.value)
    if (ids.length !== want) {
      const failOpen = String(spec.id).startsWith('C ') && ids.length > 0
      return { verdict: failOpen ? 'P0' : 'FAIL', detail: `期望 ${want} 行,实测 ${ids.length} 行:${ids.slice(0, 6).join(',') || '(空)'}` }
    }
    return { verdict: 'PASS', detail: `${ids.length} 行,与夹具期望集一致` }
  }
  if (spec.expect.startsWith('contains=')) {
    const want = spec.expect.slice('contains='.length).split(',').filter(Boolean)
    const got = splitIds(observation.value)
    const miss = want.filter((w) => !got.includes(w))
    return { verdict: miss.length === 0 ? 'PASS' : 'FAIL', detail: miss.length ? `缺 ${miss.join(',')} (实测 ${got.join(',') || '(空)'})` : `含全部 ${want.length} 个预期 id` }
  }
  if (spec.expect.startsWith('missing=')) {
    const banned = spec.expect.slice('missing='.length).split(',').filter(Boolean)
    const got = splitIds(observation.value)
    const hit = got.filter((g) => banned.includes(g))
    if (hit.length > 0) {
      const failOpen = String(spec.id).startsWith('C ')
      return { verdict: failOpen ? 'P0' : 'FAIL', detail: `越权看到 ${hit.length} 行:${hit.slice(0, 4).join(',')}` }
    }
    return { verdict: 'PASS', detail: `禁见集 ${banned.length} 项均未出现(实测可见 ${got.length} 行)` }
  }
  return { verdict: 'SKIP', detail: `无法解析期望式子:${spec.expect}` }
}

export function splitIds(value) {
  if (value === null || value === undefined) return []
  const t = String(value).trim()
  if (t === '' || t.toUpperCase() === 'NULL') return []
  return t.split(',').map((s) => s.trim()).filter(Boolean)
}

export function firstLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0) || ''
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
