interface FileSystemEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  fullPath: string
  filesystem: FileSystem
}

interface FileSystemFileEntry extends FileSystemEntry {
  file(callback: (file: File) => void): void
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader(): FileSystemDirectoryReader
}

interface FileSystemDirectoryReader {
  readEntries(callback: (entries: FileSystemEntry[]) => void): void
}

interface FileSystem {
  root: FileSystemDirectoryEntry
}

interface DataTransferItem {
  webkitGetAsEntry(): FileSystemEntry | null
}

interface DataTransferItemList {
  length: number
  item(index: number): DataTransferItem | null
  [Symbol.iterator](): Iterator<DataTransferItem>
}
