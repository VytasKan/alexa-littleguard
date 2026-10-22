// Echo Show 15 & MCP Inspector Client Logic for PediatricCare MCP

let executionHistory = [];

async function fetchServerState() {
  try {
    const res = await fetch('/api/tools');
    const data = await res.json();
    renderPatientState(data.episodeState);
    renderToolsList(data.tools);
  } catch (err) {
    console.error('Failed to sync server state:', err);
  }
}

// 1. Render Pediatric Patient State & Countdown
function renderPatientState(state) {
  if (!state) return;

  const timelineContainer = document.getElementById('timeline-items');
  if (timelineContainer && state.medicationLog && state.vitalsLog) {
    const allItems = [
      ...state.medicationLog.map(m => ({
        time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        desc: `${m.doseMl} mL ${m.medication.toUpperCase()}`
      })),
      ...state.vitalsLog.map(v => ({
        time: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        desc: `Temp: ${v.value}° ${v.unit}`
      }))
    ];

    timelineContainer.innerHTML = allItems.slice(0, 4).map(item => `
      <div class="tl-item"><span class="tl-time">${item.time}</span> ${escapeHtml(item.desc)}</div>
    `).join('');
  }
}

// 2. Render Server Tools in Tab
function renderToolsList(tools) {
  const container = document.getElementById('registered-tools-list');
  if (!container || !tools) return;

  container.innerHTML = tools.map(t => `
    <div class="registered-tool-card">
      <div class="registered-tool-name">⚡ ${t.name}</div>
      <div class="registered-tool-desc">${t.description}</div>
    </div>
  `).join('');
}

// Clock updates
function updateTime() {
  const timeEl = document.getElementById('time-display');
  const dateEl = document.getElementById('date-display');
  const now = new Date();

  if (timeEl) {
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    timeEl.innerHTML = `${formattedHours}:${minutes} <span class="ampm">${ampm}</span>`;
  }

  if (dateEl) {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('en-US', options);
  }
}
setInterval(updateTime, 1000);
updateTime();

// Tab switching logic for Inspector
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add('active');
  });
});

// Clear history
const clearHistoryBtn = document.getElementById('clear-history-btn');
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', () => {
    executionHistory = [];
    renderHistory();
  });
}

function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (executionHistory.length === 0) {
    container.innerHTML = '<div class="history-empty">No calls recorded in this session.</div>';
    return;
  }

  container.innerHTML = executionHistory.map((item, idx) => `
    <div class="history-row" data-index="${idx}">
      <span class="history-tool">${item.toolName || 'Direct'}</span>
      <span class="history-time">${item.time}</span>
    </div>
  `).join('');

  // Re-inspect on click
  container.querySelectorAll('.history-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = row.getAttribute('data-index');
      if (executionHistory[idx]) {
        populateInspector(executionHistory[idx]);
      }
    });
  });
}

// Utterance Dispatching
const echoForm = document.getElementById('echo-form');
const userInput = document.getElementById('user-input');
const listeningBar = document.getElementById('listening-bar');
const ringBtn = document.getElementById('voice-ring-btn');
const speechText = document.getElementById('alexa-speech-text');
const lastUtteranceText = document.getElementById('last-utterance-text');
const statusLabel = document.getElementById('dialogue-status-label');

echoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const utterance = userInput.value.trim();
  if (!utterance) return;
  userInput.value = '';
  await executeUtterance(utterance);
});

document.querySelectorAll('.echo-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const prompt = chip.getAttribute('data-prompt');
    if (prompt) executeUtterance(prompt);
  });
});

async function executeUtterance(prompt) {
  setListening(true, `Clinical Evaluation: "${prompt}"...`);
  if (lastUtteranceText) lastUtteranceText.textContent = `"${prompt}"`;

  try {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();

    // Update Echo screen spoken response
    if (speechText) speechText.textContent = data.alexaResponse || 'Done.';

    // Multimodal Visual Card Rendering on Echo Screen
    if (data.multimodalDisplay) {
      renderMultimodalClinicalCard(data.multimodalDisplay);
    }

    // Populate Inspector
    populateInspector(data);

    // Save to history
    executionHistory.unshift({
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      toolName: data.toolCall ? data.toolCall.name : 'say_direct',
      ...data
    });
    renderHistory();

    await fetchServerState();
  } catch (err) {
    if (speechText) speechText.textContent = `Error: ${err.message}`;
  } finally {
    setListening(false, 'Alexa Ready');
  }
}

