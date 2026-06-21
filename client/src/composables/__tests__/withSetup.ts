import { createApp, defineComponent, type App } from 'vue'

export interface SetupResult<T> {
  result: T
  app: App
  unmount: () => void
}

export function withSetup<T>(useComposable: () => T): SetupResult<T> {
  let result!: T

  const app = createApp(
    defineComponent({
      name: 'ComposableTestHost',
      setup() {
        result = useComposable()
        return () => null
      },
    })
  )

  const container = document.createElement('div')
  app.mount(container)

  return {
    result,
    app,
    unmount: () => app.unmount(),
  }
}
