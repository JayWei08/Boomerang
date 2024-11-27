const Project = require("../models/project");
const categories = require("../utils/categories").categories;

exports.searchProjects = async (req, res) => {
    const { keyword, category, location, sort } = req.query;
    const language = req.session.language || "en";

    try {
        const filters = {};
        if (keyword && keyword.trim()) {
            // Use computed property syntax for dynamic keys
            filters.$or = [
                { [`title.${language}`]: new RegExp(keyword, "i") },
                { [`description.${language}`]: new RegExp(keyword, "i") },
                { keywords: new RegExp(keyword, "i") },
                { location: new RegExp(keyword, "i") },
            ];
        }
        if (category) {
            filters.categories = { $in: [category] };
        }
        if (location) {
            filters.location = new RegExp(location, "i");
        }

        let query = Project.find(filters);
        if (sort === "mostRecent") {
            query = query.sort({ createdAt: -1 });
        } else if (sort === "deadline") {
            query = query.sort({ deadline: 1 });
        }

        const projects = await query.exec();

        const transformedProjects = projects.map((project) => ({
            _id: project._id,
            titleText: project.title.get(language) || project.title.get("en"),
            descriptionText:
                project.description.get(language) ||
                project.description.get("en"),
            images: project.images,
            location: project.location,
            deadline: project.deadline,
            categories: project.categories,
            geometry: project.geometry, // Include geometry for map display
        }));

        const geoJsonProjects = {
            type: "FeatureCollection",
            features: transformedProjects
                .filter(
                    (project) =>
                        project.geometry &&
                        project.geometry.type === "Point" &&
                        Array.isArray(project.geometry.coordinates) &&
                        project.geometry.coordinates.length === 2
                )
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

        const categoryList = Object.keys(categories).map((key) => ({
            key,
            value: key,
        }));

        res.render("projects/search", {
            projects: transformedProjects,
            geoJsonProjects,
            keyword,
            category,
            location,
            sort,
            categories: categoryList,
        });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).send("Error searching projects.");
    }
};
