'use strict'

// Native API
const path             = require('path')
const fs               = require('fs')
const { EventEmitter } = require('events')

// Third-party dependencies
const strftime = require('strftime')
const { indexOf, concat, isObject, has,
        isString, pull, keys, isUndefined } = require('lodash')


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
    this._flevel = this._olevel = this._prefix = ''
    // Create methods for each level
    for (let i in this.getLevels())
      this._addPriorityMethod(this.getLevels()[i])
    // Configured properties
    this.level      = opts.level     || 'notice'
    this.fileLevel  = opts.fileLevel || this.level
    this.outLevel   = opts.outLevel  || this.level
    this.prefix     = opts.prefix    || '%Y-%m-%d %H:%M:%S -'
    this.dir        = opts.dir       || path.join('./', 'logs')
    this.filename   = opts.filename  || `log_${strftime('%Y%m%d_%H%M%S')}.txt`
    this.showLabel  = isUndefined(opts.showLabel)  ? true  : opts.showLabel
    this.stdout     = isUndefined(opts.stdout)     ? true  : opts.stdout
    this.file       = isUndefined(opts.file)       ? false : opts.file
    this.emitHidden = isUndefined(opts.emitHidden) ? false : opts.emitHidden

    EventEmitter.call(this)
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
      msg = this.showLabel ? `[${level.toUpperCase()}] ${msg}` : msg
      this.write(msg, level)
    }
  }

  get level() { // Current level
    return this._flevel === this._olevel ? this._flevel : { file: this._flevel, stdout: this._olevel }
  }

  set level(logLevel) { // Set level for file and stdout
    if (isObject(logLevel)) {
      if (has(logLevel, 'file')) this.fileLevel  = logLevel['file']
      if (has(logLevel, 'stdout')) this.outLevel = logLevel['stdout']
      return
    }
    this._flevel = this._olevel = logLevel
  }

  get fileLevel() {
    return this._flevel
  }

  set fileLevel(logLevel) { // Set levels for file
    logLevel = logLevel.toLowerCase()
    if (!this.getLevels().includes(logLevel)) {
      throw new Error(`Cannot set file log level to '${logLevel}'`)
    } else {
      this._flevel = logLevel
    }
  }

  get outLevel() {
    return this._olevel
  }

  set outLevel(logLevel) { // Set level for stdout
    logLevel = logLevel.toLowerCase()
    if (!this.getLevels().includes(logLevel)) {
      throw new Error(`Cannot set stdout log level to '${logLevel}'`)
    } else {
      this._olevel = logLevel
    }
  }

  getLevels() { // Required & custom levels
    return concat(this._req_levels, this._custom_levels)
  }

  get levelIndex() {
    let fi = indexOf(this.getLevels(), this.fileLevel),
        oi = indexOf(this.getLevels(), this.outLevel)

    return fi === oi ? fi : { file: fi, stdout: oi }
  }

  set levelIndex(index) {
    if (isObject(index)) {
      if (has(index, 'file')) this.fileLevel = this.getLevels()[index['file']]
      if (has(index, 'stdout')) this.outLevel = this.getLevels()[index['stdout']]
      return
    }
    this.fileLevel = this.outLevel = this.getLevels()[index]
  }

  levelIndexOf(level) { // Returns priority index of a log level
    return indexOf(this.getLevels(), level)
  }

  levelIndex() { // Deprecated in favor of log.levelIndex property
    return this.levelIndex
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



  write(options, level=null) { // Handle output
    // Output non-object
    if (!isObject(options)) {
      let output = this.prefix ? this.prefix + ' ' + options : options
      // File output
      if (this.file && (!level || this.levelIndexOf(this.fileLevel) >= this.levelIndexOf(level))) {

        // Create directory and file if they do not exist
        if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir)
        if (!fs.existsSync(this.getFilepath())) fs.writeFileSync(this.getFilepath(), '')

        let f = { name: this.filename, path: this.getFilepath() }
        fs.stat(this.getFilepath(), (err, stats) => {
          if (err) throw err
          f.size = stats.size
          f.modified = stats.mtime
          f.created = stats.birthtime
          this.emit('willWriteFile', f)
          // Append message to log file
          fs.appendFile(this.getFilepath(), output + '\r\n', err => {
            if (err) throw new Error(err)
            fs.stat(this.getFilepath(), (err, stats) => {
              f.size = stats.size
              f.modified = stats.mtime
              this.emit('writeFile', f)
              f = null
            })
          })
        })
      }
      // Standard output
      if (this.stdout && (!level || this.levelIndexOf(this.outLevel) >= this.levelIndexOf(level))) {
        console.log(output)
      }
      // Entry event
      if (!this.emitHidden) {
        let fl = this.levelIndexOf(this.fileLevel), // fileLevel index
            ol = this.levelIndexOf(this.outLevel),  // outLevel index
            el = fl > ol ? fl : ol                  // event level = greatest index
        if (!level || el >= this.levelIndexOf(level)) {
          // Emit event with log info
          this.emit('entry', {
             timestamp: new Date()
           , levelIndex: indexOf(this.getLevels(), level)
           , level: level.toUpperCase()
           , prefix: this.prefix
           , msg: output
          })
        }
      } else {
        // Emit event with log info
        this.emit('entry', {
           timestamp: new Date()
         , levelIndex: indexOf(this.getLevels(), level)
         , level: level.toUpperCase()
         , prefix: this.prefix
         , msg: output
        })
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


Log.prototype.__proto__ = EventEmitter.prototype;

module.exports = Log
