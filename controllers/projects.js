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
    const projects = await process_projects(req, Users);
    res.render("projects/index", { projects });
};

module.exports.renderNewForm = (req, res) => {
    res.render("projects/new");
};

module.exports.createProject = async (req, res, next) => {
    const geoData = await geocoder
        .forwardGeocode({
            query: req.body.project.location,
            limit: 1,
        })
        .send();
    const project = new Project(req.body.project);
    project.geometry = geoData.body.features[0].geometry;
    project.images = req.files.map((f) => ({
        url: f.path,
        filename: f.filename,
    }));
    project.author = req.user._id;
    await project.save();
    req.flash("success", "Successfully made a new project!");
    res.redirect(`/projects/${project._id}`);
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

        if (!project) {
            req.flash("error", "Cannot find that project!");
            return res.redirect("/projects");
        }

        // Check the database for the last fetch time
        let apiFetch = await ApiFetch.findOne();
        const now = Date.now();
        const oneHour = 1000 * 60 * 60; // 1 hour in milliseconds

        let currencyData;

        if (!apiFetch || now - new Date(apiFetch.lastFetchTime).getTime() > oneHour) {
            console.log("Fetching fresh currency data...");
            const response = await fetch('https://api.freecurrencyapi.com/v1/latest?apikey=fca_live_cm1tAAJNfEOsxaq2vaGu0SI5uBAT8rBSgNSlHbTJ');
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
            console.log("Using cached currency data from MongoDB.");
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
    const project = await Project.findById(id);
    if (!project) {
        req.flash("error", "Cannot find that project!");
        res.redirect("/projects");
    }
    res.render("projects/edit", { project });
};

module.exports.updateProject = async (req, res) => {
    const { id } = req.params;
    const project = await Project.findByIdAndUpdate(id, {
        ...req.body.project,
        updatedAt: Date.now(), // Update `updatedAt` to current date
    });
    const imgs = req.files.map((f) => ({ url: f.path, filename: f.filename }));
    project.images.push(...imgs);
    await project.save();
    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await project.updateOne({
            $pull: { images: { filename: { $in: req.body.deleteImages } } },
        });
    }
    req.flash("success", "Successfully updated project!");
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

async function process_projects(req, Users) {
    const projects = await Project.find({});
    const user = await get_user(Users, req);

    if (user && user.keywords instanceof Map) {
        projects.forEach((project) => {
            const projectKeywords = Array.isArray(project.keywords)
                ? project.keywords
                : [];
            project.relevanceScore = calculateRelevance(
                projectKeywords,
                user.keywords
            );
        });

        projects.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else {
        // Assign a default relevanceScore if the user or keywords are missing
        projects.forEach((project) => {
            project.relevanceScore = 0;
        });
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
