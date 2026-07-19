import { ModelsHeader } from './ModelsHeader'
import { ModelsNav } from './ModelsNav'
import { ModelsMarketplace } from './ModelsMarketplace'
import { PROVIDERS, fetchModels } from './helpers'
import type { Provider } from './types'

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>
}) {
  const { provider } = await searchParams

  const MODELS = await fetchModels()

  const active: Provider | 'all' =
    provider && (PROVIDERS as string[]).includes(provider) ? (provider as Provider) : 'all'

  const list = active === 'all' ? MODELS : MODELS.filter((m) => m.provider === active)

  const total = list.length
  const freeCount = list.filter((m) => m.inputPrice === 0).length
  const providerCount = new Set(list.map((m) => m.provider)).size
  const highlightCount = list.filter((m) => m.highlight).length

  return (
    <div className="space-y-6">
      <ModelsHeader
        total={total}
        freeCount={freeCount}
        providerCount={providerCount}
        highlightCount={highlightCount}
      />
      <ModelsNav active={active} />
      <ModelsMarketplace list={list} />
    </div>
  )
}
