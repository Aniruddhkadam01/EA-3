import type { Request, Response } from 'express';

import { getRepository } from '../backend/repository/RepositoryStore';

export default {
  'GET /api/repository/capabilities': (_req: Request, res: Response) => {
    const repo = getRepository();
    res.send({ success: true, data: repo.getElementsByType('capabilities') });
  },

  'GET /api/repository/processes': (_req: Request, res: Response) => {
    const repo = getRepository();
    res.send({ success: true, data: repo.getElementsByType('businessProcesses') });
  },

  'GET /api/repository/applications': (_req: Request, res: Response) => {
    const repo = getRepository();
    res.send({ success: true, data: repo.getElementsByType('applications') });
  },

  'GET /api/repository/technologies': (_req: Request, res: Response) => {
    const repo = getRepository();
    res.send({ success: true, data: repo.getElementsByType('technologies') });
  },

  'GET /api/repository/programmes': (_req: Request, res: Response) => {
    const repo = getRepository();
    res.send({ success: true, data: repo.getElementsByType('programmes') });
  },
};
