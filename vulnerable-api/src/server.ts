import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`[Vulnerable API] 🚀 Listening on http://localhost:${PORT}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Vulnerable API] ❌ Port ${PORT} is already in use. Kill the other process or use a different port.`);
  } else {
    console.error('[Vulnerable API] ❌ Server error:', err.message);
  }
  process.exit(1);
});
