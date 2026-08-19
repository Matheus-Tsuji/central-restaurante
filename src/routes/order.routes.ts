import { Router } from 'express';
import { OrderController, createOrderSchema, syncBatchOrdersSchema } from '../controllers/OrderController.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(['WAITER', 'ADMIN']), validateBody(createOrderSchema), OrderController.createOrder);
router.post('/sync-batch', authorize(['WAITER', 'ADMIN']), validateBody(syncBatchOrdersSchema), OrderController.syncBatch);
router.get('/table/:tableId/bill', authorize(['WAITER', 'CASHIER', 'ADMIN']), OrderController.getTableBill);
router.get('/:id', OrderController.getOrderById);

export default router;
