const mongoose = require("mongoose");
const cities = require("./cities");
const Project = require("../models/project");
const projects = require("./startups");
const dbUrl = process.env.DB_URL;

mongoose
    .connect(dbUrl) // Add the missing colon here
    .then(() => {
        console.log("MONGO CONNECTION OPEN");
    })
    .catch((err) => {
        console.log("MONGO CONNECTION ERROR");
        console.log(err);
    });

const seedDB = async () => {
    await Project.deleteMany({});
    for (let i = 0; i < 100; i++) {
        // Randomly pick a project title and description
        const randomProject =
            projects[Math.floor(Math.random() * projects.length)];

        // Randomly pick a city from the cities data
        const randomCity = cities[Math.floor(Math.random() * cities.length)];

        // Generate a random funding goal between 1000 and 50000
        const fundingGoal = Math.floor(Math.random() * 50) * 1000 + 1000;

        // Create a new project instance with randomized data
        const project = new Project({
            //YOUR USER ID
            author: "67400f748a414a4e0ff4c463",
            location: `${randomCity.city}, ${randomCity.state}`,
            title: randomProject.title,
            titleText: randomProject.title["th"],
            description: randomProject.description,
            descriptionText: randomProject.description["th"],
            currency: "THB",
            fundingGoal: fundingGoal,
            geometry: {
                type: "Point",
                coordinates: [randomCity.longitude, randomCity.latitude], // Using city longitude and latitude
            },
            deadline: new Date("2024-12-31"),
            createdAt: new Date("2024-10-01"),
            updatedAt: new Date("2024-10-15"),
            images: [
                {
                    url: "https://res.cloudinary.com/dei5hbjfg/image/upload/v1732073743/Boomerang/qxc1jfz18ana6m3d0fbr.png",
                    filename: "Boomerang/ujp5lxrxohzvkutf5oos",
                },
                {
                    url: "https://res.cloudinary.com/dei5hbjfg/image/upload/v1732073743/Boomerang/lgtvfra0krsrwggt3pkk.png",
                    filename: "Boomerang/yxnzsyuugorktvqfp7ln",
                },
            ],
            status: "active",
            categories: randomProject.categories,
            keywords: randomProject.keywords,
        });
        await project.save();
    }
};

// const seedDB = async () => {
//     await Project.deleteMany({});
//     await Project.insertMany(sampleData);
// };

seedDB().then(() => {
    mongoose.connection.close();
});
