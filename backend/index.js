const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const worksRoutes = require('./routes/works');
const weeksRoutes = require('./routes/weeks');
const tasksRoutes = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');
const configRoutes = require('./routes/config');
const permissionsRoutes = require('./routes/permissions');
const feasibilityRoutes = require('./routes/feasibility');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ppc-pro-backend' });
});

app.use('/auth', authRoutes);
app.use(worksRoutes);
app.use(weeksRoutes);
app.use(tasksRoutes);
app.use(dashboardRoutes);
app.use(configRoutes);
app.use(permissionsRoutes);
app.use(feasibilityRoutes);

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use((err, _req, res, _next) => {
  const status = err.httpStatus || 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: err.message || 'internal_error' });
});

app.listen(port, () => {
  console.log(`PPC-Pro backend listening on http://localhost:${port}`);
});
