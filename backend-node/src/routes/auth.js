/**
 * 用户认证路由
 * POST /auth/register   注册
 * POST /auth/login      登录
 * GET  /auth/profile    个人信息（需鉴权）
 * PUT  /auth/password   修改密码（需鉴权）
 */
const express = require('express');
const { getDb } = require('../db/index.js');
const { register, login, getProfile, changePassword } = require('../services/userService.js');
const { authMiddleware } = require('../middleware/authMiddleware.js');

function createAuthRouter() {
  const r = express.Router();

  // 注册
  r.post('/register', (req, res) => {
    try {
      const db = getDb();
      const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
      const result = register(db, req.body, ip);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 登录
  r.post('/login', (req, res) => {
    try {
      const db = getDb();
      const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
      const result = login(db, req.body, ip);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 个人信息
  r.get('/profile', authMiddleware, (req, res) => {
    try {
      const db = getDb();
      const profile = getProfile(db, req.user.uid);
      if (!profile) return res.status(404).json({ success: false, error: '用户不存在' });
      res.json({ success: true, data: profile });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 修改密码
  r.put('/password', authMiddleware, (req, res) => {
    try {
      const db = getDb();
      const { oldPassword, newPassword } = req.body;
      changePassword(db, req.user.uid, oldPassword, newPassword);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return r;
}

module.exports = { createAuthRouter };
