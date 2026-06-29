/**
 * Type declarations for highlight.js deep imports (language modules).
 *
 * highlight.js ships its own types for the main package and lib/core,
 * but individual language modules under lib/languages/ lack .d.ts files.
 * This file provides minimal ambient declarations for the 13 languages
 * actually imported by utils/highlight.ts.
 *
 * Previously declared 248 modules (1240 lines); trimmed to 13 in-use.
 */

declare module 'highlight.js/lib/languages/javascript' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/typescript' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/python' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/java' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/css' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/scss' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/xml' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/json' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/bash' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/sql' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/markdown' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/yaml' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}

declare module 'highlight.js/lib/languages/dockerfile' {
  import type { Language } from 'highlight.js'
  const lang: Language
  export default lang
}
