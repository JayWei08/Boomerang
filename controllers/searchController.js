const Project = require("../models/project");

exports.searchProjects = async (req, res) => {
    const keyword = req.query.keyword;

    if (!keyword || keyword.trim() === "") {
        return res.render("projects/search", {
            projects: [],
            geoJsonProjects: { type: "FeatureCollection", features: [] },
            keyword: "",
            message: "Please enter a keyword to search.",
        });
    }

    try {
        const projects = await Project.find({
            $text: { $search: keyword },
        });

        const geoJsonProjects = {
            type: "FeatureCollection",
            features: projects.map((project) => ({
                type: "Feature",
                geometry: project.geometry,
                properties: {
                    title: project.title,
                    description: project.description,
                    popUpMarkup: `<a href="/projects/${project._id}">${project.title}</a>`,
                },
            })),
        };

        res.render("projects/search", { projects, geoJsonProjects, keyword });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).send("Error searching projects.");
    }
};
