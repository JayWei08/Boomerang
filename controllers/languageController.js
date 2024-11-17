const User = require('../models/user'); // adjust path as needed

// Language options available
const availableLanguages = ['en', 'es', 'fr']; // Add more as needed

// Render language selection page
exports.renderLanguageSelectionPage = (req, res) => {
    res.render('yourView', { availableLanguages, selectedLanguage: req.session.language || 'en' });
};

// Handle language selection
exports.setLanguage = async (req, res) => {
    const { language } = req.body;
    if (!availableLanguages.includes(language)) {
        return res.status(400).send('Invalid language');
    }

    if (req.isAuthenticated()) {
        const user = await User.findById(req.user._id);
        user.language = language;
        await user.save();
    }

    req.session.language = language;
    console.log(language)
    res.redirect('back');
};
