require('dotenv').config();
const axios = require('axios');
const OpenAI = require('openai');

// Initialise OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialise HubSpot API
const hubspot = axios.create({
  baseURL: 'https://api.hubapi.com',
  headers: {
    Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Fetch contacts from HubSpot
async function fetchContacts(limit = 10) {
  try {
    const response = await hubspot.get('/crm/v3/objects/contacts', {
      params: {
        limit,
        properties: ['firstname', 'lastname', 'jobtitle', 'company', 'persona'],
      },
    });
    return response.data.results;
  } catch (error) {
    console.error('❌ Error fetching contacts:', error.response?.data || error.message);
    return [];
  }
}

// Use OpenAI to classify a persona
async function classifyPersona(jobTitle, company) {
  const prompt = `Given the job title "${jobTitle}" at the company "${company}", which of the following personas best applies?
- Architect Alex
- Designer Dani
- Developer Drew
- Executive Ezra
- Contractor Chris
- Unknown

Only return the persona name.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that classifies CRM contacts into buyer personas.' },
        { role: 'user', content: prompt },
      ],
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Error classifying persona:', error.response?.data || error.message);
    return 'Unknown';
  }
}

// Update the contact's persona field in HubSpot
async function updateContactPersona(contactId, persona) {
  try {
    await hubspot.patch(`/crm/v3/objects/contacts/${contactId}`, {
      properties: {
        persona,
      },
    });
    console.log(`✅ Updated contact ${contactId} with persona: ${persona}`);
  } catch (error) {
    console.error(`❌ Error updating contact ${contactId}:`, error.response?.data || error.message);
  }
}

// Main runner function
async function processContacts() {
  const contacts = await fetchContacts();

  if (!contacts.length) {
    console.log('⚠️ No contacts found to process.');
    return;
  }

  for (const contact of contacts) {
    const { id, properties } = contact;
    const { jobtitle, company, persona } = properties;

    if (!jobtitle || !company) {
      console.log(`⏭️ Skipping contact ${id} due to missing job title or company.`);
      continue;
    }

    if (persona && persona !== '') {
      console.log(`ℹ️ Contact ${id} already has a persona (${persona}). Skipping.`);
      continue;
    }

    const predictedPersona = await classifyPersona(jobtitle, company);
    await updateContactPersona(id, predictedPersona);
  }
}

// Run the script
processContacts().catch(console.error);
