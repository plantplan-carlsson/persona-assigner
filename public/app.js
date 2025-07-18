async function renderPersonas() {
  try {
    const res = await fetch('/api/personas');
    const data = await res.json();
    const ul = document.getElementById('personaList');
    ul.innerHTML = '';

    data.personas.forEach(p => {
      const li = document.createElement('li');
      li.textContent = p;
      ul.appendChild(li);
    });
  } catch (error) {
    console.error('Failed to load personas:', error);
  }
}

async function fetchContacts() {
  try {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    const tbody = document.getElementById('contactsBody');
    tbody.innerHTML = '';

    data.contacts.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.firstname || ''} ${c.lastname || ''}</td>
        <td>${c.jobtitle || ''}</td>
        <td>${c.company || ''}</td>
        <td>${c.persona || '❌'}</td>
        <td>${c.confidence ? c.confidence + '%' : '-'}</td>
        <td><button class="retry-btn" onclick="retryContact('${c.id}')">Retry</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Failed to load contacts:', e);
  }
}

async function retryContact(contactId) {
  try {
    await fetch(`/api/retry/${contactId}`, { method: 'POST' });
    await fetchContacts();
  } catch (e) {
    alert('Failed to retry contact: ' + e.message);
  }
}

async function submitTraining() {
  const good = document.getElementById('goodExamples').value.trim();
  const bad = document.getElementById('badExamples').value.trim();
  const status = document.getElementById('trainingStatus');

  try {
    const res = await fetch('/api/training', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ good, bad }),
    });
    if (!res.ok) throw new Error('Failed to submit training data');

    status.textContent = 'Training data submitted successfully!';
  } catch (e) {
    status.textContent = 'Error submitting training data: ' + e.message;
  }
}

document.getElementById('submitTraining').addEventListener('click', submitTraining);

renderPersonas();
fetchContacts();
setInterval(fetchContacts, 10000);
