// controllers/searchController.js
const Project = require("../models/project"); // assuming a Project model

exports.searchProjects = async (req, res) => {
    const keyword = req.query.keyword;

    // Check if the keyword is missing or empty
    if (!keyword || keyword.trim() === "") {
        return res.render("projects/search", {
            projects: [],
            keyword: "", // Optional: Display the keyword as an empty string
            message: "Please enter a keyword to search.",
        });
    }

    try {
        const projects = await Project.find({
            $text: { $search: keyword },
        });

        res.render("projects/search", { projects, keyword });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).send("Error searching projects.");
    }
};
