import type { CatalogKind } from './catalog-validation'

export function catalogHref(kind: CatalogKind, params?: Record<string, string>) {
  return `/admin/models-providers?${new URLSearchParams({ tab: kind, ...params })}`
}
