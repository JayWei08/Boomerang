const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    keywords: {
        type: Map,
        of: Number,
    },
    savedProjects: [{ type: Schema.Types.ObjectId, ref: "Project" }],

    language: { type: String, default: 'en' },
    currency: {type: String, default: "USD"},
    cookies: {type: Boolean, default: false}
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);
