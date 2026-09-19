import { Router } from 'express';
import { getConversation, processMessage } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.use(protect);
router.get('/event/:eventId', getConversation);
router.post('/', processMessage);
export default router;
