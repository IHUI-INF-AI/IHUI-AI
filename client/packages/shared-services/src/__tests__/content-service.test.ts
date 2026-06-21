import { describe, expect, it } from 'vitest'
import {
  getCoursePlanet,
  getHomePageResources,
  getInformationDictionary,
  getInformationList,
  getKnowledgePlanetInfo,
} from '../content-service'
import type { SharedRequestAdapter, SharedRequestConfig } from '../request-adapter'

function createAdapter(handler: (config: SharedRequestConfig) => unknown | Promise<unknown>): SharedRequestAdapter {
  return {
    async request<TResponse = unknown>(config: SharedRequestConfig): Promise<TResponse> {
      return handler(config) as Promise<TResponse>
    },
  }
}

describe('shared-services/content-service', () => {
  it('requests course planet and knowledge planet', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: [] }
    })

    await getCoursePlanet(adapter)
    await getKnowledgePlanetInfo(adapter, '1')

    expect(requests[0]).toMatchObject({
      url: '/resource/getCoursePlanet',
      method: 'GET',
    })
    expect(requests[1]).toMatchObject({
      url: '/resource/getKnowledgePlanet',
      method: 'GET',
      data: { type: '1' },
    })
  })

  it('requests information dictionary and list', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: [] }
    })

    await getInformationDictionary(adapter)
    await getInformationList(adapter, { type: 'news' })

    expect(requests[0]).toMatchObject({
      url: '/information/dictionary',
      method: 'GET',
    })
    expect(requests[1]).toMatchObject({
      url: '/information/list',
      method: 'GET',
      data: { type: 'news' },
    })
  })

  it('requests home page resources', async () => {
    let capturedConfig: SharedRequestConfig | undefined
    const adapter = createAdapter((config) => {
      capturedConfig = config
      return { code: 200, data: [{ id: 1, title: 'Banner' }] }
    })

    await getHomePageResources(adapter, 'top')

    expect(capturedConfig).toMatchObject({
      url: '/resource/getHomePageResources',
      method: 'GET',
      data: { position: 'top' },
    })
  })
})
