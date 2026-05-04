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

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
});

setupSockets(io);
app.use('/api', routes);
app.get('/health', (_, res) => res.json({ ok: true }));

httpServer.listen(PORT, () => {
  console.log(`\n🎬 WatchParty Server → http://localhost:${PORT}\n`);
});
