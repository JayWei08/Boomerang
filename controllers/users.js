const User = require("../models/user");
const sendWelcomeEmail = require("../utils/sendEmail");

module.exports.renderRegister = (req, res) => {
    res.render("users/register");
};

module.exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const user = new User({ username, email, keywords: {} });
        const registeredUser = await User.register(user, password);

        await sendWelcomeEmail(email, username);

        req.flash(
            "success",
            "Welcome to Boomerang! A welcome email has been sent."
        );
        res.redirect("/projects");
    } catch (error) {
        req.flash("error", error.message);
        res.redirect("register");
    }
};

module.exports.renderLogin = (req, res) => {
    res.render("users/login");
};

module.exports.login = (req, res) => {
    req.flash("success", "Welcome back!");
    const redirectUrl = res.locals.returnTo || "/projects"; // update this line to use res.locals.returnTo now
    res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.flash("success", "Successfully logged out!");
        res.redirect("/projects");
    });
};
