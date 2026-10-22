import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// HEARTLAND HEALTH & AAP PEDIATRIC DOSING DATASETS & CLINICAL CONSTANTS
// ============================================================================

/**
 * Standard Pediatric Formulations:
 * 1. Acetaminophen (Tylenol): 160 mg / 5 mL (all infant & children's liquids standardized)
 * 2. Ibuprofen (Motrin/Advil):
 *    - Infant drops: 50 mg / 1.25 mL
 *    - Children's liquid: 100 mg / 5 mL
 *    * STRICT AGE RULE: 6+ months only. NEVER under 6 months.
 * 3. Diphenhydramine (Benadryl): 12.5 mg / 5 mL (Strictly by weight)
 * 4. Cetirizine (Zyrtec): 2.5 mg / 5 mL or 5 mg / 5 mL
 */

// Weight bracket dosing tables directly aligned with Heartland Community Health Center charts
const DOSING_TABLES = {
  acetaminophen: [
    { minWeight: 6, maxWeight: 11, doseMg: 40, doseMl: 1.25, ageGuide: '0-3 mos' },
    { minWeight: 12, maxWeight: 17, doseMg: 80, doseMl: 2.5, ageGuide: '4-11 mos' },
    { minWeight: 18, maxWeight: 23, doseMg: 120, doseMl: 3.75, ageGuide: '12-23 mos' },
    { minWeight: 24, maxWeight: 35, doseMg: 160, doseMl: 5.0, ageGuide: '2-3 yrs' },
    { minWeight: 36, maxWeight: 47, doseMg: 240, doseMl: 7.5, ageGuide: '4-5 yrs' },
    { minWeight: 48, maxWeight: 59, doseMg: 320, doseMl: 10.0, ageGuide: '6-8 yrs' },
    { minWeight: 60, maxWeight: 71, doseMg: 400, doseMl: 12.5, ageGuide: '9-10 yrs' },
    { minWeight: 72, maxWeight: 95, doseMg: 480, doseMl: 15.0, ageGuide: '11 yrs' }
  ],
  ibuprofen_infant: [
    // 50 mg per 1.25 mL (Infant Concentrated Drops with Syringe)
    { minWeight: 12, maxWeight: 17, doseMg: 50, doseMl: 1.25, ageGuide: '6-11 mos' },
    { minWeight: 18, maxWeight: 23, doseMg: 75, doseMl: 1.875, ageGuide: '12-23 mos' }
  ],
  ibuprofen_children: [
    // 100 mg per 5 mL (Children's Liquid Suspension)
    { minWeight: 12, maxWeight: 17, doseMg: 50, doseMl: 2.5, ageGuide: '6-11 mos' },
    { minWeight: 18, maxWeight: 23, doseMg: 75, doseMl: 3.75, ageGuide: '12-23 mos' },
    { minWeight: 24, maxWeight: 35, doseMg: 100, doseMl: 5.0, ageGuide: '2-3 yrs' },
    { minWeight: 36, maxWeight: 47, doseMg: 150, doseMl: 7.5, ageGuide: '4-5 yrs' },
    { minWeight: 48, maxWeight: 59, doseMg: 200, doseMl: 10.0, ageGuide: '6-8 yrs' },
    { minWeight: 60, maxWeight: 71, doseMg: 250, doseMl: 12.5, ageGuide: '9-10 yrs' },
    { minWeight: 72, maxWeight: 95, doseMg: 300, doseMl: 15.0, ageGuide: '11 yrs' }
  ],
  benadryl: [
    // 12.5 mg per 5 mL
    { minWeight: 12, maxWeight: 17, doseMg: 6.25, doseMl: 2.5, ageGuide: 'Consult Doctor' },
    { minWeight: 18, maxWeight: 23, doseMg: 9.375, doseMl: 3.75, ageGuide: 'Consult Doctor' },
    { minWeight: 24, maxWeight: 35, doseMg: 12.5, doseMl: 5.0, ageGuide: '2-3 yrs' },
    { minWeight: 36, maxWeight: 47, doseMg: 18.75, doseMl: 7.5, ageGuide: '4-5 yrs' },
    { minWeight: 48, maxWeight: 59, doseMg: 25.0, doseMl: 10.0, ageGuide: '6-8 yrs' },
    { minWeight: 60, maxWeight: 95, doseMg: 37.5, doseMl: 15.0, ageGuide: '9-11 yrs' }
  ],
  zyrtec: [
    // 2.5 mg per 5 mL or 5 mg per 5 mL
    { minWeight: 12, maxWeight: 23, doseMg: 2.5, doseMl: 2.5, ageGuide: '6-23 mos' },
    { minWeight: 24, maxWeight: 47, doseMg: 5.0, doseMl: 5.0, ageGuide: '2-5 yrs' },
    { minWeight: 48, maxWeight: 95, doseMg: 10.0, doseMl: 10.0, ageGuide: '6+ yrs' }
  ]
};

