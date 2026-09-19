import jwt from 'jsonwebtoken';

export function issueToken(user) {
  return jwt.sign({ id: user._id, email: user.email, name: user.name }, process.env.JWT_SECRET || 'development-secret-change-me', {
    expiresIn: '7d'
  });
}
