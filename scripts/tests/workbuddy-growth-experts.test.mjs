// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 成长任务「专家体验」驱动链的机器锁(2026-11-05 立)。
 *
 * 覆盖的判据(全是纯函数,不碰进程/网络 ⇒ 离线可跑):
 *   ① jump_url ⇒ expertId 的解出(含无 deeplink / 无 expertId 的边界);
 *   ② task_desc ⇒ 专家显示名的解出;
 *   ③ 终态判定(claimed / completed / progress 达 target);
 *   ④ 专家体验项的挑选 + 解不出 expertId 的项**点名**而不是静默丢弃;
 *   ⑤ 本地专家索引:市场ID ⇄ 本地专家名的桥(marketExpertId 权威对照 + local-assets 表)。
 *
 * 为什么这些必须钉住:踩过的坑全在"字符串形态"上 ——
 *   · jump_url 里 expertId 藏在二次编码的 deeplink 参数里;
 *   · 卡片 source 是**本地专家名**(`ChinaEcommerceOperationsExpert`)而不是市场ID,
 *     按市场ID 找永远找不到卡;
 *   · 同名/近名专家极多,按名字挑会挑错 ⇒ 判据必须是"卡片内 source"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  isGrowthTaskDone,
  parseExpertIdFromJumpUrl,
  parseExpertNameFromDesc,
  selectExpertTasks,
} from '../workbuddy-growth-experts.mjs'
import {
  buildExpertIndex,
  isLocalNameOf,
  localExpertNameOf,
  readLocalAssets,
  readMarketExpertMapping,
} from '../lib/workbuddy-expert-index.mjs'

test('① jump_url ⇒ expertId:解出 deeplink 里二次编码的 expertId', () => {
  const jump =
    'https://www.workbuddy.cn/work/launch/?deeplink=workbuddy%3A%2F%2Fexperts%3FexpertId%3Dex_GDl31WahyIH0&buddy_type=workbuddy'
  assert.equal(parseExpertIdFromJumpUrl(jump), 'ex_GDl31WahyIH0')

  const jump2 =
    'https://www.workbuddy.cn/work/launch/?deeplink=workbuddy%3A%2F%2Fexperts%3FexpertId%3Dex_FbY5nlWTqDod&buddy_type=workbuddy'
  assert.equal(parseExpertIdFromJumpUrl(jump2), 'ex_FbY5nlWTqDod')
})

test('① jump_url 边界:无 deeplink / 无 expertId / 空 ⇒ 空串(未判定,不猜)', () => {
  assert.equal(parseExpertIdFromJumpUrl(''), '')
  assert.equal(parseExpertIdFromJumpUrl(undefined), '')
  assert.equal(parseExpertIdFromJumpUrl('workbuddy://expert'), '')
  // 有 deeplink 但没 expertId ⇒ 仍取不到
  assert.equal(
    parseExpertIdFromJumpUrl(
      'https://www.workbuddy.cn/work/launch/?deeplink=workbuddy%3A%2F%2Fexperts',
    ),
    '',
  )
})

test('② task_desc ⇒ 专家显示名:取「」内那段', () => {
  assert.equal(
    parseExpertNameFromDesc('在专家页搜索并召唤「中国电商运营专家」，完成一次对话。'),
    '中国电商运营专家',
  )
  assert.equal(
    parseExpertNameFromDesc('在专家页搜索并召唤「直播电商教练」，完成一次对话。'),
    '直播电商教练',
  )
  assert.equal(parseExpertNameFromDesc('没有书名号的描述'), '')
  assert.equal(parseExpertNameFromDesc(undefined), '')
})

test('③ 终态判定:claimed / completed / progress 达 target 就算完', () => {
  assert.equal(isGrowthTaskDone({ accept_status: 'claimed' }), true)
  assert.equal(isGrowthTaskDone({ accept_status: 'completed' }), true)
  assert.equal(
    isGrowthTaskDone({ accept_status: 'accepted', progress: { current: 0, target: 1 } }),
    false,
  )
  assert.equal(
    isGrowthTaskDone({ accept_status: 'accepted', progress: { current: 1, target: 1 } }),
    true,
  )
  assert.equal(isGrowthTaskDone({ accept_status: 'ACCEPTED' }), false)
  assert.equal(isGrowthTaskDone(null), false)
  assert.equal(isGrowthTaskDone(undefined), false)
  // status 字段(CLI 域形态)也算
  assert.equal(isGrowthTaskDone({ status: 'completed' }), true)
})

