import { initApi } from '../lib/token'

export default defineBackground(() => {
  initApi()
  console.log('IHUI AI background started')
})
