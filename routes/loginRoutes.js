import express from 'express';
import * as loginController from '../controllers/loginController.js';

const router = express.Router();

// Rota para login do admin (usando credenciais do .env)
router.post('/login-admin', loginController.adminLogin);

// Rota para login do colaborador (seleciona colaborador e usa código de acesso)
router.post('/login', loginController.colaboradorLogin);

// Rota para listar todos os colaboradores
router.get('/list-users', loginController.listColaboradores);

export default router;