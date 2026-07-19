/**
 * VocabularyPage — 词汇查询页(查词/翻译/生词本)。
 *
 * 数据流:
 * - 输入:用户键入 / content script 写入 chrome.storage.session 的 ihui_pending_vocab
 * - 查询:通过 background 的 vocab.lookup message 走 LLM
 * - 生词本:IndexedDB(ihui-vocab / words store),支持 1000+ 词,word 唯一索引
 * - 搜索:word / translation 子串匹配,前端游标扫描(1000 词 < 5ms)
 */
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { sendMessage } from '../../../lib/message-router'
import { useI18n } from '../../../src/i18n'
import {
  addWord,
  getAllWords,
  removeWord,
  searchWords,
  countWords,
  type WordEntry,
} from '../../../src/idb/vocab-db'

interface VocabResult {
  word: string
  translation: string
  phonetic?: string
  definitions?: string[]
}

const PENDING_KEY = 'ihui_pending_vocab'

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

const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
  gap: 6,
}

const searchInputStyle: CSSProperties = {
  flex: 1,
  fontSize: 12,
  padding: '4px 6px',
}

const countBadgeStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
}

export default function VocabularyPage() {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [result, setResult] = useState<VocabResult | null>(null)
  const [wordbook, setWordbook] = useState<WordEntry[]>([])
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refreshWordbook = async (query: string) => {
    try {
      const list = query.trim() ? await searchWords(query, { limit: 500 }) : await getAllWords({ limit: 500 })
      setWordbook(list)
    } catch (err) {
      console.warn('[IHUI] refresh wordbook failed:', err)
      setWordbook([])
    }
  }

  useEffect(() => {
    void refreshWordbook('')
    void countWords()
      .then(setTotal)
      .catch(() => setTotal(0))
  }, [])

  // 搜索 debounce(避免每次按键都全表扫描)
  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshWordbook(search)
    }, 120)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    try {
      await addWord({
        word: result.word,
        translation: result.translation,
        phonetic: result.phonetic,
        definitions: result.definitions,
        source: 'manual',
      })
      await refreshWordbook(search)
      const n = await countWords()
      setTotal(n)
    } catch (err) {
      console.warn('[IHUI] save to wordbook failed:', err)
    }
  }

  const onRemove = async (word: string) => {
    try {
      await removeWord(word)
      await refreshWordbook(search)
      const n = await countWords()
      setTotal(n)
    } catch (err) {
      console.warn('[IHUI] remove from wordbook failed:', err)
    }
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
      <div style={wordbookStyle}>
        <div style={headerRowStyle}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('wordbook.title')}</span>
          <span style={countBadgeStyle} data-testid="vocab-count">
            {t('wordbook.countLabel', { count: total })}
          </span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('wordbook.searchPlaceholder')}
          style={searchInputStyle}
        />
        {wordbook.length === 0 ? (
          <div style={{ ...countBadgeStyle, padding: '8px 0' }}>
            {search.trim() ? t('wordbook.noMatchHint') : t('wordbook.emptyHint')}
          </div>
        ) : (
          <div style={{ marginTop: 4 }}>
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
        )}
      </div>
    </div>
  )
}
