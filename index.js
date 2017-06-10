'use strict'

// Native API
const path       = require('path')
const fs         = require('fs')
const { stdout } = require('process')
const events     = require('events')

// Third-party dependencies
const strftime   = require('strftime')
const { indexOf, concat, isObject, has, isString, pull, keys, isUndefined } = require('lodash')


class Log {
  constructor(opts={}) {
    // Internal properties
    this._req_levels = [
        'emergency'
      , 'alert'
      , 'critical'
      , 'error'
      , 'warn'
      , 'notice'
      , 'info'
      , 'debug'
    ]
    this._custom_levels = []
    this._level = this._prefix = ''
    // Create methods for each level
    for (let i in this.getLevels())
      this._addPriorityMethod(this.getLevels()[i])
    // Configured properties
    this.level     = opts.level     || 'notice'
    this.prefix    = opts.prefix    || '%Y-%m-%d %H:%M:%S -'
    this.dir       = opts.dir       || path.join('./', 'logs')
    this.filename  = opts.filename  || `log_${strftime('%Y%m%d_%H%M%S')}.txt`
    this.showLabel = isUndefined(opts.showLabel) ? true : false
    this.stdout    = isUndefined(opts.stdout) ? true : false
    this.file      = isUndefined(opts.file) ? false : true

    events.EventEmitter.call(this)
  }

  _addPriorityMethod(level) {
    this[level] = msg => {
      if (isObject(msg)) {
        if (has(msg, this.level) && this.getLevels().includes(this.level))
          return this[level](msg[this.level])
        else if (has(msg, 'default')) {
          return this[level](msg['default'])
        }
      }
      if (indexOf(this.getLevels(), this.level) >= indexOf(this.getLevels(), level)) {
        console.log(this.showLabel)
        msg = this.showLabel ? `[${level.toUpperCase()}] ${msg}` : msg
        this.write(msg)
        // Emit event with log info
        this.emit('entry', {
           timestamp: new Date()
         , levelIndex: indexOf(this.getLevels(), level)
         , level: level.toUpperCase()
         , prefix: this.prefix
         , msg: msg
        })
        return msg
      }
    }
  }

  get level() { // Current level
    return this._level
  }

  set level(logLevel) { // Set level
    logLevel = logLevel.toLowerCase()
    if (!this.getLevels().includes(logLevel)) {
      throw new Error(`Cannot set log level to '${logLevel}'`)
    } else {
      this._level = logLevel
    }
  }

  get prefix() { // Prepended string to output
    // Render timestamps
    return strftime(this._prefix)
  }

  set prefix(logPrefix) {
    this._prefix = logPrefix
  }

  getFilepath() { // Output filepath
    return path.resolve(path.join(this.dir, this.filename))
  }

  getLevels() { // Required & custom levels
    return concat(this._req_levels, this._custom_levels)
  }

  get levelIndex() {
    return indexOf(this.getLevels(), this.level)
  }

  set levelIndex(index) {
    if (this.getLevels()[index])
      this.level = this.getLevels()[index]
      return this.level
  }

  levelIndex() { // Deprecated in favor of log.levelIndex property
    return this.levelIndex
  }

  write(options) { // Handle output
    // Output non-object
    if (!isObject(options)) {
      let output = this.prefix ? this.prefix + ' ' + options : options
      // File output
      if (this.file) {
        // Create directory and file if they do not exist
        if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir);
        if (!fs.existsSync(this.getFilepath()))
          fs.writeFileSync(this.getFilepath(), '');
        // Append message to log file
        fs.appendFile(this.getFilepath(), output + '\r\n', err => {
          if (err) throw new Error(lerr)
        })
      }
      // Standard out
      if (this.stdout) {
        stdout.write(output + '\r\n')
      }
    // Split-output handling
    } else if (isObject(options)) {
      if (has(options, this.level) && isObject(options[this.level]))
        this[this.level](options[this.level])
    }
  }

  addLevel(level) { // Add user-defined level
    if (isString(level)) {
      this._custom_levels.push(level)
      // Define method for custom level
      this._addPriorityMethod(level)
      return this.getLevels()
    } else
      throw new Error('Custom level names must be type String')
  }

  removeLevel(level) { // Remove user-defined level
    if (this._custom_levels.includes(level)) {
      pull(this._custom_levels, level)
      // Remove method for level
      delete this[level]
      // Set level to DEBUG if current level has been removed
      this.level = this.level === level ? 'debug' : this.level
      return level
    }
  }
}


Log.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Log
