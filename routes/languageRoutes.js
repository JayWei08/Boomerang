const express = require('express');
const router = express.Router();
const languageController = require('../controllers/languageController'); // Adjust the path as needed

// POST route to handle language selection
router.post('/language', languageController.setLanguage);

module.exports = router;