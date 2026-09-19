import Event from '../models/EventModel.js';
import Task from '../models/TaskModel.js';
import { refreshRisks } from '../services/riskService.js';

const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

export async function getDashboard(req, res, next) {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, owner: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    await refreshRisks(event);
    const tasks = await Task.find({ event: event._id });
    const openTasks = tasks.filter((task) => task.status !== 'done');
    const now = new Date();
    const dueSoonEnd = new Date(now.getTime() + 7 * 86400000);
    const dueSoon = openTasks.filter((task) => task.dueDate && task.dueDate <= dueSoonEnd).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const activeRisks = event.risks.filter((risk) => risk.status !== 'resolved').sort((a, b) => {
      const score = { critical: 0, high: 1, medium: 2, low: 3 };
      return score[a.severity] - score[b.severity];
    });
    const attention = openTasks
      .filter((task) => task.status === 'blocked' || task.priority === 'urgent' || (task.dueDate && task.dueDate < now))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return res.json({
      event,
      metrics: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((task) => task.status === 'done').length,
        blockedTasks: tasks.filter((task) => task.status === 'blocked').length,
        openRisks: activeRisks.length,
        criticalRisks: activeRisks.filter((risk) => risk.severity === 'critical').length,
        budgetUsedPercent: event.budget?.planned ? Math.round((event.budget.committed / event.budget.planned) * 100) : 0
      },
      tasks: tasks.sort((a, b) => (a.dueDate || Infinity) - (b.dueDate || Infinity)),
      dueSoon,
      attention,
      risks: activeRisks,
      milestones: event.milestones.sort((a, b) => new Date(a.date) - new Date(b.date))
    });
  } catch (error) { return next(error); }
}