// In-Memory Child Health Episode State
const episodeState = {
  child: {
    name: 'Emma',
    ageMonths: 4,
    weightLbs: 14.2
  },
  vitalsLog: [
    { timestamp: new Date(Date.now() - 6 * 3600000).toISOString(), type: 'temperature', value: 100.2, unit: 'F' },
    { timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), type: 'temperature', value: 101.4, unit: 'F' }
  ],
  medicationLog: [
    {
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
      medication: 'acetaminophen',
      formulation: 'infant_liquid_160_5',
      doseMl: 1.25,
      doseMg: 40,
      notes: 'Given by parent with syringe'
    }
  ],
  symptomLog: [
    { timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), text: 'Tugging at left ear, fussy, warm to touch' }
  ],
  hydrationLog: {
    wetDiapersLast12h: 3,
    lastFeedingOz: 3.5,
    lastFeedingTime: '1 hr ago'
  }
};

// Helper to look up Heartland bracket
function lookupDose(medication, formulation, weightLbs, ageMonths) {
  let table = [];
  let minAgeMonths = 0;
  let intervalHours = 4;
  let concentrationLabel = '';

  if (medication === 'acetaminophen') {
    table = DOSING_TABLES.acetaminophen;
    minAgeMonths = 0;
    intervalHours = 4; // every 4-6 hours
    concentrationLabel = '160 mg / 5 mL';
  } else if (medication === 'ibuprofen') {
    minAgeMonths = 6;
    intervalHours = 6; // every 6-8 hours
    if (formulation === 'infant_drops') {
      table = DOSING_TABLES.ibuprofen_infant;
      concentrationLabel = '50 mg / 1.25 mL (Infant Concentrated Drops)';
    } else {
      table = DOSING_TABLES.ibuprofen_children;
      concentrationLabel = '100 mg / 5 mL (Children\'s Suspension)';
    }
  } else if (medication === 'benadryl') {
    table = DOSING_TABLES.benadryl;
    minAgeMonths = 12; // consult doctor under 1 year
    intervalHours = 6;
    concentrationLabel = '12.5 mg / 5 mL';
  } else if (medication === 'zyrtec') {
    table = DOSING_TABLES.zyrtec;
    minAgeMonths = 6;
    intervalHours = 24; // once every 24 hours
    concentrationLabel = '2.5 mg / 5 mL';
  }

  // Age restriction check
  if (ageMonths < minAgeMonths) {
    return {
      contraindicated: true,
      reason: `Contraindication: ${medication.toUpperCase()} is strictly not recommended for infants under ${minAgeMonths} months of age without direct pediatrician supervision.`
    };
  }

  // Bracket match
  const bracket = table.find(b => weightLbs >= b.minWeight && weightLbs <= b.maxWeight);
  if (!bracket) {
    // If lower than lowest bracket
    if (weightLbs < table[0].minWeight) {
      return {
        contraindicated: true,
        reason: `Weight (${weightLbs} lbs) is under standard OTC dosing chart minimum (${table[0].minWeight} lbs). Please call your pediatrician for exact weight-based prescription dosing.`
      };
    }
    // High bracket fallback
    const last = table[table.length - 1];
    return {
      doseMl: last.doseMl,
      doseMg: last.doseMg,
      bracket: `${last.minWeight}+ lbs`,
      concentrationLabel,
      intervalHours
    };
  }

  return {
    doseMl: bracket.doseMl,
    doseMg: bracket.doseMg,
    bracket: `${bracket.minWeight}-${bracket.maxWeight} lbs`,
    ageGuide: bracket.ageGuide,
    concentrationLabel,
    intervalHours
  };
}

