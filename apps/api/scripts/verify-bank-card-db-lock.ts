// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BankCard 跨进程并发验收（2026-11-28）。
 *
 * 用法（必须指向一次性测试库/验证库，不得指向 ihui_dev 生产库）：
 *   BANK_CARD_LOCK_VERIFY_ALLOW=1 \
 *   DATABASE_URL=postgresql://...@127.0.0.1:15432/ihui_bc_verify_... \
 *   pnpm --filter @ihui/api exec tsx scripts/verify-bank-card-db-lock.ts
 *
 * 做两件事，每个 worker 都是独立 node 进程、独立连接池：
 * 1) 两个进程同时给同一用户新增同一卡号：只允许一个成功，另一个 exists；
 * 2) 两个进程同时新增两张不同卡且都要求默认：最终只允许一张默认卡。
 *
 * 锁实现是 user_preferences 同事务内的 pg_advisory_xact_lock(hashtext(...))；
 * 本脚本验证的是跨进程/跨连接池，不是单进程 Promise.all。
 */
import 'dotenv/config'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { users } from '@ihui/database'
import { db } from '../src/db/index.js'
import { addStoredBankCard, listStoredBankCards } from '../src/services/bank-card-store.js'

const SCRIPT = fileURLToPath(import.meta.url)
const WORKER = process.env.BANK_CARD_LOCK_WORKER === '1'

function assertVerificationDb() {
  if (process.env.BANK_CARD_LOCK_VERIFY_ALLOW !== '1') {
    throw new Error('拒绝执行：显式设置 BANK_CARD_LOCK_VERIFY_ALLOW=1 才允许创建/清理验证数据')
  }
  const dbName = new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '')
  if (!/verify|test|e2e/i.test(dbName)) {
    throw new Error(`拒绝执行：DATABASE_URL 必须指向 verify/test/e2e 隔离库，当前库名=${dbName}`)
  }
}

function runWorker(env: Record<string, string>): Promise<{ status: string; code?: string; id?: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', SCRIPT], {
      env: { ...process.env, ...env, BANK_CARD_LOCK_WORKER: '1' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      const line = stdout
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .pop()
      try {
        if (!line) throw new Error(`worker 无输出（exit=${code}）: ${stderr}`)
        resolve(JSON.parse(line))
      } catch (error) {
        reject(new Error(`${String(error)}\nstdout=${stdout}\nstderr=${stderr}`))
      }
    })
  })
}

async function workerMain() {
  const userId = process.env.BANK_CARD_LOCK_USER_ID!
  const number = process.env.BANK_CARD_LOCK_CARD!
  try {
    const card = await addStoredBankCard(userId, {
      number,
      holder: '跨进程验收',
      bankName: '验证银行',
      isDefault: true,
    })
    console.log(JSON.stringify({ status: 'fulfilled', id: card.id }))
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'unknown'
    console.log(JSON.stringify({ status: 'rejected', code }))
  } finally {
    process.exit(0)
  }
}

async function parentMain() {
  assertVerificationDb()
  const runId = randomUUID().slice(0, 8)
  const created: string[] = []

  async function createUser(suffix: string) {
    const phone = `199${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`
    const [row] = await db
      .insert(users)
      .values({ phone, nickname: `跨进程验收-${runId}-${suffix}` })
      .returning({ id: users.id })
    if (!row) throw new Error('创建验证用户失败')
    created.push(row.id)
    return row.id
  }

  try {
    const userA = await createUser('a')
    const card = '4111111111111111'
    const [r1, r2] = await Promise.all([
      runWorker({ BANK_CARD_LOCK_USER_ID: userA, BANK_CARD_LOCK_CARD: card }),
      runWorker({ BANK_CARD_LOCK_USER_ID: userA, BANK_CARD_LOCK_CARD: card }),
    ])
    const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled')
    const rejected = [r1, r2].filter((r) => r.status === 'rejected')
    if (fulfilled.length !== 1 || rejected.length !== 1 || rejected[0]?.code !== 'exists') {
      throw new Error(`重复卡号场景不符合预期: ${JSON.stringify([r1, r2])}`)
    }
    const cardsA = await listStoredBankCards(userA)
    if (cardsA.length !== 1) throw new Error(`重复卡号场景落库数量=${cardsA.length}`)
    console.log(`[1/2] 同卡号跨进程并发：1 成功 + 1 exists，落库=${cardsA.length}`)

    const userB = await createUser('b')
    const [d1, d2] = await Promise.all([
      runWorker({ BANK_CARD_LOCK_USER_ID: userB, BANK_CARD_LOCK_CARD: '4111111111111111' }),
      runWorker({ BANK_CARD_LOCK_USER_ID: userB, BANK_CARD_LOCK_CARD: '5555555555554444' }),
    ])
    if (d1.status !== 'fulfilled' || d2.status !== 'fulfilled') {
      throw new Error(`双默认场景有 worker 失败: ${JSON.stringify([d1, d2])}`)
    }
    const cardsB = await listStoredBankCards(userB)
    const defaults = cardsB.filter((item) => item.isDefault)
    if (cardsB.length !== 2 || defaults.length !== 1) {
      throw new Error(`双默认场景 cards=${cardsB.length} defaults=${defaults.length}`)
    }
    console.log(`[2/2] 双默认跨进程并发：cards=${cardsB.length} defaults=${defaults.length}`)
    console.log('BANK_CARD_DB_LOCK_CROSS_PROCESS=PASS')
  } finally {
    for (const id of created) {
      await db.delete(users).where(eq(users.id, id))
    }
    await db.$client.end()
  }
}

if (WORKER) {
  await workerMain()
} else {
  await parentMain()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
