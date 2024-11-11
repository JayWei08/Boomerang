const Project = require("../models/project");
const Comment = require("../models/comment");

module.exports.createComment = async (req, res) => {
    const project = await Project.findById(req.params.id);
    const comment = new Comment(req.body.comment);
    comment.author = req.user._id;
    project.comments.push(comment);
    await comment.save();
    await project.save();
    req.flash("success", "Created new comment!");
    res.redirect(`/projects/${project._id}`);
};

module.exports.deleteComment = async (req, res) => {
    const { id, commentId } = req.params;
    await Project.findByIdAndUpdate(id, { $pull: { comments: commentId } });
    await Comment.findByIdAndDelete(commentId);
    req.flash("success", "Successfully deleted comment!");
    res.redirect(`/projects/${id}`);
};
