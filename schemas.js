const Joi = require("joi");

module.exports.projectSchema = Joi.object({
    project: Joi.object({
        title: Joi.string().required(),
        // image: Joi.string().uri().optional(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        fundingGoal: Joi.number().required().min(0),
        deadline: Joi.date().greater("now").required(),
        status: Joi.string()
            .valid("active", "successful", "failed", "canceled")
            .default("active"),
    }).required(),
    deleteImages: Joi.array(),
});

module.exports.commentSchema = Joi.object({
    comment: Joi.object({
        body: Joi.string().required(),
    }).required(),
});
