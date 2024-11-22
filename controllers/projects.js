const Project = require("../models/project");
const Users = require("../models/user");
const ApiFetch = require("../models/apiFetch");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const { cloudinary } = require("../cloudinary");
const Multiset = require("../utils/Multiset");
const currencyToken = process.env.CURRENCY_TOKEN;

module.exports.index = async (req, res) => {
    const language = req.language;
    const user = await get_user(Users, req);

    const projects = await Project.find({});
    const filteredProjects = projects.map(project => ({
        titleText: project.title.get(req.language),
        descriptionText: project.description.get(req.language)
    }));

    // let projects = await Project.aggregate([{
    //     $project: {
    //         title: { $getField: language },
    //         description: { $getField: language },
    //     },
    // },]);

    if (user && user.keywords instanceof Map) {
        const keywords = user.keywords;
        projects.forEach((project) => {
            const projectKeywords = Array.isArray(project.keywords)
                ? project.keywords
                : [];
            project.relevanceScore = calculateRelevance(
                projectKeywords,
                keywords
            );
        });

        projects.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    res.render("projects/index", { projects });
};

module.exports.renderNewForm = async (req, res) => {
    const { draftId } = req.query; // Check if a draft ID is provided
    let draft = null;

    if (draftId) {
        draft = await Project.findById(draftId); // Load the draft data
        if (!draft) {
            req.flash("error", "Draft not found.");
            return res.redirect("/projects/drafts");
        }
    }

    res.render("projects/new", { draft }); // Pass draft data to the form
};

module.exports.createProject = async (req, res, next) => {
    try {
        const { draftId } = req.body; // Retrieve draftId
        let project;

        if (draftId) {
            project = await Project.findById(draftId);
            if (!project) {
                req.flash("error", "Draft not found.");
                return res.redirect("/projects/drafts");
            }

            project.set({
                ...req.body.project,
                isDraft: false,
                updatedAt: Date.now(),
            });

            const geoData = await geocoder
                .forwardGeocode({ query: req.body.project.location, limit: 1 })
                .send();
            project.geometry = geoData.body.features[0].geometry;

            const imgs = req.files.map((f) => ({
                url: f.path,
                filename: f.filename,
            }));
            project.images.push(...imgs);
        } else {
            const geoData = await geocoder
                .forwardGeocode({ query: req.body.project.location, limit: 1 })
                .send();
            project = new Project({
                ...req.body.project,
                geometry: geoData.body.features[0].geometry,
                images: req.files.map((f) => ({
                    url: f.path,
                    filename: f.filename,
                })),
                author: req.user._id,
            });
        }

        await project.save();
        req.flash(
            "success",
            draftId
                ? "Draft successfully published!"
                : "Successfully created a new project!"
        );
        return res.redirect(`/projects/${project._id}`);
    } catch (error) {
        console.error("Error in createProject:", error.message);
        req.flash("error", "Failed to create or update the project.");
        res.redirect("/projects/new");
    }
};

module.exports.showProject = async (req, res) => {
    try {
        // Find the project
        const project = await Project.findById(req.params.id)
            .populate({
                path: "comments",
                populate: { path: "author" },
            })
            .populate("author");

        const language = req.language;
        project.titleText = project.title.get(language) || project.title.get('th');
        project.description = project.description.get(language) || project.description.get('th');

        if (!project) {
            req.flash("error", "Cannot find that project!");
            return res.redirect("/projects");
        }

        // Check the database for the last fetch time
        let apiFetch = await ApiFetch.findOne();
        const now = Date.now();
        const oneHour = 1000 * 60 * 60; // 1 hour in milliseconds

        let currencyData;

        if (
            !apiFetch ||
            now - new Date(apiFetch.lastFetchTime).getTime() > oneHour
        ) {
            // console.log("Fetching fresh currency data...");
            const response = await fetch(
                "https://api.freecurrencyapi.com/v1/latest?apikey=fca_live_cm1tAAJNfEOsxaq2vaGu0SI5uBAT8rBSgNSlHbTJ"
            );
            const freshData = await response.json();

            if (!apiFetch) {
                // Create a new document if none exists
                apiFetch = new ApiFetch({
                    lastFetchTime: new Date(),
                    currencyData: freshData,
                });
            } else {
                // Update the existing document
                apiFetch.lastFetchTime = new Date();
                apiFetch.currencyData = freshData;
            }

            await apiFetch.save(); // Save the updated or new document
            currencyData = freshData;
        } else {
            // console.log("Using cached currency data from MongoDB.");
            currencyData = apiFetch.currencyData;
        }

        if (req.user) {
            // Use the logged-in user's currency
            const user = await Users.findById(req.user._id);
            userCurrency = user.currency; // Default to USD if user's currency is missing
        } else {
            // Use session's currency if no user is logged in
            userCurrency = req.session.currency; // Default to USD if session currency is missing
        }

        // Render the project details with project and user currency data
        res.render("projects/show", { project, currencyData, userCurrency });

        add_user_keywords(req, project, Users);
    } catch (error) {
        console.error("Error in showProject:", error);
        req.flash("error", "Something went wrong!");
        res.redirect("/projects");
    }
};

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const { fromDrafts } = req.query;
    const project = await Project.findById(id);
    if (!project) {
        req.flash("error", "Cannot find that project!");
        return res.redirect("/projects/drafts");
    }

    // Provide default values for drafts if necessary
    if (!project.deadline) {
        project.deadline = new Date(); // Default to today's date (optional)
    }

    res.render("projects/edit", { project, fromDrafts });
};

