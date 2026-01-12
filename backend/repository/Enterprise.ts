import type { BaseArchitectureElement } from './BaseArchitectureElement';

/**
 * Enterprise / legal entity / business unit.
 *
 * Notes:
 * - Hierarchy and ownership are represented via relationships (OWNS).
 */
export type Enterprise = BaseArchitectureElement & {
  elementType: 'Enterprise';
};
