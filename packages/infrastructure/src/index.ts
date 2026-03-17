import type { DomainPlaceholder } from '@filepilot/domain';

export interface InfrastructureAdapterRegistry {
  readonly scanner: DomainPlaceholder;
}

export const createInfrastructureAdapterRegistry = (
  domain: DomainPlaceholder,
): InfrastructureAdapterRegistry => ({
  scanner: domain,
});
