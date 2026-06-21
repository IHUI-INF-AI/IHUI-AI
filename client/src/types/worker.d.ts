declare let self: DedicatedWorkerGlobalScope

interface WorkerMessage<T = unknown> {
  type: string
  id: string
  data: T
}

interface WorkerResponse<T = unknown> {
  type: string
  id: string
  result?: T
  error?: string
  progress?: number
}

interface WorkerTask {
  resolve: (value: any) => void
  reject: (error: Error) => void
}

type WorkerMessageHandler<T = unknown, R = unknown> = (
  data: T
) => Promise<R> | R

interface CompressData {
  file: File
  options: {
    quality?: number
    maxWidth?: number
    maxHeight?: number
  }
}

interface ThumbnailData {
  file: File
  size: number
}

interface HashData {
  file: File
}

interface ChunkData {
  file: File
  chunkSize: number
}

interface FileTreeItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  file?: File
  children?: FileTreeItem[]
}

interface FolderUploadResult {
  files: File[]
  tree: FileTreeItem
  totalSize: number
  fileCount: number
}

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

type TransferableType = ArrayBuffer

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void
}

interface FetchEvent extends Event {
  request: Request
  respondWith(response: Promise<Response> | Response): void
}

type InstallEvent = ExtendableEvent
type ActivateEvent = ExtendableEvent

interface PushEvent extends ExtendableEvent {
  data: PushMessageData | null
}

interface PushMessageData {
  json(): any
  text(): string
  arrayBuffer(): ArrayBuffer
  blob(): Blob
}

interface NotificationEvent extends ExtendableEvent {
  notification: Notification
  action: string
}

interface SyncEvent extends ExtendableEvent {
  tag: string
}

interface Clients {
  claim(): Promise<void>
  matchAll(options?: { includeUncontrolled?: boolean; type?: ClientTypes }): Promise<Client[]>
  get(id: string): Promise<Client | undefined>
  openWindow(url: string): Promise<WindowClient | undefined>
}

interface Client {
  id: string
  type: ClientTypes
  url: string
  postMessage(message: any, transfer?: TransferableType[]): void
}

interface WindowClient extends Client {
  focused: boolean
  visibilityState: 'visible' | 'hidden' | 'prerender' | 'unloaded'
  focus(): Promise<WindowClient>
  navigate(url: string): Promise<WindowClient | undefined>
}

type ClientTypes = 'window' | 'worker' | 'sharedworker' | 'all'

interface Cache {
  match(request: Request | string, options?: CacheQueryOptions): Promise<Response | undefined>
  matchAll(request?: Request | string, options?: CacheQueryOptions): Promise<Response[]>
  add(request: Request | string): Promise<void>
  addAll(requests: (Request | string)[]): Promise<void>
  put(request: Request | string, response: Response): Promise<void>
  delete(request: Request | string, options?: CacheQueryOptions): Promise<boolean>
  keys(request?: Request | string, options?: CacheQueryOptions): Promise<Request[]>
}

interface CacheQueryOptions {
  ignoreSearch?: boolean
  ignoreMethod?: boolean
  ignoreVary?: boolean
  cacheName?: string
}

interface CacheStorage {
  match(request: Request | string, options?: CacheQueryOptions): Promise<Response | undefined>
  has(cacheName: string): Promise<boolean>
  open(cacheName: string): Promise<Cache>
  delete(cacheName: string): Promise<boolean>
  keys(): Promise<string[]>
}

interface RegistrationOptions {
  scope?: string
  type?: 'classic' | 'module'
  updateViaCache?: 'imports' | 'all' | 'none'
}

declare const clients: Clients
declare const caches: CacheStorage
declare const registration: ServiceWorkerRegistration
