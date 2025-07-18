const hubspot = require('@hubspot/api-client');
const OpenAI = require('openai');

const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_API_KEY });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let cachedPersonas = [];

async function fetchPersonaOptions() {
  if (cachedPersonas.length) return cachedPersonas;
  try {
    const response = await hubspotClient.crm.properties.coreApi.getByName('contacts', 'persona');
    cachedPersonas = response.body.options.map(opt => opt.label);
    console.log('Fetched personas:', cachedPersonas);
    return cachedPersonas;
  } catch (error) {
    console.error('Error fetching personas:', error.message);
    return [];
  }
}

async function getPersonaFromAI(jobTitle, companyName) {
  const personas = await fetchPersonaOptions();
  const personaList = personas.join(', ');

  const prompt = `
Given the job title "${jobTitle}" at the company "${companyName}", select the best matching persona from the following options ONLY:

${personaList}

Return only the exact persona name from the list.
  `.trim();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant classifying contacts into the given personas.' },
        { role: 'user', content: prompt },
      ],
    });

    let persona = response.choices[0].message.content.trim();

    if (!personas.includes(persona)) {
      persona = 'Unknown';
    }

    return { persona, confidence: 90 }; // confidence placeholder
  } catch (error) {
    console.error('OpenAI error:', error.message);
    return { persona: 'Unknown', confidence: 0 };
  }
}

async function processContacts(limit = 100) {
  console.log('Starting persona assignment...');
  const filterGroup = {
    filters: [
      { propertyName: 'persona', operator: 'NOT_HAS_PROPERTY' },
      { propertyName: 'jobtitle', operator: 'HAS_PROPERTY' },
      { propertyName: 'ai_persona_processed', operator: 'NOT_HAS_PROPERTY' }
    ],
  };

  const searchRequest = {
    filterGroups: [filterGroup],
    sorts: [],
    properties: ['firstname', 'lastname', 'jobtitle', 'company', 'persona', 'ai_persona_processed'],
    limit,
  };

  try {
    const response = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);
    const contacts = response.results;

    if (!contacts.length) {
      console.log('No unprocessed contacts found.');
      return;
    }

    for (const contact of contacts) {
      const { id, properties } = contact;
      const { jobtitle, company } = properties;

      if (!jobtitle || !company) {
        console.log(`Skipping contact ${id} (missing job title or company)`);
        continue;
      }

      const { persona, confidence } = await getPersonaFromAI(jobtitle, company);

      await hubspotClient.crm.contacts.basicApi.update(id, {
        properties: {
          persona,
          ai_persona_confidence: confidence.toString(),
          ai_persona_processed: 'true',
          ai_persona_last_checked: new Date().toISOString(),
        },
      });

      console.log(`Assigned persona "${persona}" to contact ${id} (Confidence: ${confidence}%)`);
    }

    console.log(`Processed ${contacts.length} contacts.`);
  } catch (error) {
    console.error('Error processing contacts:', error.message);
  }
}

module.exports = { processContacts, fetchPersonaOptions };
