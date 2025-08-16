const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

// Get system health status
router.get('/health', healthController.getHealth);

// Get detailed system status
router.get('/status', healthController.getSystemStatus);

// Simple ping endpoint
router.get('/ping', healthController.ping);

module.exports = router;