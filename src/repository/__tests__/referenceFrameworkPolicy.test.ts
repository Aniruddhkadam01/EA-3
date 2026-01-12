import { describe, expect, test } from '@jest/globals';

import { isRelationshipTypeAllowedForReferenceFramework } from '../referenceFrameworkPolicy';

describe('referenceFrameworkPolicy', () => {
  test('ArchiMate allows only the standard internal ArchiMate-aligned relationship set', () => {
    expect(isRelationshipTypeAllowedForReferenceFramework('ArchiMate', 'DECOMPOSES_TO')).toBe(true);
    expect(isRelationshipTypeAllowedForReferenceFramework('ArchiMate', 'REALIZES')).toBe(true);
    expect(isRelationshipTypeAllowedForReferenceFramework('ArchiMate', 'DEPENDS_ON')).toBe(true);
    expect(isRelationshipTypeAllowedForReferenceFramework('ArchiMate', 'HOSTED_ON')).toBe(true);
    expect(isRelationshipTypeAllowedForReferenceFramework('ArchiMate', 'IMPACTS')).toBe(true);

    // Non-standard/internal governance relationships should be blocked.
    expect(isRelationshipTypeAllowedForReferenceFramework('ArchiMate', 'OWNS')).toBe(false);
    expect(isRelationshipTypeAllowedForReferenceFramework('ArchiMate', 'HAS')).toBe(false);
    expect(isRelationshipTypeAllowedForReferenceFramework('ArchiMate', 'DELIVERS')).toBe(false);
    expect(isRelationshipTypeAllowedForReferenceFramework('ArchiMate', 'SUPPORTED_BY')).toBe(false);
  });

  test('Non-ArchiMate frameworks do not add additional relationship restrictions', () => {
    expect(isRelationshipTypeAllowedForReferenceFramework('TOGAF', 'OWNS')).toBe(true);
    expect(isRelationshipTypeAllowedForReferenceFramework('Custom', 'DELIVERS')).toBe(true);
  });
});
