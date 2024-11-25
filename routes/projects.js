const express = require("express");
const router = express.Router();
const projects = require("../controllers/projects");
const Project = require("../models/project");
const { isLoggedIn, isAuthor, validateProject } = require("../middleware");
const multer = require("multer");
const { storage } = require("../cloudinary");
const upload = multer({ storage });
const { getProjectsByCategory } = require("../controllers/projects");

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
        const language = req.session.language || "en"; // Default to 'en' if no language is set
        const projects = await Project.find({
            author: req.user._id,
            isDraft: false,
        });
        const drafts = await Project.find({
            author: req.user._id,
            isDraft: true,
        });
        res.render("projects/my-projects", { projects, drafts, language });
    } catch (error) {
        req.flash("error", "Unable to load your projects.");
        res.redirect("/projects");
    }
});

// Route to display projects by category
router.get("/category/:category", getProjectsByCategory);

router.post(
    "/save-draft",
    isLoggedIn,
    upload.array("image"), // Process file uploads
    (req, res, next) => {
        console.log("Uploaded Files in Route:", req.files); // Debug log
        console.log("Draft Data in Route:", req.body); // Debug log
        next();
    },
    catchAsync(projects.saveDraft)
);

// Delete a Draft
router.delete("/drafts/:id", isLoggedIn, catchAsync(projects.deleteDraft));

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

// Project Payment
router.post("/:id/initiate-payment", async (req, res) => {
    const { invoiceNo, amount, currencyCode } = req.body;

    try {
        const paymentResponse = await createPaymentToken(
            invoiceNo,
            amount,
            currencyCode
        );

        if (paymentResponse.respCode === "0000") {
            // Redirect user to the payment page
            res.redirect(paymentResponse.webPaymentUrl);
        } else {
            res.status(400).json({ error: paymentResponse.respDesc });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to initiate payment" });
    }
});

router.post("/:id/notify", async (req, res) => {
    try {
        const decodedPayload = jwt.verify(
            req.body.payload,
            process.env.secretKey
        );

        if (decodedPayload.respCode === "0000") {
            console.log("Payment successful:", decodedPayload);
            res.status(200).send("OK");
        } else {
            console.error("Payment failed:", decodedPayload);
            res.status(400).send("Failed");
        }
    } catch (error) {
        console.error("Error handling notification:", error.message);
        res.status(500).send("Error");
    }
});

module.exports = router;
