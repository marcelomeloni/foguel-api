import express from 'express';
import * as deliveryController from '../controllers/deliveryController.js';

const router = express.Router();

// Rotas de listagem
router.get('/today/:colaborador_id', deliveryController.getTodayDeliveries);
router.get('/details/:id', deliveryController.getDeliveryDetails);
router.get('/stats/:colaborador_id', deliveryController.getTodayStats);

// Ações de entrega
router.post('/arrival/:id', deliveryController.registerArrival);
router.post('/cancel-arrival/:id', deliveryController.cancelArrival);
router.post('/finish-success/:id', deliveryController.finishDeliverySuccess);
router.post('/finish-failure/:id', deliveryController.finishDeliveryFailure);
router.put('/update-waiting/:id', deliveryController.updateWaitingTime);

export default router;