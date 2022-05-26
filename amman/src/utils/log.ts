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

export function scopedLog(level: string, scope: string) {
  return debug(`amman:${scope}:${level}`)
}
