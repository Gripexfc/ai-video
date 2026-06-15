/**
 * 后台管理路由（/api/v1/admin/*）
 * 全部需要 adminAuthMiddleware
 */
const express = require('express');
const { getDb } = require('../db/index.js');
const { adminLogin, createDefaultAdmin, listUsers, banUser, unbanUser, resetUserPassword } = require('../services/userService.js');
const { adminAddCredits, getAllCreditPrices, updateCreditPrice, getTransactions } = require('../services/creditsService.js');
const { manualConfirm } = require('../services/paymentService.js');
const { adminAuthMiddleware } = require('../middleware/authMiddleware.js');
const { validateProduct, validateSettings, validateAnnouncement, validateAddCredits, validateRelayTest } = require('../middleware/validateAdmin.js');
const {
  getDashboardStats,
  getRelayConfig, updateRelayConfig,
  getProducts, createProduct, updateProduct, deleteProduct,
  getSettings, updateSettings,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getOrders,
} = require('../services/adminService.js');

function createAdminRouter() {
  const r = express.Router();

  // ── 管理员登录（不需要 adminAuth） ──
  r.post('/login', (req, res) => {
    try {
      const db = getDb();
      createDefaultAdmin(db);
      const result = adminLogin(db, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ── 以下所有路由需要管理员权限 ──
  r.use(adminAuthMiddleware);

  // ── 仪表盘 ──
  r.get('/dashboard', (req, res) => {
    try {
      const db = getDb();
      const data = getDashboardStats(db);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 用户管理 ──
  r.get('/users', (req, res) => {
    try {
      const db = getDb();
      const { page, pageSize, keyword, status } = req.query;
      const result = listUsers(db, { page: +page || 1, pageSize: +pageSize || 20, keyword, status });
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  r.post('/users/:id/ban', (req, res) => {
    try {
      const db = getDb();
      banUser(db, +req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  r.post('/users/:id/unban', (req, res) => {
    try {
      const db = getDb();
      unbanUser(db, +req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  r.post('/users/:id/add-credits', validateAddCredits, (req, res) => {
    try {
      const db = getDb();
      const { amount, description } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ success: false, error: '积分数无效' });

      const result = adminAddCredits(db, +req.params.id, +amount, description, req.admin.id);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  r.post('/users/:id/reset-password', (req, res) => {
    try {
      const db = getDb();
      const { newPassword } = req.body;
      resetUserPassword(db, +req.params.id, newPassword);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  r.get('/users/:id/transactions', (req, res) => {
    try {
      const db = getDb();
      const { page, pageSize } = req.query;
      const result = getTransactions(db, +req.params.id, { page: +page || 1, pageSize: +pageSize || 50 });
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 中转站配置 ──
  r.get('/relay-config', (_req, res) => {
    try {
      const db = getDb();
      const config = getRelayConfig(db);
      res.json({ success: true, data: config });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  r.put('/relay-config', validateSettings, (req, res) => {
    try {
      const db = getDb();
      updateRelayConfig(db, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 中转站连通测试
  r.post('/relay-test', validateRelayTest, async (req, res) => {
    try {
      const { url, key, model, protocol } = req.body;
      if (!url || !key) return res.status(400).json({ success: false, error: '缺少 url 或 key' });

      // 简单测试：发一个最小请求看是否返回有效响应
      const axios = require('axios');
      const testUrl = url.replace(/\/+$/, '') + '/v1/chat/completions';
      try {
        await axios.post(testUrl, {
          model: model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }, {
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        });
        res.json({ success: true, message: '连接成功' });
      } catch (err) {
        const msg = err.response?.data?.error?.message || err.message;
        // 401 = key 错误，其他错误可能只是模型不对，也算部分成功
        if (err.response?.status === 401) {
          res.json({ success: false, message: `认证失败: ${msg}` });
        } else if (err.response?.status === 400 || err.response?.status === 404) {
          res.json({ success: true, message: `连接正常（模型可能需调整）: ${msg}` });
        } else {
          res.json({ success: false, message: `连接失败: ${msg}` });
        }
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 积分价格配置 ──
  r.get('/credit-prices', (_req, res) => {
    try {
      const db = getDb();
      const prices = getAllCreditPrices(db);
      res.json({ success: true, data: prices });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  r.put('/credit-prices', (req, res) => {
    try {
      const db = getDb();
      const updates = req.body; // { credit_text_gen: 2, credit_image_gen: 3, ... }
      for (const [key, value] of Object.entries(updates)) {
        if (key.startsWith('credit_')) {
          updateCreditPrice(db, key, value);
        }
      }
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ── 充值商品管理 ──
  r.get('/products', (_req, res) => {
    try {
      const db = getDb();
      const products = getProducts(db);
      res.json({ success: true, data: products });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  r.post('/products', validateProduct, (req, res) => {
    try {
      const db = getDb();
      createProduct(db, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  r.put('/products/:id', validateProduct, (req, res) => {
    try {
      const db = getDb();
      updateProduct(db, req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  r.delete('/products/:id', (req, res) => {
    try {
      const db = getDb();
      deleteProduct(db, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ── 订单管理 ──
  r.get('/orders', (req, res) => {
    try {
      const db = getDb();
      const data = getOrders(db, req.query);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  r.post('/orders/:orderNo/confirm', (req, res) => {
    try {
      const db = getDb();
      manualConfirm(db, req.params.orderNo, req.admin.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ── 系统设置 ──
  r.get('/settings', (_req, res) => {
    try {
      const db = getDb();
      const settings = getSettings(db);
      res.json({ success: true, data: settings });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  r.put('/settings', validateSettings, (req, res) => {
    try {
      const db = getDb();
      updateSettings(db, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ── 公告管理 ──
  r.get('/announcements', (_req, res) => {
    try {
      const db = getDb();
      const list = getAnnouncements(db);
      res.json({ success: true, data: list });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  r.post('/announcements', validateAnnouncement, (req, res) => {
    try {
      const db = getDb();
      createAnnouncement(db, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  r.put('/announcements/:id', validateAnnouncement, (req, res) => {
    try {
      const db = getDb();
      updateAnnouncement(db, req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  r.delete('/announcements/:id', (req, res) => {
    try {
      const db = getDb();
      deleteAnnouncement(db, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return r;
}

module.exports = { createAdminRouter };
