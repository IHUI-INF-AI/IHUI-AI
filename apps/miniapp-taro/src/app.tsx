import { type PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { checkLoginStatus } from './utils/auth'
import './app.css'

function App({ children }: PropsWithChildren<unknown>) {
  useLaunch(() => { checkLoginStatus() })
  return children
}

export default App
