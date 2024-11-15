const Project = require("../models/project");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const { cloudinary } = require("../cloudinary");

module.exports.index = async (req, res) => {
   const projects = await Project.find({});

   // Log each project's data to confirm the required fields
   projects.forEach((project) => {
      console.log({
         title: project.title,
         description: project.description,
         coordinates: project.geometry.coordinates, // Confirm coordinates format
         id: project._id,
      });
   });

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
   console.log(project);
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
   console.log(req.body);
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
      console.log(project);
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
