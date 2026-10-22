# LittleGuard: PediatricCare MCP for Alexa+

> **Ambient Pediatric Triage, Clinical Dosing Guard & Illness Episode Companion on Echo Show (MCP Spec 2025-11-25 / Streamable HTTP)**

[![MCP Specification](https://img.shields.io/badge/MCP%20Spec-2025--11--25-blue.svg)](https://modelcontextprotocol.io/)
[![Transport](https://img.shields.io/badge/Transport-Streamable%20HTTP-00d2ff.svg)](https://modelcontextprotocol.io/)
[![Clinical Dataset](https://img.shields.io/badge/Clinical%20Source-Heartland%20Health%20%26%20AAP-emerald.svg)](https://heartlandhealth.org/dosing-charts/)

---

## 💡 Elevator Pitch

LittleGuard is an Alexa+ MCP server transforming Echo Show into an ambient pediatric triage co-pilot—evaluating infant fevers, calculating safe mL dosages, and preventing accidental re-dosing.

---

## 📖 About the Project

### What Inspired Us
Every parent knows the terrifying dread of a middle-of-the-night pediatric fever. In a state of sleep deprivation, parents frequently commit catastrophic medication errors: giving Ibuprofen to babies under 6 months, confusing concentrated infant drops with children's suspensions, using kitchen spoons instead of oral syringes, or accidentally double-dosing when co-parents hand off care.

When you ask a standard voice assistant for help, you get a generic *"Consult a physician."* We built **LittleGuard** to deliver what parents actually need: **safe, evidence-based pediatric triage and dosage guidance** powered by the **Model Context Protocol (MCP)** and aligned directly with **Heartland Community Health Center & American Academy of Pediatrics (AAP)** clinical guidelines.

### What We Learned
1. **The Power of Streamable HTTP MCP**: Building on the official MCP specification (spec 2025-11-25+) with Streamable HTTP transport showed us how voice LLMs can dynamically query clinical computation engines without sacrificing deterministic safety rules.
2. **Pediatric Dosing is Non-Linear**: Unlike adults, children cannot be dosed by age—dosage is strictly driven by **weight (kg/lbs)** and **formulation concentration** (e.g., Infant Motrin drops are 2x more concentrated than Children's Motrin).
3. **Multimodal Fusion Saves Lives**: Spoken audio is easy to mishear at night. Rendering the exact **oral syringe fill level diagram** alongside the spoken voice response on Echo Show provides visual confirmation that prevents overdosing.

### How We Built It
- **Self-Hosted MCP Server**: Implemented using `@modelcontextprotocol/sdk` (v1.32.1) exposing a compliant **Streamable HTTP** endpoint at `/mcp`.
- **Clinical Knowledge Engine**: Encoded the official dosing datasets and age restrictions from **Heartland Community Health Center** (`acetaminophen`, `ibuprofen`, `diphenhydramine / benadryl`, and `cetirizine / zyrtec`).
- **Multimodal Echo Show Simulator**: A responsive 2-column web experience featuring an authentic Amazon Echo Show 15 smart display paired with a real-time **MCP Protocol Inspector** that displays tool call arguments, execution outputs, and raw JSON payloads.

### Challenges We Faced
- **Bridging Unstructured Speech to Clinical Schema**: Parents speak naturally in high-stress sentences (*"Baby is 4 months old, fever is 101.4, tugging at left ear, took 1.25ml infant Tylenol 2 hours ago"*). We architected the MCP tool schemas with strict Zod types while enabling the Alexa+ orchestrator to extract multi-entity parameters in a single conversational turn.
- **Enforcing Clinical Contraindications**: Ensuring that queries for Ibuprofen under 6 months trigger an immediate, high-priority safety lockout before any calculation occurs.

---

## 🛠️ Built With

- **Model Context Protocol (MCP)**: Spec 2025-11-25, Streamable HTTP Server Transport
- **Node.js & Express**: ES Modules runtime backend
- **Zod**: Input validation & schema definitions
- **Vanilla CSS3 & HTML5**: Zero-dependency Echo Show 15 design system with ambient glowing halo rings, live gauges, and clinical cards
- **Heartland Community Health & AAP Clinical Datasets**: Pediatric weight-based liquid guidelines

---

## ⚙️ The 6 MCP Tools Implemented

| MCP Tool | Purpose | Clinical Safeguard / Standard |
| :--- | :--- | :--- |
| `evaluate_pediatric_triage` | Analyzes symptoms, fever, and age urgency | AAP neonatal fever rules (Under 3 mos = immediate ER alert) |
| `calculate_pediatric_medication_dose` | Calculates exact weight-based mL for oral syringe | Heartland Health charts for Tylenol, Motrin, Benadryl, Zyrtec |
| `log_medication_or_vital` | Timestamped recording of doses and temperatures | Prevents accidental double-dosing across caregivers |
| `check_next_safe_dose_window` | Calculates remaining minutes until next dose | Enforces 4-hour (Tylenol) and 6-hour (Motrin) intervals |
| `get_comfort_care_guidelines` | Evidence-based non-pharmacological comfort | Hydration schedules, room climate, and fever myth-busting |
| `export_pediatrician_visit_summary` | Chronological clinical report for doctor appointments | Summary of peak fever, doses administered, and diapers |

---

## 🚀 Quickstart & Demo

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server & Simulator
```bash
npm start
```

- **Interactive Echo Show Simulator**: [http://127.0.0.1:3000](http://127.0.0.1:3000)
- **Official MCP Streamable HTTP Endpoint**: `http://127.0.0.1:3000/mcp`

### 3. Example Clinical Prompts to Try in the Demo
1. 🩺 *"Baby is 4 months old, fever is 101.4, tugging at left ear, took 1.25ml infant Tylenol 2 hours ago."*
   - *Result*: Evaluates urgency, flags suspected ear infection, warns that Tylenol interval is active, and asks for child weight.
2. 🛑 *"How much Motrin can my 14 lb baby take?"*
   - *Result*: Immediately triggers the 6-month contraindication alert banner on Echo Show.
3. ⚖️ *"How much Tylenol for a 14 pound baby?"*
   - *Result*: Calculates exact **2.5 mL (80 mg)** dose and renders the visual oral syringe guide on screen.
4. ⏰ *"Can I give her more medicine now?"*
   - *Result*: Displays countdown timer until next safe dose.
5. 📋 *"Export summary for Panda Pediatrics."*
   - *Result*: Generates a structured clinical hand-off report for the pediatrician.
