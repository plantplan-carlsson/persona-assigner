require('dotenv').config();
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const hubspot = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

let logs = [];

function addLog(message) {
  logs.push(`[${new Date().toISOString()}] ${message}`);
  if (logs.length > 100) logs.shift();
  console.log(message);
}

async function fetchContacts(limit = 10) {
  try {
    const res = await hubspot.get('/crm/v3/objects/contacts', {
      params: {
        limit,
        properties: ['jobtitle', 'company', 'persona'],
      },
    });
    return res.data.results;
  } catch (error) {
    addLog(`Error fetching contacts: ${error.response?.data?.message || error.message}`);
    return [];
  }
}

async function classifyPersona(jobTitle, company) {
  const prompt = `Given the job title "${jobTitle}" at the company "${company}", which persona fits best? Choose from Architect Alex, Designer Dani, Developer Drew, Executive Ezra, Contractor Chris, Unknown. Return only the persona name.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant classifying CRM contacts into buyer personas.',
        },
        { role: 'user', content: prompt },
      ],
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    addLog(`Error classifying persona: ${error.response?.data?.message || error.message}`);
    return 'Unknown';
  }
}

async function updateContactPersona(contactId, persona) {
  try {
    await hubspot.patch(`/crm/v3/objects/contacts/${contactId}`, {
      properties: { persona },
    });
    addLog(`Updated contact ${contactId} to persona: ${persona}`);
  } catch (error) {
    addLog(`Error updating contact ${contactId}: ${error.response?.data?.message || error.message}`);
  }
}

async function processContacts() {
  addLog('Starting persona assignment...');
  const contacts = await fetchContacts(10);

  for (const contact of contacts) {
    const { id, properties } = contact;
    const { jobtitle, company, persona } = properties;

    if (!jobtitle || !company) {
      addLog(`Skipping contact ${id} due to missing job title or company.`);
      continue;
    }

    if (persona && persona !== '') {
      addLog(`Contact ${id} already has persona (${persona}). Skipping.`);
      continue;
    }

    const predictedPersona = await classifyPersona(jobtitle, company);
    await updateContactPersona(id, predictedPersona);
  }
  addLog('Persona assignment completed.');
}

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/logs', (req, res) => {
  res.json(logs);
});

app.post('/run', async (req, res) => {
  processContacts();
  res.json({ status: 'started' });
});

// Start server and process contacts every 5 minutes
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  processContacts();
  setInterval(processContacts, 5 * 60 * 1000);
});
