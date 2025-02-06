const User = require('../models/user');

// Handle currency selection
exports.setCurrency = async (req, res) => {
    const { currency } = req.body;
    if (!res.locals.availableCurrencies.includes(currency)) {
        return res.status(400).send('Invalid currency');
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
            res.locals.selectedCurrency = currency;

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
