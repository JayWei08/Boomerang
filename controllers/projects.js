const Project = require("../models/project");
const Users = require("../models/user");
const ApiFetch = require("../models/apiFetch");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const { cloudinary } = require("../cloudinary");
const Multiset = require("../utils/Multiset");
const currencyToken = process.env.CURRENCY_TOKEN;
const { categories } = require("../utils/categories.js"); // Import the categories data

module.exports.index = async (req, res) => {
    const language = req.session.language || "th"; // Default to 'en' if no language is set
    const user = await get_user(Users, req);

    // Fetch all projects
    const allProjects = await Project.find({});
    const projects = allProjects.map((project) => ({
        _id: project._id,
        titleText: project.title.get(language),
        descriptionText: project.description.get(language),
        images: project.images,
        geometry: project.geometry,
        currency: project.currency,
        fundingGoal: project.fundingGoal,
        location: project.location,
        deadline: project.deadline,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        author: project.author,
        status: project.status,
        comments: project.comments,
        keywords: project.keywords,
        isDraft: project.isDraft,
        lastSavedAt: project.lastSavedAt,
    }));

    // Sort projects by relevance
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

        // Sort projects by relevance score
        projects.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Fetch user's own projects if logged in
    let myProjects = [];
    if (req.user) {
        const userProjects = await Project.find({
            author: req.user._id,
            isDraft: false, // Exclude drafts
        });
        myProjects = userProjects.map((project) => ({
            _id: project._id,
            titleText: project.title.get(language),
            descriptionText: project.description.get(language),
            images: project.images,
            geometry: project.geometry,
            location: project.location,
            deadline: project.deadline,
        }));
    }

    // Convert projects to GeoJSON format
    try {
        // Filter out only published projects (not drafts)
        const publishedProjects = projects.filter(
            (project) => !project.isDraft
        );

        const geoJsonProjects = {
            type: "FeatureCollection",
            features: publishedProjects.map((project) => ({
                type: "Feature",
                geometry: project.geometry || {
                    type: "Point",
                    coordinates: [0, 0], // Default coordinates
                },
                properties: {
                    title: project.titleText,
                    description: project.descriptionText,
                    popUpMarkup: `<a href="/projects/${project._id}">${project.titleText}</a>`,
                },
            })),
        };

        // Render the projects/index template
        res.render("projects/index", {
            geoJsonProjects,
            projects: publishedProjects,
            // projects: projects.slice(0, 30), // Pass the top 30 projects
            myProjects, // Pass user's own projects
        });
    } catch (err) {
        console.error("Error loading projects:", err);
        res.redirect("/");
    }
};

module.exports.renderNewForm = async (req, res) => {
    const { draftId } = req.query;
    let draft = null;

    if (draftId) {
        draft = await Project.findById(draftId);
        if (!draft) {
            req.flash("error", "Draft not found.");
            return res.redirect("/projects/drafts");
        }
    }

    // Pass categories as JSON directly to avoid conversion issues
    res.render("projects/new", {
        draft,
        categories: JSON.stringify(categories),
    });
};

// TODO: change where the input text is being stored from project.title to project.titleText
module.exports.createProject = async (req, res, next) => {
    try {
        const { draftId } = req.body; // Retrieve draftId from the request
        let project;

        // Ensure `title` and `description` are stored as `Map` in the required format
        if (
            req.body.project.title &&
            typeof req.body.project.title === "string"
        ) {
            req.body.project.title = new Map([["en", req.body.project.title]]);
            req.body.project.titleText = req.body.project.title.get("en"); // Set titleText
        }
        if (
            req.body.project.description &&
            typeof req.body.project.description === "string"
        ) {
            req.body.project.description = new Map([
                ["en", req.body.project.description],
            ]);
            req.body.project.descriptionText =
                req.body.project.description.get("en"); // Set descriptionText
        }

        // Automatically determine categories based on selected keywords
        const selectedKeywords = req.body.project.keywords || [];
        const determinedCategories = [];

        for (const [category, keywords] of Object.entries(categories)) {
            // Check if any of the selected keywords belong to this category
            const matchingKeywords = selectedKeywords.filter((keyword) =>
                keywords.includes(keyword)
            );
            if (matchingKeywords.length > 0) {
                determinedCategories.push(category);
            }
        }

        // Assign the determined categories to the project data
        req.body.project.categories = determinedCategories;

        if (draftId) {
            // Update an existing draft
            project = await Project.findById(draftId);
            if (!project) {
                req.flash("error", "Draft not found.");
                return res.redirect("/projects/drafts");
            }

            project.set({
                ...req.body.project, // Update fields from form
                titleText: req.body.project.titleText,
                descriptionText: req.body.project.descriptionText,
                isDraft: false, // Mark the project as published
                updatedAt: Date.now(), // Update timestamp
            });

            // Geocode location
            const geoData = await geocoder
                .forwardGeocode({ query: req.body.project.location, limit: 1 })
                .send();
            project.geometry = geoData.body.features[0].geometry;

            // Add uploaded images
            const imgs = req.files.map((f) => ({
                url: f.path,
                filename: f.filename,
            }));
            project.images.push(...imgs);
        } else {
            // Create a new project
            const geoData = await geocoder
                .forwardGeocode({ query: req.body.project.location, limit: 1 })
                .send();

            project = new Project({
                ...req.body.project, // Use form data
                titleText: req.body.project.titleText,
                descriptionText: req.body.project.descriptionText,
                geometry: geoData.body.features[0].geometry, // Add location geometry
                images: req.files.map((f) => ({
                    url: f.path,
                    filename: f.filename,
                })),
                categories: determinedCategories, // Automatically assigned categories
                author: req.user._id, // Associate with the current user
            });
        }

        // Save the project
        await project.save();
        req.flash(
            "success",
            draftId
                ? "Draft successfully published!"
                : "Successfully created a new project!"
        );
        return res.redirect(`/projects/${project._id}`); // Redirect to the project page
    } catch (error) {
        // Improved error logging
        console.error("Error in createProject:", {
            message: error.message,
            stack: error.stack,
            body: req.body,
        });

        req.flash(
            "error",
            "Failed to create or update the project. Please ensure all required fields are filled."
        );
        res.redirect("/projects/new"); // Redirect back to the form
    }
};

