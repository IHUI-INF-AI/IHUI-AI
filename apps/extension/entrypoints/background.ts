import { initApi } from '../lib/token'

export default defineBackground(() => {
  initApi()
  console.info('IHUI AI background started')
})
