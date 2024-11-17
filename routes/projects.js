const express = require("express");
const router = express.Router();
const projects = require("../controllers/projects");
const Project = require("../models/project");
const { isLoggedIn, isAuthor, validateProject } = require("../middleware");
const multer = require("multer");
const { storage } = require("../cloudinary");
const upload = multer({ storage });

const catchAsync = require("../utils/catchAsync");

router
    .route("/")
    .get(catchAsync(projects.index))
    .post(
        isLoggedIn,
        upload.array("image"),
        validateProject,
        catchAsync(projects.createProject)
    );

// New Project Page
router.get("/new", isLoggedIn, projects.renderNewForm);

// Route to view "My Projects" page
router.get("/my-projects", isLoggedIn, async (req, res) => {
    try {
        const projects = await Project.find({ author: req.user._id });
        res.render("projects/my-projects", { projects });
    } catch (error) {
        req.flash("error", "Unable to load your projects.");
        res.redirect("/projects");
    }
});
router.get("/library", isLoggedIn, catchAsync(projects.viewLibrary));

router
    .route("/:id")
    .get(catchAsync(projects.showProject))
    .put(
        isLoggedIn,
        isAuthor,
        upload.array("image"),
        validateProject,
        catchAsync(projects.updateProject)
    )
    .delete(isLoggedIn, isAuthor, catchAsync(projects.deleteProject));

// Edit project form
router.get(
    "/:id/edit",
    isLoggedIn,
    isAuthor,
    catchAsync(projects.renderEditForm)
);

// routes/projects.js
router.post(
    "/:id/toggleSave",
    isLoggedIn,
    catchAsync(projects.toggleSaveProject)
);

module.exports = router;
