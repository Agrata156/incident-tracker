// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  console.error(JSON.stringify({ level: 'error', msg: err.message, path: req.path }));
  return res.status(500).json({ error: 'internal server error' });
}

module.exports = { errorHandler };