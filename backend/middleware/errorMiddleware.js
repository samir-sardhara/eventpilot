export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((item) => item.message).join(', ') });
  }
  if (err.code === 11000) return res.status(409).json({ message: 'That record already exists.' });
  return res.status(err.statusCode || 500).json({ message: err.message || 'Something went wrong.' });
}
