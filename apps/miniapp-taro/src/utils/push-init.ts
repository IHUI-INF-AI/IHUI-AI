// Backward-compat re-export shim.
// Original implementation merged into ./push on 2026-07-27.
// This file is kept only because src/app.tsx imports { initPushSubscription } from './utils/push-init';
// deleting it would break that import (caller modification is out of scope for the merge task).
export {
  fetchPushTemplates,
  initPushSubscription,
  requestPushSubscription,
} from './push'