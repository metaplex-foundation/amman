function cannotUseInTheBrowser() {
  throw new Error('Cannot use File System methods in the browser')
}

/** @private */
export const canAccessSync = cannotUseInTheBrowser
/** @private */
export const canAccess = cannotUseInTheBrowser
/** @private */
export const canRead = cannotUseInTheBrowser
/** @private */
export const ensureDirSync = cannotUseInTheBrowser
/** @private */
export const ensureDir = cannotUseInTheBrowser
/** @private */
export const keypairFromFile = cannotUseInTheBrowser
/** @private */
export const ensureDirCleaned = cannotUseInTheBrowser
