import mongoose from 'mongoose';

const riskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['open', 'monitoring', 'resolved'], default: 'open' },
    owner: String,
    action: String
  },
  { _id: true, timestamps: true }
);

const milestoneSchema = new mongoose.Schema(
  {
    title: String,
    date: Date,
    status: { type: String, enum: ['upcoming', 'complete', 'at-risk'], default: 'upcoming' }
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, default: 'Event' },
    status: { type: String, enum: ['planning', 'confirmed', 'live', 'completed'], default: 'planning' },
    startDate: Date,
    endDate: Date,
    guestCount: { type: Number, default: 0 },
    city: String,
    budget: { planned: { type: Number, default: 0 }, committed: { type: Number, default: 0 } },
    categories: [{ type: String }],
    requirements: [{ type: String }],
    notes: [{ text: String, createdAt: { type: Date, default: Date.now } }],
    risks: [riskSchema],
    milestones: [milestoneSchema]
  },
  { timestamps: true }
);

export default mongoose.model('Event', eventSchema);
