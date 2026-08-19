import { Router } from 'express';
import {
  CashierController,
  openSessionSchema,
  closeSessionSchema,
  processPaymentSchema
} from '../controllers/CashierController.js';
import { validateBody } from '../middlewares/validationMiddleware.js';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/session', CashierController.getActiveSession);
router.post('/session/open', authorize(['CASHIER', 'ADMIN']), validateBody(openSessionSchema), CashierController.openSession);
router.post('/session/close', authorize(['CASHIER', 'ADMIN']), validateBody(closeSessionSchema), CashierController.closeSession);
router.post('/payment', validateBody(processPaymentSchema), CashierController.processPayment);
router.get('/report', CashierController.getDailyReport);

export default router;
