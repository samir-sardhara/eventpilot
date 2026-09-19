/**
 * Converts a conversational update into a small, auditable planning command.
 * An OpenAI-compatible call is optional; the local extractor keeps demos and
 * offline development useful without making product logic depend on one vendor.
 */
const PLANNING_SYSTEM_PROMPT = `You are EventPilot's operations planner. Extract only facts explicitly stated by the event manager. Return strict JSON:
{
  "summary":"short manager-ready response",
  "eventUpdates":{"guestCount":number?,"status":"planning|confirmed|live|completed"?,"requirements":[string]?},
  "tasks":[{"title":string,"category":string,"priority":"urgent|high|medium|low","status":"todo|in-progress|blocked|done","dueDate":"ISO date or null","dependency":string?}],
  "risks":[{"title":string,"description":string,"severity":"critical|high|medium|low","action":string}],
  "suggestions":[string]
}
Never invent dates, vendors, costs, or confirmations. A change in capacity, availability, deadline, or guest logistics can be a risk. Keep results concise.`;

function clean(text) {
  return text.replace(/[.!?]+$/, '').trim();
}

function futureFriday() {
  const date = new Date();
  const days = (5 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + days);
  date.setHours(17, 0, 0, 0);
  return date.toISOString();
}

function dateOneWeekBefore(startDate) {
  if (!startDate) return null;
  const date = new Date(startDate);
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

function normalizedTitle(name) {
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildFallbackPlan(message, event) {
  const text = message.toLowerCase();
  const tasks = [];
  const risks = [];
  const suggestions = [];
  const eventUpdates = {};
  // A capacity or travel-headcount is a subset, not a revision to total attendance.
  const isCapacityStatement = /(?:only\s+)?provide vehicles for\s+\d+|(?:vehicle|transport).*?capacity/i.test(message);
  const isTravellerSubset = /\b(?:around|approximately)\s+\d+\s+(?:guests|people|employees).{0,80}\b(?:travelling|traveling|outside the city|different cities)\b/i.test(message);
  const guestMatch = message.match(/(?:guest|attendee)\s+count\s*(?:is|of|for|:)?\s*(?:approximately|around)?\s*(\d{1,5})/i)
    || message.match(/(?:planning|organis(?:e|ing)|organizing|outing|wedding).{0,120}?\bfor\s+(?:approximately\s+|around\s+)?(\d{1,5})\s+(?:guests|people|employees|attendees)/i);
  if (guestMatch && !isCapacityStatement && !isTravellerSubset) eventUpdates.guestCount = Number(guestMatch[1]);

  const addTask = (title, category, priority = 'medium', status = 'todo', dueDate = null, dependency = '') => {
    tasks.push({ title, category, priority, status, dueDate, dependency });
  };

  if (/three[- ]day wedding|sangeet|haldi|wedding ceremony|reception/.test(text)) {
    eventUpdates.requirements = ['Venue', 'Catering', 'Décor', 'Photography', 'Entertainment', 'Guest accommodation', 'Transportation', 'Invitations'];
    ['Venue', 'Catering', 'Décor', 'Photography', 'Entertainment', 'Guest accommodation', 'Transportation', 'Invitations']
      .forEach((category) => addTask(`Confirm ${category.toLowerCase()}`, category, category === 'Venue' ? 'high' : 'medium'));
    suggestions.push('Assign owners to each workstream and set the event dates so deadlines can be calculated.');
  }

  if (/corporate outing/.test(text)) {
    eventUpdates.requirements = ['Transportation', 'Accommodation', 'Food', 'Team-building', 'Entertainment', 'Event branding'];
    ['Transportation', 'Accommodation', 'Food', 'Team-building activities', 'Entertainment', 'Event branding']
      .forEach((item) => addTask(`Confirm ${item.toLowerCase()}`, item, item === 'Transportation' ? 'high' : 'medium'));
  }

  const confirmed = message.match(/(?:the\s+)?(.+?)(?:\s+has been|\s+is)\s+(?:finalised|finalized|confirmed)/i);
  if (confirmed) {
    const item = clean(confirmed[1]).replace(/^the\s+/i, '');
    addTask(`Confirm ${item}`, normalizedTitle(item), 'medium', 'done');
    suggestions.push(`The ${item} is recorded as confirmed; review any dependent tasks before closing the workstream.`);
  }

  const needsConfirm = message.match(/(?:still need to confirm|need to finalise|need to finalize)\s+(?:the\s+)?(.+?)(?:\.|$)/i);
  if (needsConfirm) {
    const item = clean(needsConfirm[1]);
    addTask(`Confirm ${item}`, normalizedTitle(item), 'high');
  }

  const travellerMatch = message.match(/around\s+(\d+)\s+(?:guests|employees|people).*?(?:outside the city|different cities|travelling|traveling|airport transfers?|rooms?|accommodation)/i);
  if (travellerMatch) {
    const count = Number(travellerMatch[1]);
    const audience = /employee/i.test(message) ? 'employees' : 'guests';
    addTask(`Arrange accommodation for ${count} travelling ${audience}`, 'Accommodation', 'high');
    addTask(`Plan arrival and departure transfers for ${count} travelling ${audience}`, 'Transportation', 'high');
    suggestions.push(`Track travel details and rooming/vehicle manifests separately for the ${count} travellers.`);
  }

  if (/airport transfers?/.test(text) && !travellerMatch) {
    addTask('Arrange airport transfers', 'Transportation', 'high');
  }

  if (/final guest count.*one week before/.test(text)) {
    const dueDate = dateOneWeekBefore(event.startDate);
    addTask('Send final guest count to catering', 'Catering', 'high', 'todo', dueDate, 'Guest RSVP reconciliation');
    risks.push({
      title: 'Catering count dependency',
      description: 'Catering requires the final guest count one week before the event.',
      severity: 'high',
      action: 'Set an RSVP cut-off and assign a daily count owner.'
    });
  }

  const unavailable = message.match(/(?:the\s+)?(.+?)\s+(?:is|are) unavailable for\s+(?:the\s+)?(.+?)(?:\.|$)/i);
  if (unavailable) {
    const vendor = clean(unavailable[1]);
    const moment = clean(unavailable[2]);
    const vendorCategory = /photograph/i.test(vendor) ? 'Photography' : 'Vendor';
    const replacementTitle = /photograph/i.test(vendor) && /reception/i.test(moment)
      ? 'Source Reception photographer'
      : `Source backup for ${vendor} — ${moment}`;
    addTask(replacementTitle, vendorCategory, 'urgent', 'blocked');
    risks.push({
      title: `${normalizedTitle(vendor)} unavailable for ${moment}`,
      description: `The scheduled ${vendor} cannot cover the ${moment}.`,
      severity: 'critical',
      action: 'Contact backup options, compare availability, and confirm a replacement today.'
    });
    suggestions.push('Protect the run-of-show by reserving a backup before releasing the original slot.');
  }

  const capacity = message.match(/(?:only provide vehicles for\s+|capacity.*?)(\d+)\s+(?:people|guests|employees)/i);
  if (capacity && event.guestCount && Number(capacity[1]) < event.guestCount) {
    const shortfall = event.guestCount - Number(capacity[1]);
    addTask('Resolve transportation capacity shortfall', 'Transportation', 'urgent', 'blocked', null, `${shortfall} additional seats required`);
    risks.push({
      title: `Transportation shortfall: ${shortfall} seats`,
      description: `Current vendor can serve ${capacity[1]} of ${event.guestCount} attendees.`,
      severity: 'critical',
      action: 'Secure additional vehicles or split arrivals; confirm the final transport manifest.'
    });
  }

  if (/team[- ]building activities.*by friday/.test(text)) {
    addTask('Finalise team-building activities', 'Programming', 'high', 'todo', futureFriday());
  }

  if (/ceo.*second day|leadership session.*second day/.test(text)) {
    addTask('Schedule leadership session on day two', 'Programming', 'high');
    suggestions.push('Hold the leadership session only after confirming the CEO’s arrival window and travel buffer.');
  }

  // Handle direct action requests that do not match one of the planning patterns.
  if (!tasks.length && !risks.length) {
    addTask(clean(message), 'General', 'medium');
    suggestions.push('Add an owner and due date to turn this into an accountable action.');
  }

  const summary = risks.length
    ? `I logged ${tasks.length} action${tasks.length === 1 ? '' : 's'} and flagged ${risks.length} risk${risks.length === 1 ? '' : 's'} that needs attention.`
    : `I captured ${tasks.length} planning action${tasks.length === 1 ? '' : 's'} from this update.`;
  return { summary, eventUpdates, tasks, risks, suggestions };
}

async function askOpenAI(message, event, history) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PLANNING_SYSTEM_PROMPT },
        { role: 'system', content: `Current event: ${JSON.stringify({ name: event.name, type: event.type, guestCount: event.guestCount, startDate: event.startDate, requirements: event.requirements })}` },
        ...history.slice(-6).map((entry) => ({ role: entry.role, content: entry.content })),
        { role: 'user', content: message }
      ]
    })
  });
  if (!response.ok) throw new Error(`AI provider error (${response.status})`);
  const body = await response.json();
  return JSON.parse(body.choices?.[0]?.message?.content || '{}');
}

export async function extractPlan(message, event, history = []) {
  if (!process.env.OPENAI_API_KEY) return { ...buildFallbackPlan(message, event), provider: 'local' };
  try {
    const plan = await askOpenAI(message, event, history);
    return { ...plan, provider: 'openai' };
  } catch (error) {
    console.warn('AI extraction failed; using local planner:', error.message);
    return { ...buildFallbackPlan(message, event), provider: 'local' };
  }
}
