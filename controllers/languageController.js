const User = require('../models/user'); // adjust path as needed

// Handle language selection
exports.setLanguage = async (req, res) => {
    const { language } = req.body;
    if (!res.locals.availableLanguages.includes(language)) {
        return res.status(400).send('Invalid language');
    }

    try {
        // Updating User's prefence & session language
        if (req.isAuthenticated()) {
            const user = await User.findById(req.user._id);
            if (!user) {return res.status(404).json({ error: "User not found" });}

            if (user.cookiesBool) {
                user.language = language; // Sets the user language
                await user.save();

                req.session.cookiesBool = user.cookiesBool;
            }
        }

        // Reading from session to update language
        if (req.session && req.session.cookiesBool) {
            req.setLocale(language); // Sets i18n or static-multilanguage language
            res.locals.selectedLanguage = language;

            req.session.language = language; // Sets the session language
            req.session.save((err) => {
                if (err) {
                    console.error("Error saving session:", err);
                    return res.status(500).json({ message: "Internal Server Error" });
                }
            });
        }

        return res.status(200).json({ message: "Language set"});
    } catch (err) {
        console.error("Error updating language:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
};
