const express = require('express');
const cors = require('cors');
const path = require('path');

const itemsRouter      = require('./routes/items');
const ticketsRouter    = require('./routes/tickets');
const ticketItemsRouter = require('./routes/ticketItems');
const settingsRouter   = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/items',        itemsRouter);
app.use('/api/tickets',      ticketsRouter);
app.use('/api/ticket-items', ticketItemsRouter);
app.use('/api/settings',     settingsRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
