import { type PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { checkLoginStatus } from './utils/auth'
import { I18nProvider } from './i18n'
import './app.css'

function App({ children }: PropsWithChildren<unknown>) {
  useLaunch(() => {
    checkLoginStatus()
  })
  return <I18nProvider>{children}</I18nProvider>
}

export default App
