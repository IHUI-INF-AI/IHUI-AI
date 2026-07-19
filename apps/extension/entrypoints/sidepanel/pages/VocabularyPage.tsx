/**
 * VocabularyPage — 词汇查询页(查词/翻译/生词本)。
 * 接收来自 content script 的 pending 词汇(通过 chrome.storage.session),
 * 用户可手动输入查询,保存到生词本(本地 chrome.storage.local)。
 */
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { sendMessage } from '../../../lib/message-router'
import { useI18n } from '../../../src/i18n'

interface VocabResult {
  word: string
  translation: string
  phonetic?: string
  definitions?: string[]
}

interface WordbookEntry {
  word: string
  translation: string
  savedAt: string
}

const WORDBOOK_KEY = 'ihui_wordbook'

const pageStyle: CSSProperties = {
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const formStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
}

const inputStyle: CSSProperties = {
  flex: 1,
  fontSize: 13,
}

const resultStyle: CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--card)',
  fontSize: 13,
  lineHeight: 1.5,
}

const wordStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  marginRight: 8,
}

const phoneticStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
  fontFamily: 'monospace',
}

const defListStyle: CSSProperties = {
  margin: '6px 0 0 0',
  paddingLeft: 18,
  fontSize: 12,
  color: 'var(--fg)',
}

const wordbookStyle: CSSProperties = {
  marginTop: 4,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--muted-bg)',
  fontSize: 12,
}

const wordbookItemStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
}

const PENDING_KEY = 'ihui_pending_vocab'

async function loadWordbook(): Promise<WordbookEntry[]> {
  const result = await chrome.storage.local.get(WORDBOOK_KEY)
  const arr = result[WORDBOOK_KEY]
  if (!Array.isArray(arr)) return []
  return arr.filter(
    (e): e is WordbookEntry =>
      !!e && typeof e === 'object' && typeof e.word === 'string' && typeof e.translation === 'string',
  )
}

async function saveToWordbook(entry: WordbookEntry): Promise<void> {
  const list = await loadWordbook()
  const next = [entry, ...list.filter((e) => e.word !== entry.word)].slice(0, 200)
  await chrome.storage.local.set({ [WORDBOOK_KEY]: next })
}

export default function VocabularyPage() {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [result, setResult] = useState<VocabResult | null>(null)
  const [wordbook, setWordbook] = useState<WordbookEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadWordbook().then(setWordbook)
  }, [])

  // 监听 content script 写入的 pending vocab
  useEffect(() => {
    const listener = (msg: { type?: string; payload?: { text?: string } }) => {
      if (msg?.type === 'ws.pending_vocab' && typeof msg.payload?.text === 'string') {
        const text = msg.payload.text
        setInput(text)
        void doLookup(text)
      }
    }
    chrome.runtime.onMessage.addListener(listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0])
    // 启动时也检查一次(可能在 content script 写入时 sidepanel 未打开)
    void chrome.storage.session
      ?.get(PENDING_KEY)
      .then((res) => {
        const v = res[PENDING_KEY]
        if (typeof v === 'string' && v.trim()) {
          setInput(v)
          void doLookup(v)
          void chrome.storage.session?.remove(PENDING_KEY)
        }
      })
      .catch(() => {})
    return () => {
      chrome.runtime.onMessage.removeListener(listener as Parameters<typeof chrome.runtime.onMessage.removeListener>[0])
    }
  }, [])

  const doLookup = async (word: string) => {
    const w = word.trim()
    if (!w) return
    setLoading(true)
    setError('')
    try {
      const res = await sendMessage<VocabResult>({
        type: 'vocab.lookup',
        payload: { word: w, source: 'manual' },
        requestId: `vocab-${Date.now()}`,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void doLookup(input)
  }

  const onSave = async () => {
    if (!result) return
    await saveToWordbook({
      word: result.word,
      translation: result.translation,
      savedAt: new Date().toISOString(),
    })
    const next = await loadWordbook()
    setWordbook(next)
  }

  const onRemove = async (word: string) => {
    const list = await loadWordbook()
    const next = list.filter((e) => e.word !== word)
    await chrome.storage.local.set({ [WORDBOOK_KEY]: next })
    setWordbook(next)
  }

  return (
    <div style={pageStyle} data-testid="vocab-page">
      <div className="sp-page-header">
        <h3>{t('vocab.title')}</h3>
      </div>
      <form onSubmit={onSubmit} style={formStyle}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('vocab.inputPlaceholder')}
          style={inputStyle}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {t('vocab.lookup')}
        </button>
      </form>
      {error ? <div className="error-banner">{error}</div> : null}
      {result ? (
        <div style={resultStyle}>
          <div>
            <span style={wordStyle}>{result.word}</span>
            {result.phonetic ? <span style={phoneticStyle}>/{result.phonetic}/</span> : null}
          </div>
          <div style={{ marginTop: 6, color: 'var(--accent)', fontWeight: 500 }}>
            {result.translation}
          </div>
          {result.definitions && result.definitions.length > 0 ? (
            <ul style={defListStyle}>
              {result.definitions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          ) : null}
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={onSave} className="link-btn">
              {t('vocab.saved')}
            </button>
          </div>
        </div>
      ) : null}
      {wordbook.length > 0 ? (
        <div style={wordbookStyle}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>生词本</div>
          {wordbook.map((e) => (
            <div key={e.word} style={wordbookItemStyle}>
              <span>
                <strong>{e.word}</strong> — {e.translation}
              </span>
              <button type="button" className="link-btn" onClick={() => onRemove(e.word)}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
