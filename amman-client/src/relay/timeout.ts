export function createTimeout(
  ms: number,
  rejectError: Error,
  reject: (reason: any) => void
) {
  return setTimeout(() => reject(rejectError), ms)
}
