// routes/search.js
const express = require("express");
const router = express.Router();
const { searchProjects } = require("../controllers/searchController");

router.get("/search", searchProjects);

module.exports = router;
