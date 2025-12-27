import express from 'express';
import * as registerController from '../controllers/registerController.js';

const router = express.Router();

// ============== COLABORADORES ==============
router.post('/colaboradores', registerController.createColaborador);
router.put('/colaboradores/:id', registerController.updateColaborador);
router.delete('/colaboradores/:id', registerController.deleteColaborador);
router.get('/colaboradores', registerController.listColaboradores);

// ============== PRODUTOS ==============
router.post('/produtos', registerController.createProduto);
router.put('/produtos/:id', registerController.updateProduto);
router.delete('/produtos/:id', registerController.deleteProduto);
router.get('/produtos', registerController.listProdutos);

// ============== CLIENTES ==============
router.post('/clientes', registerController.createCliente);
router.put('/clientes/:id', registerController.updateCliente);
router.delete('/clientes/:id', registerController.deleteCliente);
router.get('/clientes', registerController.listClientes);

// ============== LISTAGEM COMPLETA ==============
router.get('/all', registerController.listAll);

export default router;