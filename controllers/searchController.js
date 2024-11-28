const Project = require("../models/project");
const categories = require("../utils/categories").categories;

exports.searchProjects = async (req, res) => {
    const { keyword, category, location, sort } = req.query;
    const language = req.session.language || "en";

    try {
        const filters = {};

        // Keyword Search
        if (keyword && keyword.trim()) {
            const keywordRegex = new RegExp(keyword, "i");

            // Match projects where the keyword matches title, description, keywords, or location
            filters.$or = [
                { [`title.${language}`]: keywordRegex },
                { [`description.${language}`]: keywordRegex },
                { keywords: keywordRegex },
                { location: keywordRegex },
            ];

            // Check if the keyword matches a category or subcategory
            const categoryKeys = Object.keys(categories);
            const matchingCategories = categoryKeys.filter((catKey) =>
                catKey.toLowerCase().includes(keyword.toLowerCase())
            );

            // Add subcategories to matching categories
            categoryKeys.forEach((catKey) => {
                const subcategories = categories[catKey];
                if (
                    subcategories.some((sub) =>
                        sub.toLowerCase().includes(keyword.toLowerCase())
                    )
                ) {
                    matchingCategories.push(catKey);
                }
            });

            // If we have matching categories, add them to the filter
            if (matchingCategories.length > 0) {
                filters.$or.push({ categories: { $in: matchingCategories } });
            }
        }

        // Category Filter
        if (category) {
            filters.categories = { $in: [category] };
        }

        // Location Filter
        if (location) {
            filters.location = new RegExp(location, "i");
        }

        // Sort Projects
        let query = Project.find(filters);
        if (sort === "mostRecent") {
            query = query.sort({ createdAt: -1 });
        } else if (sort === "deadline") {
            query = query.sort({ deadline: 1 });
        }

        // Execute Query
        const projects = await query.exec();

        // Transform Projects for GeoJSON
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

        // Prepare GeoJSON for the map
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

        // Convert categories for dropdown
        const categoryList = Object.keys(categories).map((key) => ({
            key,
            value: key,
        }));

        // Render the search page with results
        res.render("projects/search", {
            projects: transformedProjects,
            geoJsonProjects,
            keyword,
            category, // For searching
            selectedCategory: category, // For keeping the selected category
            location,
            sort,
            categories: categoryList,
        });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).send("Error searching projects.");
    }
};
