import Event from '../models/EventModel.js';
import Task from '../models/TaskModel.js';
import { refreshRisks } from '../services/riskService.js';

function ownerFilter(req) { return { owner: req.user.id }; }

export async function listEvents(req, res, next) {
  try { return res.json({ events: await Event.find(ownerFilter(req)).sort({ updatedAt: -1 }) }); } catch (error) { return next(error); }
}

export async function getEvent(req, res, next) {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, ...ownerFilter(req) });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    await refreshRisks(event);
    return res.json({ event });
  } catch (error) { return next(error); }
}

export async function createEvent(req, res, next) {
  try {
    const event = await Event.create({ ...req.body, owner: req.user.id });
    return res.status(201).json({ event });
  } catch (error) { return next(error); }
}

export async function updateEvent(req, res, next) {
  try {
    const allowedFields = ['name', 'type', 'status', 'startDate', 'endDate', 'guestCount', 'city', 'budget', 'categories', 'requirements', 'milestones'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
    const event = await Event.findOneAndUpdate({ _id: req.params.eventId, ...ownerFilter(req) }, updates, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    return res.json({ event });
  } catch (error) { return next(error); }
}

export async function createDemoEvent(req, res, next) {
  try {
    const scenario = req.body?.scenario === 'corporate' ? 'corporate' : 'wedding';
    const demoName = scenario === 'corporate' ? 'Vertex Team Offsite 2026' : 'Mehra Wedding 2026';
    let event = await Event.findOne({ ...ownerFilter(req), name: demoName });
    if (event) return res.json({ event, created: false });
    const startDate = new Date(); startDate.setDate(startDate.getDate() + 35); startDate.setHours(10, 0, 0, 0);
    const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 2);
    if (scenario === 'corporate') {
      endDate.setDate(startDate.getDate() + 1);
      event = await Event.create({
        owner: req.user.id, name: demoName, type: 'Corporate outing', status: 'planning', city: 'Lonavala', guestCount: 200,
        startDate, endDate, budget: { planned: 3000000, committed: 1200000 },
        requirements: ['Transportation', 'Accommodation', 'Food', 'Team-building activities', 'Entertainment', 'Event branding'],
        milestones: [
          { title: 'Team-building activities finalised', date: new Date(Date.now() + 7 * 86400000), status: 'upcoming' },
          { title: 'Day one — Team outing', date: startDate, status: 'upcoming' },
          { title: 'Day two — Leadership session', date: endDate, status: 'upcoming' }
        ]
      });
      await Task.insertMany([
        { event: event._id, title: 'Confirm resort for 200 employees', category: 'Accommodation', assignee: 'Aarav', priority: 'high', status: 'done', source: 'seed' },
        { event: event._id, title: 'Finalise team-building activities', category: 'Programming', assignee: 'Maya', priority: 'high', status: 'todo', dueDate: new Date(Date.now() + 7 * 86400000), source: 'seed' },
        { event: event._id, title: 'Arrange travel plan for 40 outstation employees', category: 'Transportation', assignee: 'Priya', priority: 'high', status: 'in-progress', source: 'seed' },
        { event: event._id, title: 'Confirm food and entertainment', category: 'Programming', assignee: 'Kabir', priority: 'medium', status: 'todo', source: 'seed' },
        { event: event._id, title: 'Complete event branding', category: 'Branding', assignee: 'Maya', priority: 'medium', status: 'todo', source: 'seed' }
      ]);
      return res.status(201).json({ event, created: true });
    }
    event = await Event.create({
      owner: req.user.id, name: 'Mehra Wedding 2026', type: 'Wedding', status: 'planning', city: 'Jaipur', guestCount: 400,
      startDate, endDate, budget: { planned: 8500000, committed: 4670000 },
      requirements: ['Venue', 'Catering', 'Décor', 'Photography', 'Entertainment', 'Guest accommodation', 'Transportation', 'Invitations'],
      milestones: [
        { title: 'Guest count freeze', date: new Date(startDate.getTime() - 7 * 86400000), status: 'upcoming' },
        { title: 'Sangeet', date: startDate, status: 'upcoming' },
        { title: 'Wedding ceremony', date: new Date(startDate.getTime() + 86400000), status: 'upcoming' },
        { title: 'Reception', date: endDate, status: 'upcoming' }
      ],
      risks: [{ title: 'Reception photography coverage', description: 'The photographer is unavailable for the Reception.', severity: 'critical', status: 'open', action: 'Secure a replacement photographer for the reception.' }]
    });
    const guestCountDate = new Date(startDate); guestCountDate.setDate(guestCountDate.getDate() - 7);
    await Task.insertMany([
      { event: event._id, title: 'Confirm Sangeet venue', category: 'Venue', assignee: 'Aarav', priority: 'high', status: 'done', source: 'seed' },
      { event: event._id, title: 'Confirm décor vendor', category: 'Décor', assignee: 'Maya', priority: 'high', status: 'in-progress', dueDate: new Date(Date.now() + 2 * 86400000), source: 'seed' },
      { event: event._id, title: 'Source Reception photographer', category: 'Photography', assignee: 'Aarav', priority: 'urgent', status: 'blocked', dueDate: new Date(Date.now() + 86400000), source: 'seed' },
      { event: event._id, title: 'Collect rooming list for 150 outstation guests', category: 'Accommodation', assignee: 'Priya', priority: 'high', status: 'in-progress', dueDate: new Date(Date.now() + 4 * 86400000), source: 'seed' },
      { event: event._id, title: 'Send final guest count to catering', category: 'Catering', assignee: 'Priya', priority: 'high', status: 'todo', dueDate: guestCountDate, dependency: 'Guest RSVP reconciliation', source: 'seed' },
      { event: event._id, title: 'Confirm airport transfer manifests', category: 'Transportation', assignee: 'Kabir', priority: 'medium', status: 'todo', source: 'seed' }
    ]);
    return res.status(201).json({ event, created: true });
  } catch (error) { return next(error); }
}
