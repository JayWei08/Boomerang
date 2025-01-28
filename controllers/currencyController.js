const User = require('../models/user'); // adjust path as needed

// Render language selection page
exports.renderLanguageSelectionPage = (req, res) => {
    res.render('yourView', { res.locals.availableCurrencies, selectedCurrency: req.session.currency || 'THB' });
};

// Handle language selection
exports.setCurrency = async (req, res) => {
    const { currency } = req.body;
    if (!res.locals.availableCurrencies.includes(currency)) {
        return res.status(400).send('Invalid currency');
    }

    if (req.isAuthenticated()) {
        const user = await User.findById(req.user._id);
        user.currency = currency;
        await user.save();
    }

    req.session.currency = currency;
    // console.log(currency);
    res.redirect('back');
};
