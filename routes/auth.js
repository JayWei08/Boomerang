const express = require("express");
const passport = require("passport");
const router = express.Router();
const User = require("../models/user");
const sendWelcomeEmail = require("../utils/sendEmail");

// Google authentication route
router.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google callback route
router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res) => {
        if (req.user.isNewUser) {
            // New user - send welcome email
            await sendWelcomeEmail(req.user.email, req.user.username);
            req.flash(
                "success",
                "Signed up with Google. Welcome to Boomerang! A welcome email has been sent."
            );
        } else {
            // User is signing in
            req.flash("success", "Welcome back!");
        }

        res.redirect("/projects"); // Adjust as needed
    }
);

module.exports = router;
