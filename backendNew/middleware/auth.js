const { User } = require('../models');

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
};

const tokenRequired = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await User.findOne({ where: { current_token: token } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.currentUser = user;
  next();
};

const adminRequired = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await User.findOne({ where: { current_token: token, is_admin: true } });
  if (!user) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.currentUser = user;
  next();
};

module.exports = {
  tokenRequired,
  adminRequired
};