module.exports.updateProject = async (req, res) => {
    const { id } = req.params;
    const { fromDrafts } = req.query; // Check if the user came from drafts
    const project = await Project.findByIdAndUpdate(id, {
        ...req.body.project,
        updatedAt: Date.now(),
    });

    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await project.updateOne({
            $pull: { images: { filename: { $in: req.body.deleteImages } } },
        });
    }

    req.flash("success", "Successfully updated project!");

    // Redirect back to drafts if user came from drafts
    if (fromDrafts) {
        return res.redirect("/projects/drafts");
    }

    res.redirect(`/projects/${project._id}`);
};

module.exports.deleteProject = async (req, res) => {
    const { id } = req.params;
    await Project.findByIdAndDelete(id);
    req.flash("success", "Successfully deleted project!");
    res.redirect("/projects");
};

// Save Project Controller
// controllers/projects.js
module.exports.toggleSaveProject = async (req, res) => {
    const { id } = req.params;
    const keyword = req.query.keyword || ""; // Get keyword if provided
    const user = await Users.findById(req.user._id);

    const alreadySaved = user.savedProjects.includes(id);
    if (alreadySaved) {
        user.savedProjects.pull(id);
        await user.save();
        req.flash("success", "Project removed from your library.");
    } else {
        user.savedProjects.push(id);
        await user.save();
        req.flash("success", "Project saved to your library!");
    }

    // Check if the referer is the library page and redirect accordingly
    if (req.headers.referer && req.headers.referer.includes("/library")) {
        return res.redirect("/projects/library");
    } else if (keyword) {
        return res.redirect(`/search?keyword=${keyword}`);
    } else {
        return res.redirect("/projects");
    }
};

module.exports.viewLibrary = async (req, res) => {
    const user = await Users.findById(req.user._id).populate("savedProjects");
    res.render("projects/library", { projects: user.savedProjects });
};

module.exports.saveDraft = async (req, res) => {
    console.log("Draft Data:", req.body); // Debug log for incoming data
    console.log("Uploaded Files:", req.files); // Debug log for uploaded files

    const { draftId, deleteImages, ...draftData } = req.body;

    try {
        // Ensure `images` array is always present and handle uploaded files
        const uploadedImages = Array.isArray(req.files)
            ? req.files.map((file) => ({
                url: file.path,
                filename: file.filename,
            }))
            : []; // Fallback to an empty array if no files are uploaded

        let project;

        if (draftId) {
            // Find and update an existing draft
            project = await Project.findById(draftId);

            if (!project) {
                return res.status(404).json({ error: "Draft not found." });
            }

            // Handle image deletions
            if (deleteImages && Array.isArray(deleteImages)) {
                for (let filename of deleteImages) {
                    await cloudinary.uploader.destroy(filename); // Remove image from Cloudinary
                }
                await project.updateOne({
                    $pull: { images: { filename: { $in: deleteImages } } }, // Remove image references from database
                });
            }

            // Update the draft with new data
            project.set({
                ...draftData,
                isDraft: true, // Explicitly set as draft
                lastSavedAt: Date.now(),
            });

            // Add new uploaded images to the draft
            if (uploadedImages.length > 0) {
                project.images.push(...uploadedImages);
            }

            await project.save(); // Save the updated draft
        } else {
            // Create a new draft if no `draftId` is provided
            project = new Project({
                ...draftData,
                images: uploadedImages, // Include uploaded images
                isDraft: true, // Explicitly set as draft
                author: req.user._id,
                lastSavedAt: Date.now(),
            });

            await project.save();
        }

        res.status(200).json({
            message: "Draft saved successfully",
            projectId: project._id,
        });
    } catch (error) {
        console.error("Failed to save draft:", error.message);

        res.status(500).json({
            error: error.message || "Failed to save draft.",
        });
    }
};

module.exports.deleteDraft = async (req, res) => {
    try {
        const { id } = req.params;
        await Project.findByIdAndDelete(id);
        req.flash("success", "Draft deleted successfully.");
        res.redirect("/projects/drafts");
    } catch (error) {
        console.error("Failed to delete draft:", error);
        req.flash("error", "Failed to delete draft.");
        res.redirect("/projects/drafts");
    }
};

async function add_user_keywords(req, project, Users) {
    const user = await get_user(Users, req);
    if (user) {
        const userKeywords = new Multiset(user.keywords || new Map()); // Initialize if undefined

        const projectKeywords = Array.isArray(project.keywords)
            ? project.keywords
            : [];
        userKeywords.add_list(projectKeywords);

        user.keywords = userKeywords.export(); // Ensure the format matches expectations

        await user.save();
    }
}

async function process_projects(projects, user) {
    if (user && user.keywords instanceof Map) {
        const keywords = user.keywords;
        projects.forEach((project) => {
            const projectKeywords = Array.isArray(project.keywords)
                ? project.keywords
                : [];
            project.relevanceScore = calculateRelevance(
                projectKeywords,
                keywords
            );
        });

        projects.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    return projects;
}

async function get_user(Users, req) {
    let user = null;
    if (req.user) {
        user = await Users.findById(req.user._id);
    }
    return user;
}

function calculateRelevance(project_keywords, user_keywords) {
    if (!user_keywords || !(user_keywords instanceof Map)) {
        return 0; // Default relevance if user_keywords is missing or invalid
    }

    let relevance = 0;

    for (const keyword of project_keywords) {
        relevance += user_keywords.get(keyword) || 0; // Add keyword relevance or default to 0
    }

    return relevance;
}
