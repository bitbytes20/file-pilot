import type { DomainPlaceholder } from '@filepilot/domain';

export interface ApplicationPlaceholder {
  readonly kind: 'application-placeholder';
  readonly domain: DomainPlaceholder;
}

export const createApplicationPlaceholder = (domain: DomainPlaceholder): ApplicationPlaceholder => ({
  kind: 'application-placeholder',
  domain,
});
