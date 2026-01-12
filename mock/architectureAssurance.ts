import type { Request, Response } from 'express';

import { evaluateArchitectureAssurance } from '../backend/assurance/ArchitectureAssurance';
import { getRepository } from '../backend/repository/RepositoryStore';
import { getRelationshipRepository } from '../backend/repository/RelationshipRepositoryStore';
import { getViewRepository } from '../backend/views/ViewRepositoryStore';
import type { ViewDefinition } from '../backend/views/ViewDefinition';

export default {
  'GET /api/repository/assurance': (_req: Request, res: Response) => {
    const elements = getRepository();
    const relationships = getRelationshipRepository();

    let views: ViewDefinition[] = [];
    try {
      views = getViewRepository().listAllViews();
    } catch {
      // No active project => no views to evaluate.
      views = [];
    }

    const report = evaluateArchitectureAssurance({
      elements,
      relationships,
      views,
    });

    res.send({ success: true, data: report });
  },
};