async function translate_text(text, availableLanguages) {
    let textMap = new Map();

    for (let language of availableLanguages) {
        if (textMap.has(language)) {
            continue;
        }

        const [translation, metadata] = await translate.translate(
            text,
            language
        );
        textMap.set(language, translation);

        const detectedLanguage = metadata.detectedSourceLanguage;
        if (!textMap.has(detectedLanguage)) {
            textMap.set(detectedLanguage, text);
        }
    }

    return textMap;
}

module.exports.showProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate({
                path: "comments",
                populate: { path: "author" },
            })
            .populate("author");

        const language = req.session.language;
        project.titleText =
            project.title.get(language) || project.title.get("th");
        project.descriptionText =
            project.description.get(language) || project.description.get("th");

        if (!project) {
            req.flash("error", "Cannot find that project!");
            return res.redirect("/projects");
        }

        let apiFetch = await ApiFetch.findOne();
        const now = Date.now();
        const oneHour = 1000 * 60 * 60; // 1 hour in milliseconds

        let currencyData;

        if (
            !apiFetch ||
            now - new Date(apiFetch.lastFetchTime).getTime() > oneHour
        ) {
            const response = await fetch(
                "https://api.freecurrencyapi.com/v1/latest?apikey=fca_live_cm1tAAJNfEOsxaq2vaGu0SI5uBAT8rBSgNSlHbTJ"
            );
            const freshData = await response.json();

            if (!apiFetch) {
                apiFetch = new ApiFetch({
                    lastFetchTime: new Date(),
                    currencyData: freshData,
                });
            } else {
                apiFetch.lastFetchTime = new Date();
                apiFetch.currencyData = freshData;
            }

            await apiFetch.save();
            currencyData = freshData;
        } else {
            currencyData = apiFetch.currencyData;
        }

        const userCurrency = req.user
            ? (await Users.findById(req.user._id)).currency
            : req.session.currency;

        // Pass the project, currencyData, and mapToken to the template
        res.render("projects/show", {
            project,
            currencyData,
            userCurrency,
            mapToken: process.env.MAPBOX_TOKEN, // Pass Mapbox token
        });

        add_user_keywords(req, project, Users);
    } catch (error) {
        console.error("Error in showProject:", error);
        req.flash("error", "Something went wrong!");
        res.redirect("/projects");
    }
};

module.exports.getProjectsByCategory = async (req, res) => {
    const { category } = req.params;
    const language = req.session.language || "en"; // Default language

    try {
        // Find projects in the specified category
        const projects = await Project.find({
            categories: category,
        });

        const transformedProjects = projects.map((project) => ({
            _id: project._id,
            titleText: project.title.get(language) || project.title.get("en"),
            descriptionText:
                project.description.get(language) ||
                project.description.get("en"),
            images: project.images,
            geometry: project.geometry,
            currency: project.currency,
            fundingGoal: project.fundingGoal,
            location: project.location,
            deadline: project.deadline,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            author: project.author,
            status: project.status,
            comments: project.comments,
            keywords: project.keywords,
            categories: project.categories,
            isDraft: project.isDraft,
            lastSavedAt: project.lastSavedAt,
        }));

        // Render category-specific projects page
        res.render("projects/category", {
            projects: transformedProjects,
            category,
        });
    } catch (error) {
        console.error("Error fetching projects by category:", error);
        res.status(500).send("Error loading projects for this category.");
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

    const { draftId, deleteImages, project } = req.body;

    if (!project || !project.title) {
        return res
            .status(400)
            .json({ error: "Title is required for saving draft." });
    }

    try {
        // Transform `title` and `description` into `Map` format
        if (project.title && typeof project.title === "string") {
            project.title = new Map([["en", project.title]]);
        }
        if (project.description && typeof project.description === "string") {
            project.description = new Map([["en", project.description]]);
        }

        const uploadedImages = Array.isArray(req.files)
            ? req.files.map((file) => ({
                  url: file.path,
                  filename: file.filename,
              }))
            : [];

        let draft;

        if (draftId) {
            draft = await Project.findById(draftId);

            if (!draft) {
                return res.status(404).json({ error: "Draft not found." });
            }

            // Delete images if requested
            if (deleteImages && Array.isArray(deleteImages)) {
                for (let filename of deleteImages) {
                    await cloudinary.uploader.destroy(filename);
                }
                await draft.updateOne({
                    $pull: { images: { filename: { $in: deleteImages } } },
                });
            }

            // Update the draft
            draft.set({
                ...project,
                isDraft: true,
                lastSavedAt: Date.now(),
            });

            if (uploadedImages.length > 0) {
                draft.images.push(...uploadedImages);
            }

            await draft.save();
        } else {
            // Create a new draft
            draft = new Project({
                ...project,
                title: project.title,
                description: project.description,
                images: uploadedImages,
                isDraft: true,
                author: req.user._id,
                lastSavedAt: Date.now(),
            });

            await draft.save();
        }

        res.status(200).json({
            message: "Draft saved successfully",
            projectId: draft._id,
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
        res.redirect("/projects/my-projects");
    } catch (error) {
        console.error("Failed to delete draft:", error);
        req.flash("error", "Failed to delete draft.");
        res.redirect("/projects/my-projects");
    }
};

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
