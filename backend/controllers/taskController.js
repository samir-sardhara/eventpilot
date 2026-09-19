import Event from '../models/EventModel.js';
import Task from '../models/TaskModel.js';

async function getOwnedEvent(eventId, userId) {
  return Event.findOne({ _id: eventId, owner: userId });
}

export async function listTasks(req, res, next) {
  try {
    const event = await getOwnedEvent(req.params.eventId, req.user.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const query = { event: event._id };
    if (req.query.status) query.status = req.query.status;
    const tasks = await Task.find(query).sort({ dueDate: 1, priority: 1, createdAt: -1 });
    return res.json({ tasks });
  } catch (error) { return next(error); }
}

export async function createTask(req, res, next) {
  try {
    const event = await getOwnedEvent(req.params.eventId, req.user.id);
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    const task = await Task.create({ ...req.body, event: event._id, source: 'manual' });
    return res.status(201).json({ task });
  } catch (error) { return next(error); }
}

export async function updateTask(req, res, next) {
  try {
    const existingTask = await Task.findById(req.params.taskId);
    if (!existingTask || !(await getOwnedEvent(existingTask.event, req.user.id))) return res.status(404).json({ message: 'Task not found.' });
    const allowedFields = ['title', 'category', 'assignee', 'dueDate', 'priority', 'status', 'dependency'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
    const task = await Task.findByIdAndUpdate(existingTask._id, updates, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    return res.json({ task });
  } catch (error) { return next(error); }
}

export async function deleteTask(req, res, next) {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task || !(await getOwnedEvent(task.event, req.user.id))) return res.status(404).json({ message: 'Task not found.' });
    await task.deleteOne();
    return res.status(204).send();
  } catch (error) { return next(error); }
}