test('④ 选专家体验项:只挑 expert_use_ 前缀;解不出 expertId 的**点名**不静默丢', () => {
  const tasks = [
    {
      task_code: 'expert_use_maidehao',
      title: '体验「中国电商运营专家」',
      task_desc: '在专家页搜索并召唤「中国电商运营专家」，完成一次对话。',
      jump_url:
        'https://www.workbuddy.cn/work/launch/?deeplink=workbuddy%3A%2F%2Fexperts%3FexpertId%3Dex_GDl31WahyIH0',
      accept_status: 'accepted',
      progress: { current: 0, target: 1 },
    },
    {
      task_code: 'chat_5',
      title: '和 AI 聊天 5 次',
      accept_status: 'claimed',
      progress: { current: 5, target: 5 },
    },
    {
      task_code: 'expert_use_broken',
      title: '体验「解不出 ID 的专家」',
      jump_url: 'workbuddy://expert',
      accept_status: 'accepted',
    },
  ]
  const { rows, unresolved } = selectExpertTasks(tasks)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].task_code, 'expert_use_maidehao')
  assert.equal(rows[0].expertId, 'ex_GDl31WahyIH0')
  assert.equal(rows[0].expertName, '中国电商运营专家')
  assert.equal(rows[0].done, false)
  assert.equal(unresolved.length, 1)
  assert.equal(unresolved[0].task_code, 'expert_use_broken')
  assert.match(unresolved[0].reason, /expertId/)
})

test('④ 终态项也要被选中(done=true),供 CLI 跳过', () => {
  const { rows } = selectExpertTasks([
    {
      task_code: 'expert_use_douyinyin',
      task_desc: '在专家页搜索并召唤「抖音策略师」，完成一次对话。',
      jump_url:
        'https://www.workbuddy.cn/work/launch/?deeplink=workbuddy%3A%2F%2Fexperts%3FexpertId%3Dex_FbY5nlWTqDod',
      accept_status: 'claimed',
      progress: { current: 1, target: 1 },
    },
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].done, true)
  assert.equal(rows[0].expertId, 'ex_FbY5nlWTqDod')
})

test('⑤ 本地资产表:experts 段 ⇒ 市场ID → localKey', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wb-assets-'))
  try {
    const file = path.join(dir, 'local-assets.json')
    writeFileSync(
      file,
      JSON.stringify({
        experts: {
          ex_GDl31WahyIH0: { localKey: 'china-ecommerce-operations-expert', version: '1.0.1' },
          ex_FbY5nlWTqDod: { localKey: 'douyin-strategist', version: '1.0.2' },
        },
      }),
      'utf8',
    )
    const assets = readLocalAssets(file)
    assert.equal(assets.ex_GDl31WahyIH0.localKey, 'china-ecommerce-operations-expert')
    assert.equal(assets.ex_FbY5nlWTqDod.version, '1.0.2')
    // 坏文件 / 不存在 ⇒ 空表(未判定不冒充)
    assert.deepEqual(readLocalAssets(path.join(dir, 'nope.json')), {})
    const bad = path.join(dir, 'bad.json')
    writeFileSync(bad, '{not json', 'utf8')
    assert.deepEqual(readLocalAssets(bad), {})
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('⑤ 会话库里的 marketExpertId ⇒ 市场ID → 本地专家名', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wb-db-'))
  try {
    const file = path.join(dir, 'workbuddy.db')
    writeFileSync(
      file,
      'xxx{"v":2,"kind":"expert","expertId":"ChinaEcommerceOperationsExpert","marketExpertId":"ex_GDl31WahyIH0","pluginRegisteredName":"china-ecommerce-operations-expert"}yyy',
      'utf8',
    )
    const map = readMarketExpertMapping(file)
    assert.equal(map.ex_GDl31WahyIH0, 'ChinaEcommerceOperationsExpert')
    // 取不到 ⇒ 空表
    assert.deepEqual(readMarketExpertMapping(path.join(dir, 'nope.db')), {})
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('⑤ 索引合成:市场ID ⇄ 本地专家名 的双向判据', () => {
  const index = {
    ex_GDl31WahyIH0: {
      localKey: 'china-ecommerce-operations-expert',
      expertName: 'ChinaEcommerceOperationsExpert',
      version: '1.0.1',
    },
  }
  assert.equal(localExpertNameOf(index, 'ex_GDl31WahyIH0'), 'ChinaEcommerceOperationsExpert')
  assert.equal(localExpertNameOf(index, 'ex_Unknown'), '')
  // 本地专家名 ⇒ 认
  assert.equal(isLocalNameOf(index, 'ex_GDl31WahyIH0', 'ChinaEcommerceOperationsExpert'), true)
  // localKey ⇒ 认
  assert.equal(isLocalNameOf(index, 'ex_GDl31WahyIH0', 'china-ecommerce-operations-expert'), true)
  // 市场ID 本身 ⇒ 认
  assert.equal(isLocalNameOf(index, 'ex_GDl31WahyIH0', 'ex_GDl31WahyIH0'), true)
  // 别人的专家 ⇒ 不认
  assert.equal(isLocalNameOf(index, 'ex_GDl31WahyIH0', 'DouyinStrategist'), false)
  assert.equal(isLocalNameOf(index, 'ex_GDl31WahyIH0', ''), false)
})

test('⑤ buildExpertIndex:读不到输入 ⇒ 空表(未判定不冒充)', () => {
  const index = buildExpertIndex({
    dbFile: 'G:/__no_such_dir__/workbuddy.db',
    assetsFile: 'G:/__no_such_dir__/local-assets.json',
  })
  assert.deepEqual(index, {})
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
