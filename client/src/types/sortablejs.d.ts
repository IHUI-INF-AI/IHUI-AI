/**
 * sortablejs 类型声明 (项目未安装 @types/sortablejs, 且私有源无法拉取时的最小声明)
 * 覆盖 AiFeedPanel.vue 中使用的 API: Sortable.create / onEnd 回调 / evt.to 等。
 */
declare module 'sortablejs' {
  export interface SortableEvent {
    /** 拖拽结束所在容器 */
    to: Element
    /** 拖拽起始容器 */
    from: Element
    /** 被拖拽的元素 */
    item: Element
    /** 拖拽元素的克隆 */
    clone: Element
    oldIndex?: number | null
    newIndex?: number | null
    oldDraggableIndex?: number | null
    newDraggableIndex?: number | null
    pullMode?: boolean | string | null
    [key: string]: unknown
  }

  export interface SortableOptions {
    animation?: number
    chosenClass?: string
    dragClass?: string
    draggable?: string
    ghostClass?: string
    group?: string | { name: string; pull?: string | boolean; put?: string | boolean }
    handle?: string
    filter?: string
    onEnd?: (evt: SortableEvent) => void
    onStart?: (evt: SortableEvent) => void
    onSort?: (evt: SortableEvent) => void
    [key: string]: unknown
  }

  export default class Sortable {
    static create(element: Element, options?: SortableOptions): Sortable
    constructor(element: Element, options?: SortableOptions)
    destroy(): void
    option<K extends keyof SortableOptions>(name: K, value: SortableOptions[K]): void
    toArray(): string[]
    sort(order: string[]): void
  }
}
