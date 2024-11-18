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
        // First attempt a text search on title, description, and location
        let projects = await Project.find({
            $text: { $search: keyword },
        });

        // If no projects were found with text search, try a regular expression search on location
        if (projects.length === 0) {
            projects = await Project.find({
                location: new RegExp(keyword, "i"), // Case-insensitive partial match for location
            });
        }

        // Convert projects to GeoJSON format for map display
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

        // Render the search results with both the projects and geoJsonProjects
        res.render("projects/search", { projects, geoJsonProjects, keyword });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).send("Error searching projects.");
    }
};
