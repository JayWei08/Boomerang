const User = require('../models/user'); // adjust path as needed

// Render language selection page
exports.renderLanguageSelectionPage = (req, res) => {
    res.render('yourView', { res.locals.availableLanguages, selectedLanguage: req.session.language || 'th' });
};

// Handle language selection
exports.setLanguage = async (req, res) => {
    const { language } = req.body;
    if (!res.locals.availableLanguages.includes(language)) {
        return res.status(400).send('Invalid language');
    }

    if (req.isAuthenticated()) {
        const user = await User.findById(req.user._id);
        user.language = language;
        await user.save();
    }

    req.session.language = language;
    // console.log(language);
    res.redirect('back');
};
