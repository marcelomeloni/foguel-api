import express from 'express'
import cors from 'cors'
import 'dotenv/config'

// Importar rotas
import deliveryRoutes from './routes/deliveryRoutes.js'
import loginRoutes from './routes/loginRoutes.js'
import registerRoutes from './routes/registerRoutes.js'
import routesRoutes from './routes/routesRoutes.js'

const app = express()
const port = process.env.PORT || 3000

// Middlewares
app.use(cors())
app.use(express.json())

// Rotas
app.use('/delivery', deliveryRoutes)
app.use('/login', loginRoutes)
app.use('/register', registerRoutes)
app.use('/routes', routesRoutes)

// Rota raiz (teste)
app.get('/', (req, res) => {
  res.send('API Foguel está online 🚚💨')
})

// Inicia servidor
app.listen(port, () => {
  console.clear() // Limpa o terminal para ficar mais limpo
  console.log('------------------------------------------------')
  console.log(`🚀 Servidor rodando com sucesso!`)
  console.log(`🔗 Link da API: http://localhost:${port}`)
  console.log('------------------------------------------------')
})