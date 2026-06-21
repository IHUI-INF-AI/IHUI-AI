const util = require('util')

if (typeof util.isRegExp !== 'function') {
  util.isRegExp = value => value instanceof RegExp
}
