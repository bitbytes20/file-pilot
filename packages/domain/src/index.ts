// Domain layer placeholder exports will live here.
export interface DomainPlaceholder {
  readonly kind: 'domain-placeholder';
}

export const createDomainPlaceholder = (): DomainPlaceholder => ({
  kind: 'domain-placeholder',
});
