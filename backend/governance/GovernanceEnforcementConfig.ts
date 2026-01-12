import { projectStore } from '../project/ProjectStore';
import type { GovernanceEnforcementMode } from '../project/project';

/**
 * Governance enforcement mode configuration (config-only).
 *
 * Principles:
 * - Read-only accessors.
 * - Deterministic defaults.
 * - No blocking behavior is implemented here.
 */
export function getGovernanceEnforcementMode(): GovernanceEnforcementMode {
  const project = projectStore.getProject();
  const mode = project?.config?.governanceEnforcementMode;

  // Deterministic fallback.
  if (mode === 'Advisory' || mode === 'Guided' || mode === 'Enforced') return mode;
  return 'Advisory';
}

export function isGovernanceAdvisory(): boolean {
  return getGovernanceEnforcementMode() === 'Advisory';
}
