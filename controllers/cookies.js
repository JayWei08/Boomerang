const User = require("../models/user");

module.exports.destroySession = (req, res) => {
    req.session.destroy((err) => {
        // Destroy session
        if (err) {
            console.error("Error destroying session:", err);
            return res.redirect("/"); // Fallback if session deletion fails
        }
        res.clearCookie("connect.sid"); // Ensure session cookie is deleted
        res.redirect("/projects"); // Redirect after logout
    });
};

module.exports.setCookies = async (req, res) => {
    const { cookiesBool } = req.body;
    if (typeof cookiesBool !== "boolean") {
        return res.status(400).json({ error: "Invalid value for cookiesBool" });
    }

    try {
        if (req.isAuthenticated()) {
            const user = await User.findById(req.user._id);
            if (!user) {return res.status(404).json({ error: "User not found" });}

            user.cookiesBool = cookiesBool;
            await user.save();
        }

        req.session.cookiesBool = cookiesBool;
        req.session.save((err) => {
            if (err) {
                console.error("Error saving session:", err);
                return res.status(500).json({ message: "Internal Server Error" });
            }
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("Error updating cookies:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};
