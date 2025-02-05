const express = require('express');
const router = express.Router();
const cookiesController = require('../controllers/cookies.js'); // Adjust the path as needed

// POST route to handle language selection
router.post('/set-cookies', cookiesController.setCookies);

module.exports = router;