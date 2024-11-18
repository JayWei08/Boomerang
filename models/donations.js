const mongoose = require("mongoose");
const Comment = require("./comment");
const Schema = mongoose.Schema;

const DonationSchema = new Schema({
    amount: Number,
    donor: { type: Schema.Types.ObjectId, ref: "User" },
    recipient: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "pending" }, // pending, completed, failed
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Donation", DonationSchema);
