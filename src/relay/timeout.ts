export function createTimeout(
  ms: number,
  msg: string,
  reject: (reason: any) => void
) {
  return setTimeout(() => reject(new Error(msg)), ms)
}
