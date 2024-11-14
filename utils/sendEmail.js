require("dotenv").config({ path: "./sendgrid.env" });
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendWelcomeEmail(email, username) {
    const msg = {
        to: email,
        from: "junhuawei08@gmail.com", // Replace with a verified sender email
        subject: "Welcome to Boomerang!",
        text: `Hi ${username}, welcome to Boomerang! We're excited to have you onboard.`,
        html: `<strong>Hi ${username}</strong>,<br><br>Welcome to Boomerang! We're excited to have you onboard.<br>Let us know if you have any questions!`,
    };

    try {
        await sgMail.send(msg);
        console.log("Welcome email sent successfully");
    } catch (error) {
        console.error("Error sending welcome email:", error);
        if (error.response) {
            console.error("SendGrid response error:", error.response.body);
        }
    }
}

module.exports = sendWelcomeEmail;
