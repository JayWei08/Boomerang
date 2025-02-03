const User = require('../models/user');

// Language options available
const availableCurrencies = ['THB', 'USD']; // Add more as needed

// Render language selection page
exports.renderLanguageSelectionPage = (req, res) => {
    res.render('yourView', { availableCurrencies, selectedCurrency: (req.session.cookiesBool) ? req.session.currency : 'THB' });
};

// Handle currency selection
exports.setCurrency = async (req, res) => {
    const { currency } = req.body;
    if (!availableCurrencies.includes(currency)) {
        return res.status(400).json({error: "Invalid currency"});
    }

    try {
        // Updating User's prefence & session currency
        if (req.isAuthenticated()) {
            const user = await User.findById(req.user._id);
            if (!user) {return res.status(404).json({ error: 'User not found' });}
        
            if (user.cookiesBool) {
                user.currency = currency;
                await user.save();
                
                req.session.cookiesBool = user.cookiesBool;
            }
        }
    
        // Reading from session to update currency
        if (req.session && req.session.cookiesBool) {
            req.session.currency = currency; // Sets the session currency
            req.session.save((err) => {
                if (err) {
                    console.error("Error saving session:", err);
                    return res.status(500).json({ message: "Internal Server Error" });
                }
            });
        }
    
        return res.status(200).json({ message: "Language set" });
    } catch (err) {
        console.error('Error updating currency:', err);
        return res.status(500).json({ error: "Internal server error" });
    }

};
