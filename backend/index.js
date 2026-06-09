const express = require('express');
const cors = require('cors');
const path = require('path');

const itemsRouter      = require('./routes/items');
const ticketsRouter    = require('./routes/tickets');
const ticketItemsRouter = require('./routes/ticketItems');
const settingsRouter   = require('./routes/settings');
const importRouter     = require('./routes/import');
const resetRouter      = require('./routes/reset');
const dashboardRouter  = require('./routes/dashboard');
const authRouter       = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/items',        itemsRouter);
app.use('/api/tickets',      ticketsRouter);
app.use('/api/ticket-items', ticketItemsRouter);
app.use('/api/settings',     settingsRouter);
app.use('/api/import',       importRouter);
app.use('/api/reset',        resetRouter);
app.use('/api/dashboard',    dashboardRouter);
app.use('/api/auth',         authRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
