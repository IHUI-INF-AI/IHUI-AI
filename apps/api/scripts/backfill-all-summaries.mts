// 临时回填脚本:① 按 arXiv id_list 批量拉取论文英文摘要回填 summary;
// ② 对全部 news/paper 的英文摘要做 LLM 中文改写(验证后删除)
import { and, eq, inArray, isNull } from 'drizzle-orm'
import Parser from 'rss-parser'
import { aiWorldItems } from '@ihui/database'
import { db } from '../src/db/index.js'
import { getSystemAccessToken } from '../src/utils/system-access-token.js'
import { config } from '../src/config/index.js'

const CONCURRENCY = 2
const REWRITE_PROMPT =
  '你是一名 AI 行业编辑。请将以下论文摘要改写为简洁的中文摘要(150字以内),保留核心方法与结论,不要添加评论:'

const CJK = /[\u4e00-\u9fff]/
const parser = new Parser()

/** 从 arXiv abs URL 提取论文 id(去版本号) */
function arxivIdFromUrl(url: string): string | null {
  const m = url.match(/arxiv\.org\/abs\/([^\s?#]+?)(?:v\d+)?$/i)
  return m?.[1] ?? null
}

/** 按 id_list 批量拉取 arXiv 摘要,返回 {去版本号id: 摘要} */
async function fetchArxivAbstracts(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const url = `http://export.arxiv.org/api/query?id_list=${batch.join(',')}&max_results=${batch.length}`
    try {
      const xml = await (await fetch(url)).text()
      const parsed = await parser.parseString(xml)
      for (const item of parsed.items ?? []) {
        const absId = item.link?.match(/arxiv\.org\/abs\/([^\s?#]+?)(?:v\d+)?$/i)?.[1]
        const abs = item.summary?.trim()
        if (absId && abs) out.set(absId.toLowerCase(), abs)
      }
    } catch {
      // 单批失败跳过
    }
  }
  return out
}

async function callLlm(prompt: string, content: string): Promise<string | null> {
  try {
    const token = await getSystemAccessToken()
    const res = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        // 显式指定 stepfun 模型:llm_gateway 的 auto-route 会把长文本判为 complex
        // 并升级到 gpt-4o(api.openai.com 在本机网络被墙,Connection error),必须绕开
        model: 'stepfun/step-3.7-flash',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content },
        ],
      }),
      signal: AbortSignal.timeout(90000),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { content?: string; error?: boolean; stub?: boolean }
    if (j.error || j.stub) return null
    return (j.content ?? '').trim() || null
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  // 第一步:回填 arXiv 论文摘要
  const papers = await db
    .select({ id: aiWorldItems.id, sourceUrl: aiWorldItems.sourceUrl })
    .from(aiWorldItems)
    .where(
      and(
        eq(aiWorldItems.kind, 'paper'),
        eq(aiWorldItems.source, 'arxiv'),
        isNull(aiWorldItems.summary),
      ),
    )
  const idToRow: Array<{ rowId: string; arxivId: string }> = []
  for (const p of papers) {
    const pid = p.sourceUrl ? arxivIdFromUrl(p.sourceUrl) : null
    if (pid) idToRow.push({ rowId: p.id, arxivId: pid })
  }
  console.log('papers without summary:', papers.length, '| with arxiv id:', idToRow.length)
  const abstracts = await fetchArxivAbstracts(idToRow.map((x) => x.arxivId))
  let filled = 0
  for (const { rowId, arxivId } of idToRow) {
    const abs = abstracts.get(arxivId.toLowerCase())
    if (abs) {
      await db
        .update(aiWorldItems)
        .set({ summary: abs.slice(0, 1000), updatedAt: new Date() })
        .where(eq(aiWorldItems.id, rowId))
      filled++
    }
  }
  console.log('abstracts filled:', filled)

  // 第二步:全部 news/paper 英文摘要 → LLM 中文改写
  const items = await db
    .select({ id: aiWorldItems.id, kind: aiWorldItems.kind, summary: aiWorldItems.summary })
    .from(aiWorldItems)
    .where(and(inArray(aiWorldItems.kind, ['news', 'paper']), eq(aiWorldItems.status, 1)))
  const targets = items.filter((it) => it.summary && !CJK.test(it.summary))
  console.log('translation targets:', targets.length)
  let ok = 0
  let fail = 0
  const queue = [...targets]
  async function worker(): Promise<void> {
    for (;;) {
      const it = queue.shift()
      if (!it) return
      const prompt =
        it.kind === 'paper'
          ? REWRITE_PROMPT
          : '你是一名 AI 行业编辑。请将以下资讯摘要改写为简洁的中文摘要(150字以内),保留关键信息,去除营销话术,不要添加评论:'
      const cn = await callLlm(prompt, it.summary ?? '')
      if (cn && CJK.test(cn)) {
        await db
          .update(aiWorldItems)
          .set({ summary: cn.slice(0, 1000), updatedAt: new Date() })
          .where(eq(aiWorldItems.id, it.id))
        ok++
      } else {
        fail++
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  console.log(`BACKFILL_ALL_DONE ok=${ok} fail=${fail}`)
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error('BACKFILL_FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})

