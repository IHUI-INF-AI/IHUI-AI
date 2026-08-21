/**
 * @react-native-clipboard/clipboard mock for vitest/jsdom environment
 */

export default {
  getString: () => Promise.resolve(''),
  setString: () => {},
  hasString: () => Promise.resolve(false),
}
