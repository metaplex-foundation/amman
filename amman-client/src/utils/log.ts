import debug from 'debug'

export const logErrorDebug = debug('amman:error')
export const logInfoDebug = debug('amman:info')
export const logDebug = debug('amman:debug')
export const logTrace = debug('amman:trace')

export const logError = logErrorDebug.enabled
  ? logErrorDebug
  : console.error.bind(console)

export const logInfo = logInfoDebug.enabled
  ? logInfoDebug
  : console.log.bind(console)

export function scopedLog(scope: string) {
  const logError = debug(`amman:${scope}:error`)
  const logInfo = debug(`amman:${scope}:info`)
  return {
    logError: logError.enabled ? logError : console.error.bind(console),
    logInfo: logInfo.enabled ? logInfo : console.log.bind(console),
    logDebug: debug(`amman:${scope}:debug`),
    logTrace: debug(`amman:${scope}:trace`),
  }
}
