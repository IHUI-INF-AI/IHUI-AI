import { ref } from 'vue'

export interface MultiSearchResult {
  docId: string
  docTitle: string
  matches: {
    page: number
    text: string
    index: number
  }[]
}

export interface MultiSearchOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  useRegex?: boolean
}

export const useMultiDocSearch = () => {
  const searchResults = ref<MultiSearchResult[]>([])
  const isSearching = ref(false)
  const searchProgress = ref(0)
  const totalDocuments = ref(0)
  const searchedDocuments = ref(0)

  const searchInDocument = async (
    docId: string,
    docTitle: string,
    textContents: Map<number, string>,
    query: string,
    options: MultiSearchOptions = {}
  ): Promise<MultiSearchResult | null> => {
    if (!query || query.trim() === '') return null

    const matches: { page: number; text: string; index: number }[] = []
    const { caseSensitive = false, wholeWord = false, useRegex = false } = options

    let searchPattern: RegExp | string
    if (useRegex) {
      try {
        searchPattern = new RegExp(query, caseSensitive ? 'g' : 'gi')
      } catch {
        return null
      }
    } else {
      searchPattern = caseSensitive ? query : query.toLowerCase()
    }

    textContents.forEach((text, page) => {
      const searchText = caseSensitive ? text : text.toLowerCase()

      if (useRegex) {
        const regex = searchPattern as RegExp
        let match
        const textToSearch = searchText
        while ((match = regex.exec(textToSearch)) !== null) {
          matches.push({
            page,
            text: match[0],
            index: match.index
          })
        }
      } else {
        let index = 0
        const pattern = searchPattern as string
        while (true) {
          const foundIndex = searchText.indexOf(pattern, index)
          if (foundIndex === -1) break

          if (wholeWord) {
            const beforeChar = foundIndex > 0 ? searchText[foundIndex - 1] : ' '
            const afterChar = foundIndex + pattern.length < searchText.length
              ? searchText[foundIndex + pattern.length]
              : ' '
            if (/\w/.test(beforeChar) || /\w/.test(afterChar)) {
              index = foundIndex + 1
              continue
            }
          }

          matches.push({
            page,
            text: text.substring(foundIndex, foundIndex + query.length),
            index: foundIndex
          })
          index = foundIndex + 1
        }
      }
    })

    if (matches.length === 0) return null

    return { docId, docTitle, matches }
  }

  const searchMultiple = async (
    documents: { id: string; title: string; textContents: Map<number, string> }[],
    query: string,
    options: MultiSearchOptions = {}
  ) => {
    searchResults.value = []
    isSearching.value = true
    searchProgress.value = 0
    totalDocuments.value = documents.length
    searchedDocuments.value = 0

    for (const doc of documents) {
      const result = await searchInDocument(doc.id, doc.title, doc.textContents, query, options)
      if (result) {
        searchResults.value.push(result)
      }
      searchedDocuments.value++
      searchProgress.value = (searchedDocuments.value / totalDocuments.value) * 100
    }

    isSearching.value = false
    return searchResults.value
  }

  const clearResults = () => {
    searchResults.value = []
    searchProgress.value = 0
    searchedDocuments.value = 0
  }

  return {
    searchResults,
    isSearching,
    searchProgress,
    totalDocuments,
    searchedDocuments,
    searchInDocument,
    searchMultiple,
    clearResults
  }
}
