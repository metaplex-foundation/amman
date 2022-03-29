import { tmpdir } from 'os'
import path from 'path'

export const AMMAN_STORAGE_PORT = 50475
export const AMMAN_STORAGE_URI = `http://localhost:${AMMAN_STORAGE_PORT}`
export const AMMAN_STORAGE_ROOT = path.join(tmpdir(), 'amman-storage')
