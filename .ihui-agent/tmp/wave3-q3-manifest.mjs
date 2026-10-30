import fs from 'node:fs'

const P = '.ihui-agent/wave3/q3.manifest.json'

function read() {
  if (!fs.existsSync(P)) return null
  return JSON.parse(fs.readFileSync(P, 'utf8'))
}

function write(m) {
  fs.writeFileSync(P, JSON.stringify(m, null, 2) + '\n', 'utf8')
}

/** 深合并一条路由的 i18n 块(五语 × 命名空间) */
function mergeI18n(i18n, patch) {
  for (const lang of Object.keys(patch)) {
    i18n[lang] = i18n[lang] || {}
    for (const ns of Object.keys(patch[lang])) {
      i18n[lang][ns] = { ...(i18n[lang][ns] || {}), ...patch[lang][ns] }
    }
  }
}

const cmd = process.argv[2]
const route = process.argv[3]

if (cmd === 'init') {
  write({
    domain: 'memory+self-media',
    unitScreen: 'Q3',
    seat: 'q3',
    note:
      'Wave3 q3 包:memory/[id] + self-media/automation + self-media/koubo。' +
      '崩溃安全:每完成一条路由追加一次(ledger/navigator/indexExports/i18n 同步追加)。',
    newFiles: [],
    indexExports: [],
    apiClientIndexExports: [],
    apiClientIndexNote: '',
    navigator: [],
    i18n: {},
    ledger: [],
  })
  process.exit(0)
}

const m = read()
if (!m) throw new Error('manifest 未初始化:先跑 -- 前 init')

const payloads = {
  memory: {
    newFiles: [
      'packages/app/src/features/memory/MemoryDetailScreen.tsx',
      'apps/mobile-rn/src/screens/MemoryDetailScreen.tsx',
    ],
    indexExports: [
      "export { MemoryDetailScreen } from './features/memory/MemoryDetailScreen'",
      "export type { MemoryDetailScreenProps } from './features/memory/MemoryDetailScreen'",
    ],
    navigator: [
      {
        import: "import { MemoryDetailScreen } from '../screens/MemoryDetailScreen'",
        param: '  MemoryDetail: { id: string }',
        screen: '<RootStack.Screen name="MemoryDetail" component={MemoryDetailScreen} />',
      },
    ],
    i18n: {
      en: {
        memory: {
          detailTitle: 'Memory Details',
          edit: 'Edit',
          categoryLabel: 'Category',
          contentLabel: 'Content',
          createdAt: 'Created',
          notFound: 'Memory entry not found',
        },
      },
      'zh-CN': {
        memory: {
          detailTitle: '记忆详情',
          edit: '编辑',
          categoryLabel: '分类',
          contentLabel: '内容',
          createdAt: '创建',
          notFound: '记忆条目不存在',
        },
      },
      'zh-TW': {
        memory: {
          detailTitle: '記憶詳情',
          edit: '編輯',
          categoryLabel: '分類',
          contentLabel: '內容',
          createdAt: '創建',
          notFound: '記憶條目不存在',
        },
      },
      ja: {
        memory: {
          detailTitle: 'メモリー詳細',
          edit: '編集',
          categoryLabel: 'カテゴリ',
          contentLabel: '内容',
          createdAt: '作成',
          notFound: 'メモリー項目が存在しません',
        },
      },
      ko: {
        memory: {
          detailTitle: '메모리 상세',
          edit: '편집',
          categoryLabel: '카테고리',
          contentLabel: '내용',
          createdAt: '생성',
          notFound: '메모리 항목을 찾을 수 없습니다',
        },
      },
    },
    ledger: [
      {
        web: 'memory/[id]',
        rn: 'apps/mobile-rn/src/screens/MemoryDetailScreen.tsx',
        status: 'aligned',
        note:
          'Wave3@2026-10-26: 新建共享屏 packages/app/src/features/memory/MemoryDetailScreen.tsx' +
          '(徽章行 类型/作用域/来源 + 只读态分类标题与正文 + 编辑态两字段 + 删除)+薄壳。' +
          '零新增端点文件:与同域既有薄壳 apps/mobile-rn/src/screens/MemoryScreen.tsx:74 同一口径' +
          '(fetchApi 直连 + @ihui/types 契约),后端证据 apps/api/src/routes/memory.ts:158 GET /memory' +
          '→:181 success({entries,total})、:185 POST→:212 201 success(entry)、:216 DELETE /memory/:id' +
          '→:236 success({id,deleted})/:240 未命中 404、createEntrySchema :41-51(text 1-2000)。' +
          '详情非独立端点:web PageClient.tsx:47-48 亦「拉全量列表按 id 命中」,RN 复刻;保存 = DELETE+POST' +
          '两步(web PageClient.tsx:73-80 逐字同做法,后端无 PUT/PATCH),不造第三种动作。' +
          'api-client memory.ts 未复用:那份是 CLI 形态(listMemories 必带 apiBaseUrl+userId,:' +
          '22-35),与 RN 会话态(令牌即身份)不同契约,塞进它等于造第二份真相。' +
          '遗留:回列表不自动重取(MemoryScreen 无 focus 重取,铁律「只新建文件」不可改),' +
          '更新出口是列表自带下拉刷新。',
        at: '2026-10-26',
      },
    ],
  },
}

const pl = payloads[route]
if (!pl) throw new Error('未知路由键: ' + route)

for (const f of pl.newFiles) if (!m.newFiles.includes(f)) m.newFiles.push(f)
for (const e of pl.indexExports) if (!m.indexExports.includes(e)) m.indexExports.push(e)
for (const n of pl.navigator) {
  if (!m.navigator.some((x) => x.param === n.param)) m.navigator.push(n)
}
for (const l of pl.ledger) {
  if (!m.ledger.some((x) => x.web === l.web)) m.ledger.push(l)
}
mergeI18n(m.i18n, pl.i18n)

write(m)
console.log('appended', route, '| files=' + m.newFiles.length, 'ledger=' + m.ledger.length)
