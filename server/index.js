import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import routes from './routes.js';
import { setupSockets } from './sockets.js';

const app = express();
const httpServer = createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 3001;

// Accepter l'origine exacte ET les variantes mobiles/vercel
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:4173',
  // Accepter tous les sous-domaines vercel de ce projet
  /https:\/\/watchparty.*\.vercel\.app$/,
];

const corsOptions = {
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (apps mobiles, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowed = allowedOrigins.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    
    if (allowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Origine bloquée: ${origin}`);
      callback(null, true); // En prod on laisse passer pour le debug, à restreindre après
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      callback(null, true); // Socket.IO — accepter toutes les origins pour l'instant
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
});

setupSockets(io);
app.use('/api', routes);
app.get('/health', (_, res) => res.json({ ok: true, origin: 'watchparty-server' }));

httpServer.listen(PORT, () => {
  console.log(`\n🎬 WatchParty Server → http://localhost:${PORT}\n`);
  console.log(`   CLIENT_URL: ${CLIENT_URL}`);
});
