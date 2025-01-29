const User = require('../models/user'); // adjust path as needed

// Language options available
const availableCurrencies = ['THB', 'USD']; // Add more as needed

// Render language selection page
exports.renderLanguageSelectionPage = (req, res) => {
    res.render('yourView', { availableCurrencies, selectedCurrency: (req.session.cookiesBool) ? req.session.currency : 'THB' });
};

// Handle language selection
exports.setCurrency = async (req, res) => {
    const { currency } = req.body;
    if (!availableCurrencies.includes(currency)) {
        return res.status(400).send('Invalid currency');
    }

    if (req.isAuthenticated()) {
        const user = await User.findById(req.user._id);
        if (user.cookiesBool) {
            user.currency = currency;
            await user.save();
            
            req.session.currency = currency;
        }
    }

    // console.log(currency);
    res.redirect('back');
};
