const hubspot = require('@hubspot/api-client');
const OpenAI = require('openai');

const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_API_KEY });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function processContacts(limit = 100) {
  console.log('🔄 Starting persona assignment...');

  const filterGroup = {
    filters: [
      {
        propertyName: 'persona',
        operator: 'NOT_HAS_PROPERTY',
      },
      {
        propertyName: 'jobtitle',
        operator: 'HAS_PROPERTY',
      },
      {
        propertyName: 'ai_persona_processed',
        operator: 'NOT_HAS_PROPERTY',
      },
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
      console.log('✅ No unprocessed contacts found.');
      return;
    }

    for (const contact of contacts) {
      const { id, properties } = contact;
      const { jobtitle, company } = properties;

      if (!jobtitle || !company) {
        console.log(`⏭️ Skipping contact ${id} (missing job title or company)`);
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

      console.log(`✅ Contact ${id}: assigned ${persona} (${confidence}%)`);
    }

    console.log(`🎉 Done. ${contacts.length} contact(s) processed.`);
  } catch (error) {
    console.error('❌ Error processing contacts:', error.message);
  }
}

async function getPersonaFromAI(jobTitle, companyName) {
  const prompt = `Assign a persona based on this job title and company:\nJob Title: ${jobTitle}\nCompany: ${companyName}\nPersona:`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 20,
    temperature: 0.2,
  });

  const persona = completion.choices[0].message.content.trim();
  const confidence = Math.floor(Math.random() * 21 + 80); // Placeholder confidence 80-100%

  return { persona, confidence };
}

module.exports = { processContacts };
