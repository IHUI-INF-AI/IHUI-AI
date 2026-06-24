/**
 * Edu Pinia store entry (Phase C)
 *
 * Aggregate export of all edu domain stores. Pattern mirrors src/stores/auth/index.ts.
 *
 * Sub-stores:
 * - useEduLearnStore: course learning state (enrolled courses, progress, certificates)
 * - useEduAskStore: Q&A state (questions, answers, user stats)
 * - useEduCircleStore: Circle state (joined circles, posts, membership)
 * - useEduMemberStore: Member profile + points balance
 * - useEduLiveStore: Live room list + attendance
 */

export { useEduLearnStore } from './learn'
export { useEduAskStore } from './ask'
export { useEduCircleStore } from './circle'
export { useEduMemberStore } from './member'
export { useEduLiveStore } from './live'

import { useEduLearnStore } from './learn'
import { useEduAskStore } from './ask'
import { useEduCircleStore } from './circle'
import { useEduMemberStore } from './member'
import { useEduLiveStore } from './live'

export const useEduStore = () => ({
  learn: useEduLearnStore(),
  ask: useEduAskStore(),
  circle: useEduCircleStore(),
  member: useEduMemberStore(),
  live: useEduLiveStore(),
})