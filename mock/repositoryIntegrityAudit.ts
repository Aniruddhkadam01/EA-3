import type { Request, Response } from 'express';

import { auditRepositoryIntegrity } from '../backend/analysis/RepositoryIntegrityAudit';
import { getRepository } from '../backend/repository/RepositoryStore';
import { getRelationshipRepository } from '../backend/repository/RelationshipRepositoryStore';

export default {
  'GET /api/repository/integrity-audit': (_req: Request, res: Response) => {
    const elements = getRepository();
    const relationships = getRelationshipRepository();
    const report = auditRepositoryIntegrity(elements, relationships);
    res.send({ success: true, data: report });
  },
};
