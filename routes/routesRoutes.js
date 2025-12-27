// routes/routesRoutes.js
import express from 'express'
import * as routesController from '../controllers/routesController.js'

const router = express.Router()

// Criar rota
router.post('/', routesController.createRota)

// Editar rota
router.put('/:id', routesController.updateRota)

// Apagar rota
router.delete('/:id', routesController.deleteRota)

// Listar todas rotas
router.get('/', routesController.getAllRotas)

// ➤ ROTAS ESPECÍFICAS (Devem vir ANTES de /:id)
router.get('/recent', routesController.getRecentDeliveries)
router.get('/analytics', routesController.getAnalyticsReport) // <--- NOVA ROTA AQUI

// Listar rota específica (pelo ID UUID) - ESTA SEMPRE POR ÚLTIMO NOS GETs
router.get('/:id', routesController.getRotaById)

export default router