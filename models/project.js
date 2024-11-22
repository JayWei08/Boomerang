const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Schema for image thumbnails
const ImageSchema = new Schema({
    url: String,
    filename: String,
});

ImageSchema.virtual("thumbnail").get(function () {
    return this.url.replace("/upload", "/upload/w_200");
});

const opts = { toJSON: { virtuals: true } };
const ProjectSchema = new Schema(
    {
        title: {
            type: Map,
            of: String,
            required: function () {
                return !this.get("isDraft"); // Use this.get() for safe access
            },
        },
        titleText: {
            type: String,
        },
        images: [ImageSchema],
        geometry: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
                required: function () {
                    return !this.get("isDraft");
                },
            },
            coordinates: {
                type: [Number],
                default: [-113.1331, 47.0202],
                required: function () {
                    return !this.get("isDraft");
                },
            },
        },
        description: {
            type: Map,
            of: String,
            required: function () {
                return !this.get("isDraft");
            },
        },
        descriptionText: {
            type: String
        },
        currency: {
            type: String,
            required: function () {
                return !this.get("isDraft");
            },
        },
        fundingGoal: {
            type: Number,
            required: function () {
                return !this.get("isDraft");
            },
        },
        location: {
            type: String,
            required: function () {
                return !this.get("isDraft");
            },
        },
        deadline: {
            type: Date,
            required: function () {
                return !this.get("isDraft");
            },
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        author: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: ["active", "successful", "failed", "canceled"],
            default: "active",
        },
        comments: [
            {
                type: Schema.Types.ObjectId,
                ref: "Comment",
            },
        ],
        keywords: [
            {
                type: String,
            },
        ],
        relevanceScore: { type: Number },
        isDraft: { type: Boolean, default: true },
        lastSavedAt: { type: Date, default: Date.now },
    },
    opts
);

// Text index for enabling full-text search
ProjectSchema.index({ title: "text", description: "text", location: "text" });

// Virtual property for map popups
ProjectSchema.virtual("properties.popUpMarkup").get(function () {
    return `<strong><a href="/projects/${this._id}">${this.title}</a></strong>`;
});

// Middleware to delete associated comments when a project is deleted
ProjectSchema.post("findOneAndDelete", async function (doc) {
    if (doc) {
        await mongoose.model("Comment").deleteMany({
            _id: {
                $in: doc.comments,
            },
        });
    }
});

module.exports = mongoose.model("Project", ProjectSchema);
