# Split Log

> Split-level logging to multiple destinations

## Install

```console
npm i split-log
```

## Usage

```javascript
const Log = require('split-log')
let log = new Log({ file: true })
log.notice('Hear ye!')
// Writes '[NOTICE] Hear ye!' to console and file
```

Choose from [syslog](http://www.kiwisyslog.com/help/syslog/index.html?protocol_levels.htm)-style log levels (0: **Emergency**, 1: **Alert**, 2: **Critical**, 3: **Error**, 4: **Warn**, 5: **Notice**, 6: **Info**, 7: **Debug**)...

```javascript
// Log events at 'info' level and lower
log.level = 'info'
log.debug('Malformed request at object "Reactor"')
log.emergency('Nuclear meltdown imminent!')
// Output:
// [EMERGENCY] Nuclear meltdown imminent!
```

... or define custom levels

```javascript
log.addLevel('sneeze')
// Log events at 'sneeze' level and lower
log.level = 'sneeze'
log.sneeze('Achoo!')
// Output:
// [SNEEZE] Achoo!
```

Log unique output based on the set log level rather than falling through to lower levels

```javascript
log.level = 'error'
log.write({
  info:  'Everything is going to be OK',
  warn:  'There might be a small problem',
  error: 'The world will end in five minutes',
  alert: 'This is all your fault'
})
// Output:
// [ERROR] The world will end in five minutes
log.write({
  debug:    'Cannot find module "split-log"',
  info:     'Space station telemetry went OK',
  notice:   'Network latency has increased 578%',
  critical: 'The CPU is on fire'
})
// No output since level is set to 'error'
```

Split the log further with events!

**Example:** Using [Nodemailer](https://nodemailer.com/about/)

```javascript
// Set up email support
const nodemailer = require('nodemailer')
nodemailer.createTransport('smtps://user%40gmail.com:pass@smtp.gmail.com')

function sendBadNews(entry) {
  // If the log entry is 'critical' or lower...
  if (entry.levelIndex <= 3) {
    // ... email the log entry to the sysadmin
    let msg = entry.msg
    let mailOptions = {
      from: '"Bad News Bot" <badnewsbot@badco.co>',
      to: 'sysadmin@badco.co',
      subject: 'Bad News, Buddy',
      text: 'There was an issue with the important software: ' + msg
    }
    transporter.sendMail(mailOptions)  
  }
}

// Listen for output events
log.on('entry', sendBadNews)

server.on('explosion', () => {
  // Log entry triggers the 'entry'
  log.alert('The server exploded again.')
})
```

# API

## Class: Log

> Handles logging configuration and output

`Log` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_events_eventemitter)

Creates a new `Log` with properties set by `options`

### `new Log([options])`

* `options` Object (optional)
  * `level` String (optional) - Specifies priority level based on [syslog](http://www.kiwisyslog.com/help/syslog/index.html?protocol_levels.htm) conventions or custom levels. Default is `notice`.
  * `stdout` Boolean (optional) - Whether to write log entries to stdout (console). Default is `true`.
  * `file` Boolean (optional) - Whether to write log entries to file. Default is `false`.
  * `filename` String (optional) - Name of file to which log entries are written. Default is `log_<YYYYMMDD_HHMMSS>.txt` where `<YYYYMMDD_HHMMSS>` is a string-formatted timestamp representing when the log instance was created.
  * `dir` String (optional) - Specifies directory to store log files. Default is `./logs/` (**NOTE:** If `dir` does not exist, it will be created only when a log file is written).
  * `showLabel` Boolean (optional) - Whether to prepend `level` label to each log entry (ex. `[INFO] Some information`). Default is `true`
  * `prefix` - String (optional) - String to prepend to each log entry (written *before* `label`). Supports [strftime](https://github.com/samsonjs/strftime) formatting for generating timestamps. Default is timestamp in 'YYYY-MM-DD HH:MM:SS -' format.

### Instance Events

Objects created with `new Log` emit the following event:

#### Event: 'entry'

Returns:

* `entry` Object
  * `timestamp` Date - When the entry was emitted
  * `level` String - Priority level that fired the event
  * `levelIndex` Integer - Numeric representation of priority level that fired the event (lower numbers = higher priority)
  * `prefix` String - Prefix or timestamp applied to log entry
  * `msg` String - Log message without `prefix` (will include label if `showLabel` is `true`)

### Instance Properties

Objects created with `new Log` have the following properties:

#### `log.level`

A `String` representing the current log level (must be an item returned in `log.getLevels()` array).

#### `log.stdout`

A `Boolean` indicating whether log entries will be written to stdout (console).

#### `log.file`

A `Boolean` indicating whether log entries will be written to file (filepath specified by `log.getFilepath()`).

#### `log.filename`

A `String` representing the name of the file to which log entries are written.

#### `log.dir`

A `String` representing the directory to which log files are written.

#### `log.showLabel`

A `Boolean` indicating whether bracketed labels will be prepended to log entries noting their priority level.

#### `log.prefix`

A `String` to prepend to log entries (before labels). Supports [strftime](https://github.com/samsonjs/strftime) formatting for generating timestamps.

### Instance Methods

Objects created with `new Log` have the following instance methods:

#### `log.[priority](message)`

**All priority levels returned by `log.getLevels()` (including custom levels) can be used as instance methods.** Calling a level as a method writes `message` to logging destinations when `log.level` is set to a priority with a `levelIndex` at or above the method's level.

**Example:**

```javascript
log.level = 'notice' // log.levelIndex('notice') === 5
log.debug('Hark! A bug!') // log.levelIndex('debug') === 7
// No output
log.error('Hark! An error!') //log.levelIndex('error') === 3
// Output: [ERROR] Hark! An error!
log.addLevel('sneeze')
log.level = 'sneeze' // log.levelIndex('sneeze') === 8
log.debug('Hark! A bug!') // log.levelIndex('debug') === 7
// Output: [DEBUG] Hark! A bug!
```

For writing messages exclusive to the level set at `log.level`, see `log.write(Object)`.

#### `log.getLevels()`

Returns an `Array` of available log levels, including default [syslog](http://www.kiwisyslog.com/help/syslog/index.html?protocol_levels.htm) levels and custom levels set by `log.addLevel`.

#### `log.levelIndex(level)`

Returns an `Integer` representing the index of `level` in relation to the `Array` returned by `log.getLevels()`, used for prioritizing log messages.

#### `log.getFilepath()`

Returns a `String` representing the absolute filepath to the current log file.

#### `log.addLevel(level)`

Adds `level`, where `level` is of type `String`, to the list of levels returned by `log.getLevels()` that can be used as an instance method.

Returns `Array` of available priority levels.

**Notes:**

* `newLevel` Strings are case-insensitive and will be converted to lowercase
* Custom priority levels are assigned a `levelIndex` in order of their creation, starting at `8` when passed as an `entry` object by the 'entry' event
* Default priority levels cannot be overwritten by `log.addLevel` but custom priority levels can be overwritten

#### `log.removeLevel(level)`

Removed `level`, where `level` is of type `String`, from the list of available priority levels returned by `log.getLevels()`. Levels with a `levelIndex` greater than `level`'s former index are decremented by `1`.

Returns `String` representing the removed level

**Notes:**

* `removeLevel` cannot remove any of the default priority levels.
* If the level being removed is currently in use as the log's priority, the log's priority will be set to 'debug'

#### `log.write(object)`

`Object` is a set of key-value pairs, where keys are priority levels and values are messages to output if `log.level` matches the key. Unlike level methods such as `log.warn(message)`, `log.write(object)` will only output the message associated with the priority. If no output is set for the configured priority, no output will be produced, regardless of whether the `levelIndex` of `log.level` is greater than the priorities set in `log.write()`.

**Example:**

```javascript
log.level = 'warn'
log.write({
  debug:     'Hark! A bug!',
  info:      'FYI...',
  notice:    'Hear ye!',
  warn:      'I tried to tell you.',
  error:     'Uh oh.',
  critical:  'Mayday!',
  alert:     'Um. Excuse me.',
  emergency: 'Going down!'
})
// Output: [WARN] I tried to tell you.
```

#### `log.write(message)`

When `message` is of type `String`, `message` will be output without a label to logging destinations regardless of `log.level`. The entry prefix will still be prepended to `message` if configured.

**NOTE:** Using `log.write(message)` will not emit the 'entry' event.

### Author

Joshua Chumbley

### License

Licensed under MIT
