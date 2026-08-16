const url = 'http://localhost:8802/ai/chat/stream'
const body = JSON.stringify({
  model: 'stepfun/step-2-16k',
  messages: [{ role: 'user', content: 'hi' }],
})
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    Authorization: '<SECRET_3ac4f5c6>',
    'X-Requested-With': 'XMLHttpRequest',
  },
  body,
  credentials: 'include',
})
console.log('status', res.status)
console.log('ok', res.ok)
console.log('headers')
for (const [k, v] of res.headers.entries()) {
  console.log(k + ':', v)
}
const reader = res.body?.getReader()
if (!reader) {
  console.log('no body reader')
  process.exit(0)
}
const decoder = new TextDecoder()
let buf = ''
let count = 0
const timeout = setTimeout(() => {
  console.log('timeout after 15s, received chunks:', count)
  reader.cancel().catch(() => {})
  process.exit(0)
}, 15000)
reader
  .read()
  .then(async function pump({ done, value }) {
    if (done) {
      clearTimeout(timeout)
      console.log('stream done, received chunks:', count)
      process.exit(0)
    }
    count++
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') {
          clearTimeout(timeout)
          console.log('received done, chunks:', count)
          process.exit(0)
        }
        console.log('event:', payload.slice(0, 120))
      }
    }
    return reader.read().then(pump)
  })
  .catch((err) => {
    clearTimeout(timeout)
    console.log('stream error:', err?.message || err)
    process.exit(1)
  })
