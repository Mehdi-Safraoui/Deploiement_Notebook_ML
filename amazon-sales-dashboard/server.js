const express = require('express');
const path    = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app     = express();
const PORT    = process.env.PORT    || 3000;
const API_URL = process.env.API_URL || 'http://localhost:5000';

// Proxy /api/* → Python Flask
// Use pathFilter (not app.use('/api', ...)) so Express does NOT strip the /api prefix
app.use(createProxyMiddleware({
  pathFilter:   '/api',
  target:       API_URL,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      console.error('[proxy error]', err.message);
      res.status(502).json({
        error: 'Python API unavailable',
        detail: 'Make sure the Flask server is running on port 5000.'
      });
    }
  }
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✓ Amazon Sales Dashboard → http://localhost:${PORT}`);
  console.log(`✓ Proxying /api → ${API_URL}\n`);
});
