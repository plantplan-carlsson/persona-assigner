require('dotenv').config();
const express = require('express');
const { processContacts, fetchPersonaOptions } = require('./personaEngine');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// API: Get personas for frontend
app.get('/api/personas', async (req, res) => {
  try {
    const personas = await fetchPersonaOptions();
    res.json({ personas });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

// API: Get contacts (simplified example)
app.get('/api/contacts', async (req, res) => {
  // Implement your HubSpot contacts fetch logic here or via personaEngine
  res.status(501).send('Not implemented');
});

// API: Retry persona assignment for a contact
app.post('/api/retry/:id', async (req, res) => {
  // Implement retry logic here
  res.status(501).send('Not implemented');
});

// Start persona assignment polling loop
processContacts();
setInterval(processContacts, 5 * 60 * 1000);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
