import pino from 'pino'

/**
 * https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
 */
const PinoLevelToSeverityLookup = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
}

const gcloudConf: pino.LoggerOptions = {
  messageKey: 'message',
  formatters: {
    level(label, number) {
      return {
        severity:
          PinoLevelToSeverityLookup[label] || PinoLevelToSeverityLookup.info,
        level: number,
      }
    },
    log(message) {
      return { message }
    },
  },
}

export const logger = pino(
  process.env.NODE_ENV === 'development'
    ? {
        prettyPrint: true,
        prettifier: function pinoInspector(opts: any) {
          const pretty = require('pino-pretty')(opts)

          return function prettifier(obj: any) {
            const inspector = require('inspector')
            if (inspector.url()) {
              if (obj.level < 30) {
                inspector.console.debug(obj)
              } else if (obj.level >= 50) {
                inspector.console.error(obj)
              } else if (obj.level >= 40) {
                inspector.console.warn(obj)
              } else {
                inspector.console.log(obj)
              }
            }

            return pretty(obj)
          }
        },
      }
    : gcloudConf
)
