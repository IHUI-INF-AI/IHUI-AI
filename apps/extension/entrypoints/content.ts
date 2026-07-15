export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('IHUI AI content script loaded')
  },
})
