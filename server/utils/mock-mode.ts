export function isMockMode(): boolean {
  const config = useRuntimeConfig()
  const value = String(config.mockMode ?? '').toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}
