import Conversation from '../models/ConversationModel.js';
import Event from '../models/EventModel.js';
import Task from '../models/TaskModel.js';
import { extractPlan } from '../services/aiPlanningService.js';

function validStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function comparisonKey(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/photographer|photography/g, 'photo')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isSameOperationalRisk(existing, incoming) {
  const oldTitle = comparisonKey(existing.title);
  const newTitle = comparisonKey(incoming.title);
  if (oldTitle === newTitle) return true;
  if (newTitle.startsWith('transportation shortfall') && oldTitle.startsWith('transportation shortfall')) return true;
  return oldTitle.includes('photo') && oldTitle.includes('reception') && newTitle.includes('photo') && newTitle.includes('reception');
}

export async function getConversation(req, res, next) {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, owner: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const conversation = await Conversation.findOne({ event: event._id });
    return res.json({ messages: conversation?.messages || [] });
  } catch (error) { return next(error); }
}

export async function processMessage(req, res, next) {
  try {
    const { eventId, message } = req.body;
    if (!eventId || !message?.trim()) return res.status(400).json({ message: 'Event and message are required.' });
    const event = await Event.findOne({ _id: eventId, owner: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const conversation = await Conversation.findOneAndUpdate(
      { event: event._id },
      { $setOnInsert: { event: event._id } },
      { new: true, upsert: true }
    );
    const plan = await extractPlan(message.trim(), event, conversation.messages);
    const updates = plan.eventUpdates || {};
    if (Number.isFinite(updates.guestCount)) event.guestCount = updates.guestCount;
    if (['planning', 'confirmed', 'live', 'completed'].includes(updates.status)) event.status = updates.status;
    if (Array.isArray(updates.requirements)) {
      event.requirements = [...new Set([...(event.requirements || []), ...updates.requirements.map(String)])];
    }
    event.notes.push({ text: message.trim() });
    const parsedRisks = (plan.risks || []).map((risk) => ({
      title: String(risk.title || 'Planning risk'),
      description: String(risk.description || ''),
      severity: validStatus(risk.severity, ['critical', 'high', 'medium', 'low'], 'medium'),
      status: 'open', action: String(risk.action || 'Review and assign an owner.')
    }));
    const newRisks = [];
    parsedRisks.forEach((incoming) => {
      const existing = event.risks.find((risk) => risk.status !== 'resolved' && isSameOperationalRisk(risk, incoming));
      if (existing) Object.assign(existing, incoming);
      else newRisks.push(incoming);
    });
    event.risks.push(...newRisks);
    await event.save();

    const existingTasks = await Task.find({ event: event._id }).select('_id title');
    const taskWrites = (plan.tasks || []).filter((task) => task?.title).map((task) => {
      const title = String(task.title).trim();
      const matchedTask = existingTasks.find((existing) => comparisonKey(existing.title) === comparisonKey(title));
      return {
        updateOne: {
          filter: matchedTask ? { _id: matchedTask._id } : { event: event._id, title },
          update: {
            $set: {
              category: String(task.category || 'General'),
              priority: validStatus(task.priority, ['urgent', 'high', 'medium', 'low'], 'medium'),
              status: validStatus(task.status, ['todo', 'in-progress', 'blocked', 'done'], 'todo'),
              dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
              dependency: task.dependency ? String(task.dependency) : '',
              source: 'ai'
            },
            $setOnInsert: { event: event._id, title, assignee: 'Unassigned' }
          },
          upsert: !matchedTask
        }
      };
    });
    if (taskWrites.length) await Task.bulkWrite(taskWrites);

    const assistantMessage = {
      role: 'assistant', content: plan.summary || 'I captured this planning update.',
      metadata: { tasksCreated: taskWrites.length, risksCreated: newRisks.length, suggestions: plan.suggestions || [], provider: plan.provider }
    };
    conversation.messages.push({ role: 'user', content: message.trim() }, assistantMessage);
    await conversation.save();

    return res.status(201).json({
      reply: assistantMessage.content,
      changes: { tasksCreated: taskWrites.length, risksCreated: newRisks.length, suggestions: plan.suggestions || [] },
      event,
      provider: plan.provider
    });
  } catch (error) { return next(error); }
}
