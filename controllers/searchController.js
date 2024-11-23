const Project = require("../models/project");

exports.searchProjects = async (req, res) => {
    const keyword = req.query.keyword;
    const language = req.session.language || "en"; // Default to 'en' if no language is set

    if (!keyword || keyword.trim() === "") {
        return res.render("projects/search", {
            projects: [],
            geoJsonProjects: { type: "FeatureCollection", features: [] },
            keyword: "",
            message: "Please enter a keyword to search.",
        });
    }

    try {
        // Attempt a text search on title, description, and location
        let projects = await Project.find({
            $text: { $search: keyword },
        });

        // If no projects are found with text search, try a regex search on location
        if (projects.length === 0) {
            projects = await Project.find({
                location: new RegExp(keyword, "i"), // Case-insensitive match for location
            });
        }

        // Transform projects to include language-specific title and description
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
            isDraft: project.isDraft,
            lastSavedAt: project.lastSavedAt,
        }));

        // Convert projects to GeoJSON format for map display
        const geoJsonProjects = {
            type: "FeatureCollection",
            features: transformedProjects
                .filter((project) => project.geometry) // Exclude projects without geometry
                .map((project) => ({
                    type: "Feature",
                    geometry: project.geometry,
                    properties: {
                        title: project.titleText,
                        description: project.descriptionText,
                        popUpMarkup: `<a href="/projects/${project._id}">${project.titleText}</a>`,
                    },
                })),
        };

        // Render the search results with the transformed projects and GeoJSON data
        res.render("projects/search", {
            projects: transformedProjects,
            geoJsonProjects,
            keyword,
        });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).send("Error searching projects.");
    }
};
