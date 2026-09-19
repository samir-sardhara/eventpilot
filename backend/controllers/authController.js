import User from '../models/UserModel.js';
import { issueToken } from '../utils/token.js';

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required.' });
    const user = await User.create({ name, email, password });
    return res.status(201).json({ token: issueToken(user), user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) { return next(error); }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+password');
    if (!user || !(await user.matchesPassword(password || ''))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    return res.json({ token: issueToken(user), user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) { return next(error); }
}

export function profile(req, res) {
  return res.json({ user: req.user });
}
