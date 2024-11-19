const axios = require("axios");
const jwt = require("jsonwebtoken");

function generateJWTToken(payload) {
    return jwt.sign(payload, process.env.secretKey, { algorithm: "HS256" });
}

async function createPaymentToken(invoiceNo, description, amount, currencyCode) {
    const payload = {
        merchantID: config.merchantID,
        invoiceNo, // Unique for each transaction
        description,
        amount: parseFloat(amount).toFixed(2), // Ensure two decimal places
        currencyCode
    };

    // Generate JWT Token
    const jwtToken = generateJWTToken(payload);

    try {
        // Send request to the Payment Token API
        const response = await axios.post(process.env.sandboxUrl, {
            payload: jwtToken
        });

        // Decode response
        const decodedResponse = jwt.verify(response.data.payload, process.env.secretKey);
        return decodedResponse;
    } catch (error) {
        console.error("Error in payment token request:", error.message);
        throw error;
    }
}

module.exports = { createPaymentToken };