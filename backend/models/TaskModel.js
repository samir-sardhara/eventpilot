import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, default: 'General' },
    assignee: { type: String, default: 'Unassigned' },
    dueDate: Date,
    priority: { type: String, enum: ['urgent', 'high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['todo', 'in-progress', 'blocked', 'done'], default: 'todo' },
    dependency: String,
    source: { type: String, enum: ['ai', 'manual', 'seed'], default: 'manual' }
  },
  { timestamps: true }
);

taskSchema.index({ event: 1, title: 1 }, { unique: true });

export default mongoose.model('Task', taskSchema);
