import { Router } from 'express';
import { createTask, deleteTask, listTasks, updateTask } from '../controllers/taskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.route('/event/:eventId').get(listTasks).post(createTask);
router.route('/:taskId').patch(updateTask).delete(deleteTask);
export default router;
