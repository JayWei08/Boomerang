const express = require('express');
const router = express.Router();
const currencyController = require('../controllers/currencyController'); // Adjust the path as needed

// POST route to handle language selection
router.post('/set-currency', currencyController.setCurrency);

module.exports = router;