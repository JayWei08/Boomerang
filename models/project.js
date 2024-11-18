const mongoose = require("mongoose");
const Comment = require("./comment");
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

// Main schema for projects
const ProjectSchema = new Schema(
    {
        title: { type: String, required: true }, // Ensure title is required
        images: [ImageSchema],
        geometry: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point", // Default to "Point"
                required: true,
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [-113.1331, 47.0202], // Default coordinates
                required: true,
            },
        },
        description: { type: String, required: true }, // Ensure description is required
        fundingGoal: { type: Number, required: true }, // Ensure fundingGoal is required
        location: { type: String, required: true }, // Ensure location is required
        deadline: { type: Date, required: true }, // Deadline for funding
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        author: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true, // Ensure author is required
        },
        status: {
            type: String,
            enum: ["active", "successful", "failed", "canceled"],
            default: "active", // Default to active status
        },
        comments: [
            {
                type: Schema.Types.ObjectId,
                ref: "Comment",
            },
        ],
        kewords: [
            {
                type: String,
            },
        ],
        relevanceScore: { type: Number },
    },
    opts
);

// Add text index for title and description to enable full-text search
ProjectSchema.index({ title: "text", description: "text", location: "text" });

ProjectSchema.virtual("properties.popUpMarkup").get(function () {
    return `<strong><a href="/projects/${this._id}">${this.title}</a></strong>`;
});

// Middleware to delete associated comments when a project is deleted
ProjectSchema.post("findOneAndDelete", async function (doc) {
    if (doc) {
        await Comment.deleteMany({
            _id: {
                $in: doc.comments,
            },
        });
    }
});

// Model export
module.exports = mongoose.model("Project", ProjectSchema);
