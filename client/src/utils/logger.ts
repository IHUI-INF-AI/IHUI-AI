const noop = () => {}

export const logger = {
  info: process.env.NODE_ENV === 'production' ? noop : console.info.bind(console, '[INFO]'),
  warn: process.env.NODE_ENV === 'production' ? noop : console.warn.bind(console, '[WARN]'),
  error: console.error.bind(console, '[ERROR]'),
  debug: process.env.NODE_ENV === 'production' ? noop : console.debug.bind(console, '[DEBUG]'),
}

export default logger
