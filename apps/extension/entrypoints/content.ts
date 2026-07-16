export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.info('IHUI AI content script loaded')
  },
})