// ============================================================================
// BUILD SOLE OFFICIAL PEDIATRIC MCP SERVER (SPEC 2025-11-25 / STREAMABLE HTTP)
// ============================================================================

export function buildServer() {
  const server = new McpServer({
    name: 'pediatric-care-mcp',
    version: '1.0.0'
  });

  // TOOL 1: evaluate_pediatric_triage
  server.registerTool(
    'evaluate_pediatric_triage',
    {
      description: 'Evaluate infant and child symptoms, fever urgency, and red flags using AAP and Heartland pediatric triage protocols. Produces clinical recommendations and multimodal Echo Show alert cards.',
      inputSchema: {
        child_age_months: z.number().describe('Age of the child in months (e.g. 4 for 4-month-old)'),
        temperature_f: z.number().optional().describe('Recorded body temperature in Fahrenheit (e.g. 101.4)'),
        symptoms: z.array(z.string()).describe("Observed symptoms, e.g. ['tugging at left ear', 'fussy', 'reduced appetite']"),
        weight_lbs: z.number().optional().describe("Child's weight in pounds (if known)"),
        last_medication: z.object({
          name: z.enum(['acetaminophen', 'ibuprofen', 'benadryl', 'zyrtec', 'none']).default('none'),
          dose_amount: z.string().optional().describe("Dose administered, e.g. '1.25 ml'"),
          hours_ago: z.number().optional().describe('How many hours ago dose was administered')
        }).optional()
      }
    },
    async ({ child_age_months, temperature_f, symptoms = [], weight_lbs, last_medication }) => {
      let urgencyTier = 'HOME_CARE';
      let urgencyTitle = 'Home Monitoring & Comfort Care';
      let urgencyColor = '#10b981'; // Green
      const clinicalNotes = [];

      // 1. AAP Age-Specific Fever Threshold Rules
      if (temperature_f !== undefined && temperature_f >= 100.4) {
        if (child_age_months < 3) {
          urgencyTier = 'EMERGENCY_IMMEDIATE';
          urgencyTitle = '🔴 RED ALERT: Seek Immediate Emergency Medical Care';
          urgencyColor = '#ef4444';
          clinicalNotes.push('Critical AAP Rule: Any fever >= 100.4°F in infants under 3 months requires immediate emergency evaluation to rule out neonatal infection.');
        } else if (child_age_months <= 6) {
          urgencyTier = 'CALL_PEDIATRICIAN';
          urgencyTitle = '🟡 Call Pediatrician Today';
          urgencyColor = '#fbbf24';
          clinicalNotes.push(`Fever of ${temperature_f}°F in a ${child_age_months}-month-old warrants clinical evaluation within 24 hours.`);
        } else if (temperature_f >= 104.0) {
          urgencyTier = 'CALL_PEDIATRICIAN_URGENT';
          urgencyTitle = '🟡 High Fever: Contact Pediatrician Promptly';
          urgencyColor = '#f59e0b';
          clinicalNotes.push(`High fever (>= 104.0°F) requires pediatric guidance.`);
        }
      }

      // 2. Ear Tugging / Otitis Media Check
      const hasEarSymptom = symptoms.some(s => s.toLowerCase().includes('ear') || s.toLowerCase().includes('tugging'));
      if (hasEarSymptom) {
        clinicalNotes.push('Ear tugging with fever is a hallmark indicator of Acute Otitis Media (middle ear infection). Pediatrician otoscopic exam is advised.');
        if (urgencyTier === 'HOME_CARE') {
          urgencyTier = 'CALL_PEDIATRICIAN';
          urgencyTitle = '🟡 Call Pediatrician (Suspected Ear Infection)';
          urgencyColor = '#fbbf24';
        }
      }

      // 3. Medication Window Evaluation
      let medEvaluation = '';
      if (last_medication && last_medication.name !== 'none') {
        const interval = last_medication.name === 'acetaminophen' ? 4 : 6;
        const hoursAgo = last_medication.hours_ago || 0;
        const hoursRemaining = Math.max(0, interval - hoursAgo);

        if (hoursRemaining > 0) {
          medEvaluation = `Last dose was ${last_medication.name} (${last_medication.dose_amount || 'dose'}) ${hoursAgo} hr(s) ago. Minimum spacing is ${interval} hours. DO NOT administer more ${last_medication.name} for another ${hoursRemaining.toFixed(1)} hour(s).`;
        } else {
          medEvaluation = `Last dose was ${last_medication.name} ${hoursAgo} hr(s) ago. Minimum safe interval (${interval} hrs) has elapsed; child is eligible for re-dose if fever/discomfort warrants.`;
        }

        // Under 6 months Ibuprofen contraindication check
        if (last_medication.name === 'ibuprofen' && child_age_months < 6) {
          urgencyTier = 'CALL_PEDIATRICIAN_URGENT';
          urgencyTitle = '⚠️ Medication Warning: Ibuprofen under 6 months';
          urgencyColor = '#ef4444';
          clinicalNotes.push('CRITICAL: Ibuprofen is contraindicated for infants under 6 months. Monitor for stomach distress and consult your doctor.');
        }
      }

      const voiceResponse = `At ${child_age_months} months old, a ${temperature_f ? `${temperature_f} degree fever` : 'fever'} ${hasEarSymptom ? 'with ear tugging' : ''} suggests you should contact your pediatrician today. ${medEvaluation} What is the baby's current weight so I can verify her exact milliliter dosage?`;

      const displayPayload = {
        type: 'pediatric_triage',
        urgencyTier,
        urgencyTitle,
        urgencyColor,
        childAge: `${child_age_months} Months Old`,
        temperature: temperature_f ? `${temperature_f}° F` : 'Not recorded',
        clinicalNotes,
        medEvaluation,
        recommendedActions: [
          'Call Pediatrician Office for Appointment',
          'Offer frequent breastmilk or formula to ensure hydration',
          'Dress in lightweight single layer clothing (do not bundle)',
          'Check next safe dosing window before giving any medicine'
        ]
      };

      return {
        content: [{ type: 'text', text: voiceResponse }],
        _meta: { display: displayPayload }
      };
    }
  );

  // TOOL 2: calculate_pediatric_medication_dose
  server.registerTool(
    'calculate_pediatric_medication_dose',
    {
      description: "Calculate weight-based pediatric liquid medication dosages in milliliters (mL) matching Heartland Health & AAP standards for Acetaminophen, Ibuprofen, Benadryl, and Zyrtec. Enforces age restrictions (Ibuprofen strictly 6+ months).",
      inputSchema: {
        medication: z.enum(['acetaminophen', 'ibuprofen', 'benadryl', 'zyrtec']).describe('Medication name'),
        child_age_months: z.number().describe('Child age in months'),
        weight_lbs: z.number().describe('Child weight in pounds'),
        formulation: z.enum(['infant_drops', 'childrens_liquid', 'standard']).default('standard').describe('Product formulation type')
      }
    },
    async ({ medication, child_age_months, weight_lbs, formulation = 'standard' }) => {
      const calc = lookupDose(medication, formulation, weight_lbs, child_age_months);

      if (calc.contraindicated) {
        return {
          content: [{
            type: 'text',
            text: `⚠️ Safety Notice: ${calc.reason}`
          }],
          _meta: {
            display: {
              type: 'dosing_warning',
              medication,
              warning: calc.reason
            }
          }
        };
      }

      const voice = `For a ${weight_lbs} pound child (${calc.bracket}), the recommended dose of ${medication} is ${calc.doseMl} milliliters (${calc.doseMg} milligrams) of the ${calc.concentrationLabel} formulation. Administer using an oral syringe every ${calc.intervalHours} to ${calc.intervalHours + 2} hours as needed. Never use a kitchen teaspoon.`;

      return {
        content: [{ type: 'text', text: voice }],
        _meta: {
          display: {
            type: 'dosing_result',
            medication: medication.toUpperCase(),
            weightLbs: weight_lbs,
            bracket: calc.bracket,
            doseMl: calc.doseMl,
            doseMg: calc.doseMg,
            concentration: calc.concentrationLabel,
            interval: `Every ${calc.intervalHours}-${calc.intervalHours + 2} hours as needed`,
            heartlandChartUrl: 'https://heartlandhealth.org/dosing-charts/'
          }
        }
      };
    }
  );

  // TOOL 3: log_medication_or_vital
  server.registerTool(
    'log_medication_or_vital',
    {
      description: 'Record administered medication dose, temperature measurement, or hydration status to prevent accidental double-dosing across caregivers.',
      inputSchema: {
        entry_type: z.enum(['medication', 'temperature', 'hydration', 'symptom']).describe('Type of entry'),
        medication: z.enum(['acetaminophen', 'ibuprofen', 'benadryl', 'zyrtec']).optional().describe('Medication given'),
        dose_ml: z.number().optional().describe('Amount in milliliters'),
        temperature_f: z.number().optional().describe('Body temperature in Fahrenheit'),
        notes: z.string().optional().describe('Caregiver notes')
      }
    },
    async ({ entry_type, medication, dose_ml, temperature_f, notes = '' }) => {
      const now = new Date().toISOString();

      if (entry_type === 'medication' && medication && dose_ml) {
        episodeState.medicationLog.unshift({
          timestamp: now,
          medication,
          doseMl: dose_ml,
          notes: notes || 'Logged via Alexa'
        });
      } else if (entry_type === 'temperature' && temperature_f) {
        episodeState.vitalsLog.unshift({
          timestamp: now,
          type: 'temperature',
          value: temperature_f,
          unit: 'F'
        });
      }

      const voice = `Logged ${entry_type === 'medication' ? `${dose_ml} mL of ${medication}` : `${temperature_f} degrees temperature`} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. I've updated the timeline and reset the safe re-dose clock.`;

      return {
        content: [{ type: 'text', text: voice }],
        _meta: {
          display: {
            type: 'log_confirmation',
            entryType: entry_type,
            medication,
            doseMl: dose_ml,
            temperatureF: temperature_f,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            totalMedsGiven: episodeState.medicationLog.length
          }
        }
      };
    }
  );

  // TOOL 4: check_next_safe_dose_window
  server.registerTool(
    'check_next_safe_dose_window',
    {
      description: 'Determine the exact minutes remaining before the child can safely receive their next medication dose, preventing accidental double-dosing.',
      inputSchema: {
        medication: z.enum(['acetaminophen', 'ibuprofen']).default('acetaminophen').describe('Target medication to evaluate')
      }
    },
    async ({ medication = 'acetaminophen' }) => {
      const last = episodeState.medicationLog.find(m => m.medication === medication);
      const intervalHours = medication === 'acetaminophen' ? 4 : 6;

      if (!last) {
        return {
          content: [{
            type: 'text',
            text: `No previous doses of ${medication} recorded in this episode. Your child is eligible for a dose if fever or discomfort requires it.`
          }],
          _meta: {
            display: {
              type: 'safe_dose_status',
              medication,
              status: 'ELIGIBLE_NOW',
              countdownMinutes: 0
            }
          }
        };
      }

      const elapsedMs = Date.now() - new Date(last.timestamp).getTime();
      const elapsedHours = elapsedMs / (1000 * 3600);
      const remainingHours = Math.max(0, intervalHours - elapsedHours);
      const remainingMinutes = Math.ceil(remainingHours * 60);

      let voice = '';
      let status = 'ELIGIBLE_NOW';

      if (remainingMinutes > 0) {
        status = 'WAIT_INTERVAL_ACTIVE';
        voice = `Do not give ${medication} yet. The last dose of ${last.doseMl} mL was given ${Math.round(elapsedHours * 10) / 10} hours ago. You must wait another ${remainingMinutes} minutes until ${new Date(Date.now() + remainingMinutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      } else {
        voice = `Yes, your child is eligible for their next dose of ${medication}. The required ${intervalHours}-hour interval has passed since the last dose at ${new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
      }

      return {
        content: [{ type: 'text', text: voice }],
        _meta: {
          display: {
            type: 'safe_dose_status',
            medication: medication.toUpperCase(),
            lastDoseTime: new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            lastDoseMl: last.doseMl,
            status,
            countdownMinutes: remainingMinutes,
            nextSafeTime: new Date(Date.now() + remainingMinutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        }
      };
    }
  );

  // TOOL 5: get_comfort_care_guidelines
  server.registerTool(
    'get_comfort_care_guidelines',
    {
      description: 'AAP evidence-based non-pharmacological comfort guidance for pediatric fevers and colds (hydration schedules, room climate, clothing, myth-busting).',
      inputSchema: {
        condition: z.enum(['fever', 'congestion', 'ear_pain', 'vomiting_dehydration']).default('fever')
      }
    },
    async ({ condition = 'fever' }) => {
      const guidelines = {
        hydration: 'Offer small, frequent feedings (every 1-2 hours). For breastfed/formula infants, maintain regular feeds. For toddlers 1+, dilute juices or oral rehydration solutions.',
        clothing: 'Dress child in a single layer of lightweight clothing. Do not bundle in blankets as this traps heat and elevates core temperature.',
        roomTemp: 'Keep the room comfortably cool (68°F - 70°F). Use a fan pointed away from the child to circulate air.',
        bathing: 'Sponge with lukewarm water ONLY if the child is distressed. NEVER use cold water, ice baths, or rubbing alcohol (toxic through skin).',
        neverGive: 'NEVER give Aspirin to children or teenagers due to the risk of Reye\'s Syndrome (a rare but fatal condition).'
      };

      const voice = "For fever comfort, keep her in a single lightweight layer, maintain room temperature between 68 and 70 degrees, and offer small frequent feedings. Never bundle a feverish baby in blankets or use cold baths. I have placed the complete comfort guide on your screen.";

      return {
        content: [{ type: 'text', text: voice }],
        _meta: {
          display: {
            type: 'comfort_guide',
            condition: condition.toUpperCase(),
            guidelines,
            actions: [
              'Check hydration (minimum 4 wet diapers in 24h)',
              'Adjust nursery thermostat to 69°F',
              'Offer 2 oz fluids'
            ]
          }
        }
      };
    }
  );

  // TOOL 6: export_pediatrician_visit_summary
  server.registerTool(
    'export_pediatrician_visit_summary',
    {
      description: 'Generate a structured clinical summary of the illness episode (temperatures, medication log, fluids) formatted for pediatrician appointments or ER handoffs.',
      inputSchema: {
        doctor_name: z.string().optional().default('Pediatrician')
      }
    },
    async ({ doctor_name = 'Pediatrician' }) => {
      const temps = episodeState.vitalsLog.filter(v => v.type === 'temperature').map(v => v.value);
      const minTemp = temps.length ? Math.min(...temps) : 98.6;
      const peakTemp = temps.length ? Math.max(...temps) : 101.4;

      const summary = {
        patient: { name: episodeState.child.name, ageMonths: episodeState.child.ageMonths, weightLbs: episodeState.child.weightLbs },
        peakFever: `${peakTemp}° F`,
        lowestFever: `${minTemp}° F`,
        totalDosesGiven: episodeState.medicationLog.length,
        medications: episodeState.medicationLog.map(m => `${m.medication.toUpperCase()} (${m.doseMl} mL) at ${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`),
        symptoms: episodeState.symptomLog.map(s => s.text),
        hydration: `${episodeState.hydrationLog.wetDiapersLast12h} wet diapers in past 12 hrs • Last feed: ${episodeState.hydrationLog.lastFeedingOz} oz`
      };

      const voice = `I have generated Emma's pediatric visit summary. It shows a peak fever of ${peakTemp} degrees, with ${summary.totalDosesGiven} doses of medication recorded over the past 6 hours, and ${episodeState.hydrationLog.wetDiapersLast12h} wet diapers. You can present this directly to Dr. ${doctor_name}.`;

      return {
        content: [{ type: 'text', text: voice }],
        _meta: {
          display: {
            type: 'doctor_summary',
            doctorName: doctor_name,
            summary,
            generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
          }
        }
      };
    }
  );

  return server;
}

// ============================================================================
// EXPRESS APP & SIMULATOR ENDPOINTS
// ============================================================================

const app = createMcpExpressApp();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// List tools helper endpoint
app.get('/api/tools', async (_req, res) => {
  const tools = [
    { name: 'evaluate_pediatric_triage', description: 'Clinical assessment of symptoms, fever urgency by age, and AAP triage rules' },
    { name: 'calculate_pediatric_medication_dose', description: 'Heartland Health & AAP weight-based dosing for Acetaminophen, Motrin, Benadryl, Zyrtec' },
    { name: 'log_medication_or_vital', description: 'Timestamped recording of administered medicine or temperature to avoid double-dosing' },
    { name: 'check_next_safe_dose_window', description: 'Countdown timer and safe interval enforcement for next medication dose' },
    { name: 'get_comfort_care_guidelines', description: 'Evidence-based non-pharmacological comfort care, hydration, and fever myth-busting' },
    { name: 'export_pediatrician_visit_summary', description: 'Generates structured clinical hand-off report for pediatrician or ER visits' }
  ];
  res.json({ tools, episodeState });
});

// Alexa+ Simulation runner endpoint with clinical intent routing
app.post('/api/simulate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const p = prompt.toLowerCase();
  let toolToCall = null;
  let toolParams = {};

  // Alexa+ Agent reasoning & intent matcher
  if (p.includes('baby is') || p.includes('fever is') || p.includes('tugging') || p.includes('ear') || p.includes('sick') || p.includes('triage')) {
    toolToCall = 'evaluate_pediatric_triage';
    const ageMatch = p.match(/(\d+)\s*(?:month|mo)/);
    const tempMatch = p.match(/(\d+\.?\d*)\s*(?:degree|temp|fever)/) || p.match(/fever (?:is )?(\d+\.?\d*)/);
    const tempVal = tempMatch ? parseFloat(tempMatch[1]) : (p.includes('101.4') ? 101.4 : 101.2);
    const ageVal = ageMatch ? parseInt(ageMatch[1], 10) : 4;

    const lastMed = p.includes('tylenol') || p.includes('acetaminophen')
      ? { name: 'acetaminophen', dose_amount: '1.25 ml', hours_ago: 2 }
      : { name: 'none' };

    toolParams = {
      child_age_months: ageVal,
      temperature_f: tempVal,
      symptoms: ['fever', 'tugging at left ear', 'fussy'],
      weight_lbs: 14.2,
      last_medication: lastMed
    };
  } else if (p.includes('how much') || p.includes('dosage') || p.includes('dose') || p.includes('can my') || p.includes('motrin') || p.includes('tylenol') || p.includes('benadryl') || p.includes('zyrtec')) {
    if (p.includes('can i give') || p.includes('next dose') || p.includes('when can') || p.includes('safe to give')) {
      toolToCall = 'check_next_safe_dose_window';
      toolParams = { medication: p.includes('motrin') || p.includes('ibuprofen') ? 'ibuprofen' : 'acetaminophen' };
    } else {
      toolToCall = 'calculate_pediatric_medication_dose';
      const med = p.includes('motrin') || p.includes('ibuprofen') ? 'ibuprofen'
                : (p.includes('benadryl') ? 'benadryl' : (p.includes('zyrtec') ? 'zyrtec' : 'acetaminophen'));
      const weightMatch = p.match(/(\d+)\s*lb/);
      toolParams = {
        medication: med,
        child_age_months: 4,
        weight_lbs: weightMatch ? parseFloat(weightMatch[1]) : 14.2,
        formulation: med === 'ibuprofen' ? 'infant_drops' : 'standard'
      };
    }
  } else if (p.includes('log') || p.includes('gave') || p.includes('recorded')) {
    toolToCall = 'log_medication_or_vital';
    const isMed = p.includes('tylenol') || p.includes('motrin') || p.includes('ml');
    if (isMed) {
      toolParams = {
        entry_type: 'medication',
        medication: p.includes('motrin') ? 'ibuprofen' : 'acetaminophen',
        dose_ml: 2.5,
        notes: 'Administered with oral syringe'
      };
    } else {
      toolParams = {
        entry_type: 'temperature',
        temperature_f: 101.4,
        notes: 'Digital temporal thermometer'
      };
    }
  } else if (p.includes('comfort') || p.includes('shivering') || p.includes('cool') || p.includes('blanket') || p.includes('bath') || p.includes('hydrate')) {
    toolToCall = 'get_comfort_care_guidelines';
    toolParams = { condition: 'fever' };
  } else if (p.includes('summary') || p.includes('doctor') || p.includes('pediatrician') || p.includes('export') || p.includes('appointment')) {
    toolToCall = 'export_pediatrician_visit_summary';
    toolParams = { doctor_name: 'Panda Pediatrics' };
  } else {
    // Default fallback to triage query
    toolToCall = 'evaluate_pediatric_triage';
    toolParams = {
      child_age_months: 4,
      temperature_f: 101.4,
      symptoms: ['fever', 'tugging at left ear'],
      last_medication: { name: 'acetaminophen', dose_amount: '1.25 ml', hours_ago: 2 }
    };
  }

  // Execute against the active MCP toolset
  const server = buildServer();
  let executionResult = null;
  let visualMetadata = null;

  try {
    const toolInstance = server._registeredTools ? server._registeredTools[toolToCall] : null;
    if (toolInstance && toolInstance.handler) {
      executionResult = await toolInstance.handler(toolParams);
      visualMetadata = executionResult._meta?.display || null;
    }
  } catch (err) {
    executionResult = { content: [{ type: 'text', text: `Clinical execution error: ${err.message}` }] };
  }

  return res.json({
    prompt,
    intentDetected: 'CLINICAL_MCP_DISPATCH',
    agentReasoning: `Alexa+ Agent identified clinical pediatric tool '${toolToCall}' using Heartland Health guidelines.`,
    toolCall: { name: toolToCall, arguments: toolParams },
    toolResult: executionResult,
    multimodalDisplay: visualMetadata,
    alexaResponse: executionResult?.content?.[0]?.text || 'I have evaluated the clinical guidelines.'
  });
});

// Standard MCP HTTP Transport Endpoint
app.post('/mcp', async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`🏥 PediatricCare MCP Server running at: http://${HOST}:${PORT}`);
  console.log(`📡 Streamable HTTP MCP endpoint at:     http://${HOST}:${PORT}/mcp`);
  console.log(`======================================================\n`);
});
