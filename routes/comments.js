const express = require("express");
const router = express.Router({ mergeParams: true });
const {
    validateComment,
    isLoggedIn,
    isCommentAuthor,
} = require("../middleware");
const Project = require("../models/project");
const Comment = require("../models/comment");
const comments = require("../controllers/comments");
const { commentSchema } = require("../schemas.js");

const catchAsync = require("../utils/catchAsync");
const ExpressError = require("../utils/ExpressError");

router.post(
    "/",
    isLoggedIn,
    validateComment,
    catchAsync(comments.createComment)
);

router.delete(
    "/:commentId",
    isLoggedIn,
    isCommentAuthor,
    catchAsync(comments.deleteComment)
);

module.exports = router;
