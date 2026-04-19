const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { sequelize } = require('./models');
const config = require('./config');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const mediaRoutes = require('./routes/media');
const analyticsRoutes = require('./routes/analytics');
const activityRoutes = require('./routes/activity');
const settingsRoutes = require('./routes/settings');
const webhookRoutes = require('./routes/webhooks');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload folder exists
fs.mkdirSync(path.resolve(config.app.uploadFolder), { recursive: true });

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api', orderRoutes);
app.use('/api', mediaRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', activityRoutes);
app.use('/api', settingsRoutes);
app.use('/api', webhookRoutes);

// Serve uploads static files
app.use('/uploads', express.static(path.resolve(config.app.uploadFolder)));

// Serve frontend SPA
app.use(express.static(config.app.frontendDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(config.app.frontendDistPath, 'index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

const start = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: false });
    app.listen(config.app.port, '0.0.0.0', () => {
      console.log(`backendNew running on http://localhost:${config.app.port}`);
    });
  } catch (err) {
    console.error('Failed to start backendNew:', err);
    process.exit(1);
  }
};

start();
