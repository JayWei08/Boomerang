const Project = require("../models/project");
const Users = require("../models/user");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const { cloudinary } = require("../cloudinary");
const Multiset = require("../utils/Multiset");

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
    const project = await Project.findById(req.params.id)
        .populate({
            path: "comments",
            populate: {
                path: "author",
            },
        })
        .populate("author");
    if (!project) {
        req.flash("error", "Cannot find that project!");
        res.redirect("/projects");
    }
    res.render("projects/show", { project });

    add_user_keywords(req, project, Users);
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
        const userKeywords = new Multiset(user.keywords);

        const projectKeywords = Array.isArray(project.keywords)
            ? project.keywords
            : [];
        userKeywords.add_list(projectKeywords);

        user.keywords = userKeywords.export();

        await user.save();
    }
}

async function process_projects(req, Users) {
    const projects = await Project.find({});
    const user = await get_user(Users, req);

    if (user) {
        projects.forEach((project) => {
            const projectKeywords = Array.isArray(project.keywords) ? project.keywords : [];
            project.relevanceScore = calculateRelevance(
                projectKeywords,
                user.keywords
            );
        });

        projects.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    return projects;
}

async function get_user(Users, req) {
    let user = null;
    if (req.user) {
        user = Users.findById(req.user._id);
    }
    return user;
}

function calculateRelevance(project_keywords, user_keywords) {
    let relevance = 0;
    const maxRelevance = 3;

    for (const keyword of project_keywords) {
        const currRelevance = user_keywords.get(keyword) || 0;
        relevance += Math.min(currRelevance, maxRelevance);
    }

    return relevance;
}
