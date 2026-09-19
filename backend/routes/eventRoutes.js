import { Router } from 'express';
import { createDemoEvent, createEvent, getEvent, listEvents, updateEvent } from '../controllers/eventController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.post('/demo', createDemoEvent);
router.route('/').get(listEvents).post(createEvent);
router.route('/:eventId').get(getEvent).patch(updateEvent);
export default router;
