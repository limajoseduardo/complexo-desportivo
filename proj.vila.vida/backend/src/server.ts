import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'express-cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import logger from './config/logger';
import { database } from './config/database';
import { redisClient } from './config/redis';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import profilesRoutes from './routes/profiles.routes';
import activitiesRoutes from './routes/activities.routes';
import classesRoutes from './routes/classes.routes';
import enrollmentsRoutes from './routes/enrollments.routes';
import rfidRoutes from './routes/rfid.routes';
import reportsRoutes from './routes/reports.routes';
import analyticsRoutes from './routes/analytics.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware Setup
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://www.buildlab.pt',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.id = req.headers['x-request-id'] as string || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Muitos pedidos deste IP, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: '1.0.0',
    service: 'Complexo Desportivo API'
  });
});

// Status endpoint
app.get('/api/status', async (req: Request, res: Response) => {
  try {
    const dbConnected = await database.query('SELECT 1');
    const redisConnected = await redisClient.ping();

    res.status(200).json({
      status: 'operational',
      database: dbConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/analytics', analyticsRoutes);

// Documentation endpoint
app.get('/api/docs', (req: Request, res: Response) => {
  res.json({
    name: 'Complexo Desportivo API',
    version: '1.0.0',
    description: 'API para gerenciamento de complexo desportivo de Vila de Rei',
    baseUrl: process.env.API_URL,
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      profiles: '/api/profiles',
      activities: '/api/activities',
      classes: '/api/classes',
      enrollments: '/api/enrollments',
      rfid: '/api/rfid',
      reports: '/api/reports',
      analytics: '/api/analytics',
    },
    authentication: 'JWT Bearer Token',
    contactEmail: 'api@buildlab.pt',
    documentation: 'https://docs.buildlab.pt'
  });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services and start server
const startServer = async () => {
  try {
    // Test database connection
    logger.info('Testando conexão com base de dados...');
    await database.query('SELECT 1');
    logger.info('✓ Base de dados conectada');

    // Test Redis connection
    logger.info('Testando conexão com Redis...');
    const redisPing = await redisClient.ping();
    logger.info(`✓ Redis conectado: ${redisPing}`);

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Servidor iniciado em porta ${PORT} (${NODE_ENV})`);
      logger.info(`📍 API URL: ${process.env.API_URL}`);
      logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                 Complexo Desportivo Backend                    ║
║                       Vila de Rei                              ║
╠════════════════════════════════════════════════════════════════╣
║  Servidor iniciado com sucesso!                               ║
║  Porta: ${PORT}                                             ║
║  Ambiente: ${NODE_ENV}                                          ║
║  API: ${process.env.API_URL}                  ║
╚════════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido, encerrando gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recebido, encerrando gracefully...');
  process.exit(0);
});

// Start the application
startServer();

export default app;
