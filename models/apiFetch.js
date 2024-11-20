const mongoose = require("mongoose");

const apiFetchSchema = new mongoose.Schema({
    lastFetchTime: { type: Date, required: true },
    currencyData: { type: Object, required: true }, // Store the API data
});

module.exports = mongoose.model("ApiFetch", apiFetchSchema);

