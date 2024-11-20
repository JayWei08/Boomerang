const Joi = require("joi");

module.exports.projectSchema = Joi.object({
    draftId: Joi.string().optional(), // Allow optional draftId at the top level
    project: Joi.object({
        title: Joi.string().required().messages({
            "string.empty": "Title is required.",
        }),
        description: Joi.string().required().messages({
            "string.empty": "Description is required.",
        }),
        location: Joi.string().required().messages({
            "string.empty": "Location is required.",
        }),
        currency: Joi.string().required().messages({
            "string.empty": "Currency is required.",
        }),
        fundingGoal: Joi.number().required().min(0).messages({
            "number.base": "Funding Goal must be a number.",
            "number.min": "Funding Goal must be at least 0.",
            "any.required": "Funding Goal is required.",
        }),
        deadline: Joi.date().greater("now").required().messages({
            "date.base": "Deadline must be a valid date.",
            "date.greater": "Deadline must be in the future.",
            "any.required": "Deadline is required.",
        }),
        status: Joi.string()
            .valid("active", "successful", "failed", "canceled")
            .default("active")
            .messages({
                "string.valid":
                    "Status must be one of: active, successful, failed, canceled.",
            }),
    })
        .required()
        .messages({
            "object.base": "Project data must be an object.",
            "any.required": "Project data is required.",
        }),
    deleteImages: Joi.array().items(Joi.string()).optional(), // Allow array of image filenames
});

module.exports.validateProject = (req, res, next) => {
    const { error } = module.exports.projectSchema.validate(req.body, {
        abortEarly: false,
    });
    if (error) {
        const msg = error.details.map((el) => el.message).join(", ");
        throw new ExpressError(msg, 400); // Send a clear error message if validation fails
    } else {
        next();
    }
};

module.exports.commentSchema = Joi.object({
    comment: Joi.object({
        body: Joi.string().required().messages({
            "string.empty": "Comment body is required.",
        }),
    })
        .required()
        .messages({
            "object.base": "Comment data must be an object.",
            "any.required": "Comment data is required.",
        }),
});
