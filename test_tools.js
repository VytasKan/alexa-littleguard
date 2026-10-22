const tests = [
  { name: 'Triage', prompt: 'Baby is 4 months old, fever is 101.4, tugging at left ear, took 1.25ml infant Tylenol 2 hours ago.' },
  { name: 'Contraindication', prompt: 'How much Motrin can my 14 lb baby take?' },
  { name: 'Dose Calculation', prompt: 'How much Tylenol for a 14 pound baby?' },
  { name: 'Interval Check', prompt: 'Can I give her more medicine now?' },
  { name: 'Comfort Care', prompt: 'What can I do to keep her comfortable?' },
  { name: 'Doctor Summary', prompt: 'Export summary for Panda Pediatrics' }
];

async function run() {
  for (const t of tests) {
    const res = await fetch('http://127.0.0.1:3000/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: t.prompt })
    });
    const data = await res.json();
    console.log(`[PASS] ${t.name}: Dispatched Tool -> ${data.toolCall.name} (Display: ${data.multimodalDisplay?.type})`);
  }
}

run();
