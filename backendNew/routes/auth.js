const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const { tokenRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.checkPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.current_token = token;
  await user.save();

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin
    },
    message: 'Login successful'
  });
});

router.get('/verify', async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ valid: false, error: 'No token provided' });
  }

  const user = await User.findOne({ where: { current_token: token } });
  if (!user) {
    return res.status(401).json({ valid: false, error: 'Invalid token' });
  }

  res.json({
    valid: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin
    }
  });
});

router.post('/logout', async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(400).json({ error: 'No token provided' });
  }
  const user = await User.findOne({ where: { current_token: token } });
  if (user) {
    user.current_token = null;
    await user.save();
  }
  res.json({ message: 'Logged out' });
});

router.post('/users/me/change-password', tokenRequired, async (req, res) => {
  const user = req.currentUser;
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password required' });
  }
  if (!user.checkPassword(current_password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  user.password_hash = await bcrypt.hash(new_password, 10);
  await user.save();
  res.json({ message: 'Password changed successfully' });
});

router.get('/users', adminRequired, async (req, res) => {
  const users = await User.findAll({ order: [['created_at', 'DESC']] });
  res.json({ users: users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    is_admin: u.is_admin,
    created_at: u.created_at ? u.created_at.toISOString() : null
  })) });
});

router.post('/users', adminRequired, async (req, res) => {
  const { email, password, name, is_admin = false } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email: normalizedEmail,
    password_hash,
    name: name.trim(),
    is_admin: Boolean(is_admin)
  });

  res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    is_admin: user.is_admin,
    message: 'User created successfully'
  });
});

router.delete('/users/:userId', adminRequired, async (req, res) => {
  const user = req.currentUser;
  const userId = Number(req.params.userId);
  if (userId === user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const target = await User.findByPk(userId);
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }
  await target.destroy();
  res.json({ message: 'User deleted successfully' });
});

module.exports = router;
