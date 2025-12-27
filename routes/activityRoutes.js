import express from 'express';
import { getRecentActivity, getDashboardStats } from '../controllers/activityController.js'; 

const router = express.Router();

// Rota para o Feed de atividades
router.get('/', getRecentActivity);

// Rota para os Cards de Estatísticas (Visão Geral)
router.get('/stats', getDashboardStats); // <--- Nova rota

export default router;
