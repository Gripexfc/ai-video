/**
 * 积分路由
 * GET  /credits/balance        余额
 * GET  /credits/transactions   流水
 * GET  /credits/products       充值商品
 * POST /credits/topup          充值下单
 * GET  /credits/order/:no      订单状态（轮询）
 * POST /credits/payment/notify 支付回调（彩虹易支付）
 */
const express = require('express');
const { getDb } = require('../db/index.js');
const { getBalance, getTransactions } = require('../services/creditsService.js');
const { createPaymentOrder, handleCallback, getOrderStatus, getProducts } = require('../services/paymentService.js');
const { authMiddleware } = require('../middleware/authMiddleware.js');

function createCreditsRouter() {
  const r = express.Router();

  // 余额
  r.get('/balance', authMiddleware, (req, res) => {
    try {
      const db = getDb();
      const balance = getBalance(db, req.user.uid);
      res.json({ success: true, data: balance });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 流水
  r.get('/transactions', authMiddleware, (req, res) => {
    try {
      const db = getDb();
      const { page, pageSize, type } = req.query;
      const result = getTransactions(db, req.user.uid, { page: +page || 1, pageSize: +pageSize || 20, type });
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 充值商品
  r.get('/products', (_req, res) => {
    try {
      const db = getDb();
      const products = getProducts(db);
      res.json({ success: true, data: products });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 充值下单
  r.post('/topup', authMiddleware, (req, res) => {
    try {
      const db = getDb();
      const { productId } = req.body;
      if (!productId) return res.status(400).json({ success: false, error: '请选择充值商品' });
      const result = createPaymentOrder(db, req.user.uid, productId);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 订单状态（轮询）
  r.get('/order/:orderNo', authMiddleware, (req, res) => {
    try {
      const db = getDb();
      const order = getOrderStatus(db, req.params.orderNo, req.user.uid);
      if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
      res.json({ success: true, data: order });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 支付回调（彩虹易支付 GET 回调）
  r.get('/payment/notify', (req, res) => {
    try {
      const db = getDb();
      const result = handleCallback(db, req.query);
      if (result.success) {
        res.send('success');
      } else {
        res.send('fail');
      }
    } catch (err) {
      res.send('fail');
    }
  });

  // 支付回调（POST 回调，部分配置用 POST）
  r.post('/payment/notify', express.urlencoded({ extended: true }), (req, res) => {
    try {
      const db = getDb();
      const result = handleCallback(db, req.body);
      if (result.success) {
        res.send('success');
      } else {
        res.send('fail');
      }
    } catch (err) {
      res.send('fail');
    }
  });

  return r;
}

module.exports = { createCreditsRouter };