// ============================================================================
// MULTIMODAL CLINICAL CARD RENDERER (AUTHENTIC APL FULL-SCREEN DISPLAY)
// ============================================================================
const mmStage = document.getElementById('multimodal-stage');
const mmContent = document.getElementById('multimodal-card-content');
const mmBadge = document.getElementById('mm-badge');
const mmDismissBtn = document.getElementById('mm-dismiss-btn');
const echoAmbientHome = document.getElementById('echo-ambient-home');

if (mmDismissBtn) {
  mmDismissBtn.addEventListener('click', () => {
    if (mmStage) mmStage.style.display = 'none';
    if (echoAmbientHome) echoAmbientHome.style.display = 'flex';
  });
}

function renderMultimodalClinicalCard(display) {
  if (!mmStage || !mmContent) return;

  let badge = 'Pediatric Care Card';
  let innerHtml = '';

  if (display.type === 'pediatric_triage') {
    badge = 'AAP Triage Alert';
    innerHtml = `
      <div style="flex:1; display:flex; flex-direction:column; gap:10px;">
        <div style="background:${display.urgencyColor}22; border:1.5px solid ${display.urgencyColor}; border-radius:12px; padding:12px 16px;">
          <h3 style="color:${display.urgencyColor}; font-size:1.15rem; margin-bottom:4px;">${escapeHtml(display.urgencyTitle)}</h3>
          <div style="font-size:0.8rem; color:#e2e8f0;">Patient: <strong>${display.childAge}</strong> • Temp: <strong>${display.temperature}</strong></div>
        </div>

        <div style="background:#090e18; border-radius:10px; padding:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:0.75rem; font-weight:700; color:#38bdf8; text-transform:uppercase; margin-bottom:6px;">Clinical Evaluation</div>
          ${display.clinicalNotes.map(n => `<div style="font-size:0.82rem; color:#cbd5e1; margin-bottom:4px;">• ${escapeHtml(n)}</div>`).join('')}
          ${display.medEvaluation ? `<div style="font-size:0.82rem; color:#fbbf24; margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.1);">⏱️ ${escapeHtml(display.medEvaluation)}</div>` : ''}
        </div>

        <div style="display:flex; gap:8px;">
          <button class="mm-btn primary" style="background:#ef4444; color:#fff;" onclick="alert('Calling Panda Pediatrics: (785) 841-7297')">📞 Call Pediatrician Office</button>
          <button class="mm-btn secondary" onclick="executeUtterance('What can I do to keep her comfortable?')">💧 Non-Medicine Comfort Care</button>
        </div>
      </div>
    `;
  } else if (display.type === 'dosing_result') {
    badge = 'Heartland Health Dosing Chart';
    innerHtml = `
      <div style="flex:1; display:flex; flex-direction:column; gap:10px;">
        <div style="background:rgba(0,210,255,0.12); border:1.5px solid var(--alexa-cyan); border-radius:12px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="color:var(--alexa-cyan); font-size:1.2rem; margin-bottom:2px;">${display.medication} Dosage</h3>
            <div style="font-size:0.8rem; color:#cbd5e1;">Bracket: <strong>${display.bracket}</strong> (Weight: ${display.weightLbs} lbs)</div>
          </div>
          <div style="background:var(--alexa-cyan); color:#060e19; font-weight:800; font-size:1.4rem; padding:8px 16px; border-radius:12px;">
            ${display.doseMl} mL
          </div>
        </div>

        <!-- Oral Syringe Measurement Diagram -->
        <div style="background:#090e18; border-radius:10px; padding:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:0.75rem; font-weight:700; color:#38bdf8; text-transform:uppercase; margin-bottom:8px;">Oral Syringe Guide (${display.concentration})</div>
          <svg viewBox="0 0 500 70" width="100%" height="50">
            <!-- Syringe barrel -->
            <rect x="20" y="20" width="400" height="30" rx="4" fill="#1e293b" stroke="#475569" stroke-width="2"/>
            <!-- Liquid fill up to doseMl (out of 5ml scale) -->
            <rect x="20" y="22" width="${Math.min(400, (display.doseMl / 5) * 400)}" height="26" fill="rgba(0,210,255,0.7)"/>
            <!-- Syringe markings -->
            <line x1="100" y1="20" x2="100" y2="35" stroke="#94a3b8" stroke-width="2"/>
            <text x="95" y="45" fill="#94a3b8" font-size="10">1.25</text>
            <line x1="200" y1="20" x2="200" y2="40" stroke="#fff" stroke-width="2"/>
            <text x="195" y="45" fill="#fff" font-size="10">2.5 mL</text>
            <line x1="300" y1="20" x2="300" y2="35" stroke="#94a3b8" stroke-width="2"/>
            <text x="295" y="45" fill="#94a3b8" font-size="10">3.75</text>
            <line x1="400" y1="20" x2="400" y2="40" stroke="#fff" stroke-width="2"/>
            <text x="390" y="45" fill="#fff" font-size="10">5.0 mL</text>
          </svg>
          <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">⏱️ Frequency: <strong>${display.interval}</strong>. Use included oral syringe only.</div>
        </div>

        <div style="display:flex; gap:8px;">
          <button class="mm-btn primary" onclick="executeUtterance('Log that I gave ${display.doseMl} mL of ${display.medication}')">✅ Log ${display.doseMl} mL Administered</button>
          <button class="mm-btn secondary" onclick="executeUtterance('Is it safe to give medicine now?')">⏱️ Check Interval Timer</button>
        </div>
      </div>
    `;
  } else if (display.type === 'dosing_warning') {
    badge = 'Pediatric Contraindication Warning';
    innerHtml = `
      <div style="flex:1; background:rgba(239,68,68,0.15); border:2px solid #ef4444; border-radius:12px; padding:18px;">
        <h3 style="color:#ef4444; font-size:1.3rem; margin-bottom:8px;">🛑 DO NOT ADMINISTER ${display.medication.toUpperCase()}</h3>
        <p style="font-size:0.95rem; color:#ffffff; line-height:1.5;">${escapeHtml(display.warning)}</p>
        <div style="margin-top:14px; display:flex; gap:8px;">
          <button class="mm-btn primary" style="background:#ef4444; color:#fff;" onclick="executeUtterance('How much Tylenol for a 14 pound baby?')">Switch to Safe Acetaminophen (Tylenol)</button>
        </div>
      </div>
    `;
  } else if (display.type === 'safe_dose_status') {
    badge = 'Medication Interval Guardian';
    const isLocked = display.status === 'WAIT_INTERVAL_ACTIVE';
    innerHtml = `
      <div style="flex:1; display:flex; flex-direction:column; gap:12px;">
        <div style="background:${isLocked ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'}; border:1.5px solid ${isLocked ? '#f59e0b' : '#10b981'}; border-radius:12px; padding:16px;">
          <h3 style="color:${isLocked ? '#fbbf24' : '#34d399'}; font-size:1.3rem;">
            ${isLocked ? `🛑 Re-Dose Locked: Wait ${display.countdownMinutes} Minutes` : `✅ Safe to Administer ${display.medication}`}
          </h3>
          <p style="font-size:0.85rem; color:#e2e8f0; margin-top:4px;">
            ${isLocked ? `Last dose was administered at ${display.lastDoseTime}. Minimum safe interval is 4 hours.` : `Safe interval has elapsed since last dose.`}
          </p>
        </div>
        ${isLocked ? `
          <div style="background:#090e18; border-radius:10px; padding:12px; font-size:0.82rem; color:#94a3b8;">
            Next Safe Administration Time: <strong style="color:#fff; font-size:1.1rem;">${display.nextSafeTime}</strong>
          </div>
        ` : ''}
      </div>
    `;
  } else if (display.type === 'doctor_summary') {
    badge = 'Pediatrician Clinical Hand-Off';
    innerHtml = `
      <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
        <div style="background:#090e18; border:1px solid var(--alexa-cyan); border-radius:12px; padding:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;">
            <strong style="color:var(--alexa-cyan); font-size:1rem;">Patient: ${display.summary.patient.name} (${display.summary.patient.ageMonths} mos, ${display.summary.patient.weightLbs} lbs)</strong>
            <span style="color:#94a3b8; font-size:0.75rem;">${display.generatedAt}</span>
          </div>
          <div style="font-size:0.82rem; color:#cbd5e1; display:flex; flex-direction:column; gap:4px;">
            <div>🌡️ <strong>Fever Curve:</strong> Peak ${display.summary.peakFever} (Baseline ${display.summary.lowestFever})</div>
            <div>💊 <strong>Medications Given:</strong> ${display.summary.medications.join('; ')}</div>
            <div>💧 <strong>Hydration:</strong> ${display.summary.hydration}</div>
            <div>👂 <strong>Reported Symptoms:</strong> ${display.summary.symptoms.join(', ')}</div>
          </div>
        </div>
      </div>
    `;
  } else if (display.type === 'comfort_guide') {
    badge = 'Non-Medication Comfort Guide';
    innerHtml = `
      <div style="flex:1; display:flex; flex-direction:column; gap:8px; font-size:0.82rem; color:#cbd5e1;">
        <div style="background:#090e18; border-radius:10px; padding:12px; border:1px solid rgba(255,255,255,0.08);">
          <div style="margin-bottom:6px;">💧 <strong>Hydration:</strong> ${display.guidelines.hydration}</div>
          <div style="margin-bottom:6px;">👕 <strong>Clothing:</strong> ${display.guidelines.clothing}</div>
          <div style="margin-bottom:6px;">🌡️ <strong>Room Temp:</strong> ${display.guidelines.roomTemp}</div>
          <div style="color:#ef4444; font-weight:600;">🛑 ${display.guidelines.neverGive}</div>
        </div>
      </div>
    `;
  }

  mmBadge.textContent = badge;
  mmContent.innerHTML = innerHtml;

  if (echoAmbientHome) echoAmbientHome.style.display = 'none';
  mmStage.style.display = 'flex';
}

