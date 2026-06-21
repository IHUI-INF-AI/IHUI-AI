import { API_ENDPOINTS } from '@aizhs/shared-api'
import type { ApiResponse, HomePageResource, InformationItem, KnowledgePlanetItem } from '@aizhs/shared-types'
import type { SharedRequestAdapter } from './request-adapter'
import { normalizeApiResponse } from './request-adapter'

export async function getCoursePlanet(
  adapter: SharedRequestAdapter,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.RESOURCE.COURSE_PLANET,
    method: 'GET',
    data: {},
  })

  return normalizeApiResponse(response)
}

export async function getKnowledgePlanetInfo(
  adapter: SharedRequestAdapter,
  type: string,
): Promise<ApiResponse<KnowledgePlanetItem[]>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.RESOURCE.KNOWLEDGE_PLANET,
    method: 'GET',
    data: { type },
  })

  return normalizeApiResponse<KnowledgePlanetItem[]>(response)
}

export async function getInformationDictionary(
  adapter: SharedRequestAdapter,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.INFORMATION.DICTIONARY,
    method: 'GET',
  })

  return normalizeApiResponse(response)
}

export async function getInformationList(
  adapter: SharedRequestAdapter,
  params: { type?: string; insertTime?: string; informationType?: string } = {},
): Promise<ApiResponse<InformationItem[]>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.INFORMATION.LIST,
    method: 'GET',
    data: { ...params },
  })

  return normalizeApiResponse<InformationItem[]>(response)
}

export async function getPopularCourses(
  adapter: SharedRequestAdapter,
  type: string | number,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.RESOURCE.POPULAR_COURSES,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    data: { type },
  })

  return normalizeApiResponse(response)
}

export async function getPlantInformation(
  adapter: SharedRequestAdapter,
  id: string | number,
): Promise<ApiResponse<unknown>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.RESOURCE.PLANT_INFORMATION,
    method: 'GET',
    data: { id },
  })

  return normalizeApiResponse(response)
}

export async function getHomePageResources(
  adapter: SharedRequestAdapter,
  position?: string,
): Promise<ApiResponse<HomePageResource[]>> {
  const response = await adapter.request<unknown>({
    url: API_ENDPOINTS.RESOURCE.HOME_PAGE_RESOURCES,
    method: 'GET',
    data: { position },
  })

  return normalizeApiResponse<HomePageResource[]>(response)
}
