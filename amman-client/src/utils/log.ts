import debug from 'debug'

export const logErrorDebug = debug('amman-client:error')
export const logInfoDebug = debug('amman-client:info')
export const logDebug = debug('amman-client:debug')
export const logTrace = debug('amman-client:trace')

export const logError = logErrorDebug.enabled
  ? logErrorDebug
  : console.error.bind(console)

export const logInfo = logInfoDebug.enabled
  ? logInfoDebug
  : console.log.bind(console)

export function scopedLog(level: string, scope: string) {
  return debug(`amman-client:${scope}:${level}`)
}
