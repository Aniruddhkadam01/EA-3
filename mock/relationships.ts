import type { Request, Response } from 'express';

import { getRelationshipRepository } from '../backend/repository/RelationshipRepositoryStore';

export default {
  'GET /api/relationships': (_req: Request, res: Response) => {
    const repo = getRelationshipRepository();
    res.send({ success: true, data: repo.getAllRelationships() });
  },

  'GET /api/relationships/by-element/:elementId': (req: Request, res: Response) => {
    const elementId = String((req.params as { elementId?: string } | undefined)?.elementId ?? '').trim();
    const repo = getRelationshipRepository();
    res.send({ success: true, data: repo.getRelationshipsForElement(elementId) });
  },

  'GET /api/relationships/by-type/:relationshipType': (req: Request, res: Response) => {
    const relationshipType = String(
      (req.params as { relationshipType?: string } | undefined)?.relationshipType ?? '',
    ).trim();
    const repo = getRelationshipRepository();
    res.send({ success: true, data: repo.getRelationshipsByType(relationshipType) });
  },
};
