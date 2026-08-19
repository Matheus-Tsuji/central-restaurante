import { Router } from 'express';
import { KitchenController, updateItemStatusSchema } from '../controllers/KitchenController.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate, authorize(['KITCHEN', 'ADMIN']));

router.get('/queue', KitchenController.getKitchenQueue);
router.patch('/item/:itemId/status', validateBody(updateItemStatusSchema), KitchenController.updateItemStatus);

export default router;
