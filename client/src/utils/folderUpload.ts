interface FileTreeItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  file?: File
  children?: FileTreeItem[]
}

export interface FolderUploadResult {
  totalFiles: number
  totalSize: number
  uploadedFiles: number
  failedFiles: string[]
  tree: FileTreeItem
}

async function* getFilesFromDirectory(
  entry: FileSystemDirectoryEntry,
  path: string = ''
): AsyncGenerator<FileTreeItem> {
  const reader = entry.createReader()
  const items: FileTreeItem[] = []

  const readAllEntries = (): Promise<FileSystemEntry[]> => {
    return new Promise((resolve) => {
      const allEntries: FileSystemEntry[] = []
      const readBatch = () => {
        reader.readEntries((entries) => {
          if (entries.length === 0) {
            resolve(allEntries)
          } else {
            allEntries.push(...entries)
            readBatch()
          }
        })
      }
      readBatch()
    })
  }

  const entries = await readAllEntries()

  for (const childEntry of entries) {
    const childPath = path ? `${path}/${childEntry.name}` : childEntry.name

    if (childEntry.isFile) {
      const file = await new Promise<File>((resolve) => {
        (childEntry as FileSystemFileEntry).file(resolve)
      })

      items.push({
        name: childEntry.name,
        path: childPath,
        type: 'file',
        size: file.size,
        file
      })
    } else if (childEntry.isDirectory) {
      const childItem: FileTreeItem = {
        name: childEntry.name,
        path: childPath,
        type: 'directory',
        children: []
      }

      for await (const child of getFilesFromDirectory(
        childEntry as FileSystemDirectoryEntry,
        childPath
      )) {
        childItem.children!.push(child)
      }

      items.push(childItem)
    }
  }

  yield* items
}

export async function processDroppedItems(
  items: DataTransferItemList
): Promise<FileTreeItem[]> {
  const results: FileTreeItem[] = []

  for (const item of Array.from(items)) {
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry()
      if (entry) {
        if (entry.isFile) {
          const file = await new Promise<File>((resolve) => {
            (entry as FileSystemFileEntry).file(resolve)
          })
          results.push({
            name: entry.name,
            path: entry.name,
            type: 'file',
            size: file.size,
            file
          })
        } else if (entry.isDirectory) {
          const dirItem: FileTreeItem = {
            name: entry.name,
            path: entry.name,
            type: 'directory',
            children: []
          }

          for await (const child of getFilesFromDirectory(
            entry as FileSystemDirectoryEntry
          )) {
            dirItem.children!.push(child)
          }

          results.push(dirItem)
        }
      }
    }
  }

  return results
}

export function flattenFileTree(tree: FileTreeItem[]): File[] {
  const files: File[] = []

  const traverse = (items: FileTreeItem[]) => {
    for (const item of items) {
      if (item.type === 'file' && item.file) {
        const fileWithPath = new File([item.file], item.path, {
          type: item.file.type,
          lastModified: item.file.lastModified
        })
        files.push(fileWithPath)
      }
      if (item.children) {
        traverse(item.children)
      }
    }
  }

  traverse(tree)
  return files
}

export function countFilesInTree(tree: FileTreeItem[]): number {
  let count = 0

  const traverse = (items: FileTreeItem[]) => {
    for (const item of items) {
      if (item.type === 'file') {
        count++
      }
      if (item.children) {
        traverse(item.children)
      }
    }
  }

  traverse(tree)
  return count
}

export function getTotalSizeInTree(tree: FileTreeItem[]): number {
  let size = 0

  const traverse = (items: FileTreeItem[]) => {
    for (const item of items) {
      if (item.type === 'file' && item.size) {
        size += item.size
      }
      if (item.children) {
        traverse(item.children)
      }
    }
  }

  traverse(tree)
  return size
}

export function isFolderUploadSupported(): boolean {
  return 'webkitGetAsEntry' in DataTransferItem.prototype
}

export function useFolderUpload() {
  return {
    processDroppedItems,
    flattenFileTree,
    countFilesInTree,
    getTotalSizeInTree,
    isFolderUploadSupported
  }
}
