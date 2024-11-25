const Project = require("../models/project");

exports.searchProjects = async (req, res) => {
    const keyword = req.query.keyword;
    const language = req.session.language || "en"; // Default to 'en'

    if (!keyword || keyword.trim() === "") {
        return res.render("projects/search", {
            projects: [],
            geoJsonProjects: { type: "FeatureCollection", features: [] },
            keyword: "",
            message: "Please enter a keyword to search.",
        });
    }

    try {
        // First, search with $text for title and description
        const textResults = await Project.find({
            $text: { $search: keyword },
        });

        // Then, search with regex for location, categories, and keywords
        const regexResults = await Project.find({
            $or: [
                { location: new RegExp(keyword, "i") },
                { categories: new RegExp(keyword, "i") },
                { keywords: new RegExp(keyword, "i") },
            ],
        });

        // Combine the two result sets and remove duplicates
        const combinedResults = [
            ...new Map(
                [...textResults, ...regexResults].map((project) => [
                    project._id.toString(),
                    project,
                ])
            ).values(),
        ];

        // Transform projects for the frontend
        const transformedProjects = combinedResults.map((project) => ({
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

        // Convert projects to GeoJSON format
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
