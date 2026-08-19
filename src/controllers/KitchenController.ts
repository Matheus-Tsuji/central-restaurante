import { Request, Response, NextFunction } from 'express';
import { KitchenService } from '../services/KitchenService.js';
import { z } from 'zod';

export const updateItemStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'])
});

export class KitchenController {
  static async getKitchenQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const queue = KitchenService.listKitchenQueue();
      res.json(queue);
    } catch (err) {
      next(err);
    }
  }

  static async updateItemStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const itemId = req.params.itemId as string;
      const { status } = req.body;

      const updatedOrder = KitchenService.updateItemStatus(itemId, status);
      res.json(updatedOrder);
    } catch (err) {
      next(err);
    }
  }
}
