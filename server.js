const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();

app.use(cors({
  origin: '*', // Allows requests from any origin
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Serve static files with PWA-friendly headers
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    // Cache manifest, service worker, and HTML with short cache
    if (filePath.endsWith('manifest.json') || filePath.endsWith('serviceworker.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'max-age=3600, must-revalidate'); // 1 hour
    }
    // Cache static assets longer
    else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
      res.setHeader('Cache-Control', 'max-age=31536000, immutable'); // 1 year
    }
    // Service worker needs proper MIME type
    if (filePath.endsWith('serviceworker.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    // Manifest needs proper MIME type
    if (filePath.endsWith('manifest.json')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
  }
}));

// Configure your local PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'huatkueh',
  password: 'obm12345',
  port: 5432,
});

// GET all orders with optional filters
app.get('/api/orders', async (req, res) => {
  try {
    const { startDate, endDate, name } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (startDate) { params.push(startDate); query += ` AND deliver_date >= $${params.length}`; }
    if (endDate) { params.push(endDate); query += ` AND deliver_date <= $${params.length}`; }
    if (name) { params.push(`%${name}%`); query += ` AND name ILIKE $${params.length}`; }
    
    query += ' ORDER BY deliver_date ASC, name ASC';
    
    const result = await pool.query(query, params);
    const formattedRows = result.rows.map(row => {
      if (row.deliver_date instanceof Date) {
        // Convert the Date object to YYYY-MM-DD string
        row.deliver_date = row.deliver_date.toISOString().split('T')[0];
      }
      return row;
    });

    res.json(formattedRows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH (Update) an order
app.patch('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
  const values = Object.values(updates);
  
  try {
    await pool.query(`UPDATE orders SET ${fields} WHERE id = $${values.length + 1}`, [...values, id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE an order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADD an order
app.post('/api/orders', async (req, res) => {
  try {
    const { deliver_date, deliver_time, name, small, four_inch, six_inch, eight_inch, talam_kueh, white_sugar_kueh, white_sugar_kueh_red, water_kueh, remarks } = req.body;
    
    const query = `
      INSERT INTO orders (deliver_date, deliver_time, name, small, four_inch, six_inch, eight_inch, talam_kueh, white_sugar_kueh, white_sugar_kueh_red, water_kueh, remarks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;
    const values = [deliver_date, deliver_time, name, small, four_inch, six_inch, eight_inch, talam_kueh, white_sugar_kueh, white_sugar_kueh_red, water_kueh, remarks];
    
    await pool.query(query, values);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to index.html for client-side routing (SPA)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(3000, () => console.log('Backend API running on http://localhost:3000'));
console.log('PWA ready - Service Worker at ./serviceworker.js');

