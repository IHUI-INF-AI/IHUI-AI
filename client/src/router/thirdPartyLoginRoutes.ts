import type { RouteRecordRaw, RouteComponent } from 'vue-router'

const asyncComponent = <T extends Promise<{ default: unknown }>>(
  loader: () => T
): RouteComponent => loader as unknown as RouteComponent

const THIRD_PARTY_CALLBACK_ROUTES = ['callback', 'GoogleCallback', 'AppleCallback'] as const

export function isThirdPartyCallbackRoute(routeName: string | symbol | null | undefined): boolean {
  if (!routeName) return false
  const name = typeof routeName === 'symbol' ? routeName.toString() : routeName
  return THIRD_PARTY_CALLBACK_ROUTES.includes(name as typeof THIRD_PARTY_CALLBACK_ROUTES[number])
}

export function addThirdPartyLoginRoutes(routes: RouteRecordRaw[]): void {
  routes.push({
    path: '/callback',
    name: 'callback',
    component: asyncComponent(
      () => import('@/features/third-party-login/views/Callback.vue')
    ),
    meta: {
      title: 'routes.thirdPartyLogin',
    },
  })

  const platforms = [
    { path: '/google/callback', name: 'GoogleCallback' },
    { path: '/apple/callback', name: 'AppleCallback' },
  ]

  platforms.forEach(({ path, name }) => {
    routes.push({
      path,
      name,
      component: asyncComponent(
        () => import('@/features/third-party-login/views/Callback.vue')
      ),
      meta: {
        title: 'routes.thirdPartyLogin',
      },
    })
  })
}
