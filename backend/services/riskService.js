import Event from '../models/EventModel.js';
import Task from '../models/TaskModel.js';

function normalized(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/photographer|photography/g, 'photo');
}

function riskKey(risk) {
  const title = normalized(risk.title);
  if (title.includes('photo') && title.includes('reception')) return 'photo-reception-unavailable';
  if (title.startsWith('transportation shortfall')) return 'transportation-capacity-shortfall';
  return title;
}

function taskKey(task) {
  const title = normalized(task.title);
  if (title.includes('photo') && title.includes('reception')) return 'source-reception-photographer';
  if (title.includes('transportation') && (title.includes('shortfall') || title.includes('capacity'))) return 'resolve-transportation-capacity-shortfall';
  return null;
}

/** Removes only repeated AI/demo records for the same operational problem. */
export async function removeDuplicatePlanningItems(event) {
  const seenRisks = new Set();
  const deduplicatedRisks = event.risks.filter((risk) => {
    const key = riskKey(risk);
    if (seenRisks.has(key)) return false;
    seenRisks.add(key);
    return true;
  });
  const risksChanged = deduplicatedRisks.length !== event.risks.length;
  if (risksChanged) event.risks = deduplicatedRisks;

  const tasks = await Task.find({ event: event._id });
  const groups = new Map();
  tasks.forEach((task) => {
    const key = taskKey(task);
    if (!key) return;
    groups.set(key, [...(groups.get(key) || []), task]);
  });
  const duplicateIds = [];
  groups.forEach((group, key) => {
    if (group.length < 2) return;
    const canonicalTitle = key === 'source-reception-photographer'
      ? 'source reception photo'
      : 'resolve transportation capacity shortfall';
    const keeper = group.find((task) => normalized(task.title) === canonicalTitle)
      || group[group.length - 1];
    group.filter((task) => !task._id.equals(keeper._id)).forEach((task) => duplicateIds.push(task._id));
  });
  if (duplicateIds.length) await Task.deleteMany({ _id: { $in: duplicateIds } });
  if (risksChanged) await event.save();
}

export async function detectOperationalRisks(event) {
  const allTasks = await Task.find({ event: event._id });
  const tasks = allTasks.filter((task) => task.status !== 'done');
  const generated = [];
  const trackedCategories = new Set(allTasks.map((task) => task.category.toLowerCase()));
  const required = event.requirements || [];

  required.forEach((requirement) => {
    const normalized = requirement.toLowerCase();
    const hasWorkstream = [...trackedCategories].some((category) => category.includes(normalized) || normalized.includes(category));
    if (!hasWorkstream && !event.risks.some((risk) => risk.title.toLowerCase().includes(normalized) && risk.status !== 'resolved')) {
      generated.push({
        title: `${requirement} workstream has no active owner`,
        description: `No open task is tracking the ${requirement} requirement.`,
        severity: 'medium',
        status: 'open',
        action: `Create an owner-led task for ${requirement}.`
      });
    }
  });

  const overdue = tasks.filter((task) => task.dueDate && task.dueDate < new Date());
  overdue.forEach((task) => {
    if (!event.risks.some((risk) => risk.title === `Overdue: ${task.title}` && risk.status !== 'resolved')) {
      generated.push({ title: `Overdue: ${task.title}`, description: 'A required action is past its due date.', severity: 'high', status: 'open', action: 'Reassign, reschedule, or escalate this action.' });
    }
  });
  return generated;
}

export async function refreshRisks(event) {
  const additions = await detectOperationalRisks(event);
  if (additions.length) {
    event.risks.push(...additions);
  }
  await removeDuplicatePlanningItems(event);
  if (additions.length && event.isModified()) await event.save();
  return event.risks;
}