function setListening(active, label) {
  if (statusLabel) statusLabel.textContent = label;
  if (listeningBar) listeningBar.classList.toggle('active', active);
  if (ringBtn) ringBtn.classList.toggle('active', active);
}

function populateInspector(data) {
  const toolNameEl = document.getElementById('latest-tool-name');
  const toolStatusEl = document.getElementById('latest-tool-status');
  const reasoningEl = document.getElementById('latest-tool-reasoning');

  const codeToolResult = document.getElementById('code-tool-result');
  const codeToolArgs = document.getElementById('code-tool-args');
  const codeRawJson = document.getElementById('code-raw-json');

  if (data.toolCall) {
    toolNameEl.textContent = `⚡ ${data.toolCall.name}`;
    toolStatusEl.textContent = 'DISPATCHED (200 OK)';
    toolStatusEl.className = 'banner-status-tag success';
    reasoningEl.textContent = data.agentReasoning || 'Tool invoked matching clinical criteria.';

    codeToolResult.textContent = JSON.stringify(data.toolResult, null, 2);
    codeToolArgs.textContent = JSON.stringify(data.toolCall.arguments, null, 2);
  } else {
    toolNameEl.textContent = 'Standard Conversational Reply';
    toolStatusEl.textContent = 'DIRECT';
    toolStatusEl.className = 'banner-status-tag';
    reasoningEl.textContent = data.agentReasoning || 'Direct conversational reply.';

    codeToolResult.textContent = '// No external tool was invoked';
    codeToolArgs.textContent = '{}';
  }

  codeRawJson.textContent = JSON.stringify(data, null, 2);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initial state fetch
fetchServerState();
