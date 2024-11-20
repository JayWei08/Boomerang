if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const ExpressError = require("./utils/ExpressError");
const methodOverride = require("method-override");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("./models/user");

const usersRoutes = require("./routes/users");
const projectsRoutes = require("./routes/projects");
const commentsRoutes = require("./routes/comments");
const searchRoute = require("./routes/search");
const authRoutes = require("./routes/auth");
const sendWelcomeEmail = require("./utils/sendEmail"); // Import your email utility
const dbUrl = process.env.DB_URL;

const languageRoutes = require('./routes/languageRoutes');
const currencyRoutes = require('./routes/currencyRoutes');


mongoose
    //  .connect("mongodb://localhost:27017/boomerang") // Ensure the connection string is correct
    .connect(dbUrl)
    .then(() => {
        console.log("MONGO CONNECTION OPEN");
    })
    .catch((err) => {
        console.log("OH NO MONGO CONNECTION ERROR");
        console.log(err);
    });

const app = express();

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60,
    crypto: {
        secret: "thisshouldbeasecret!",
    },
});

store.on("error", function (e) {
    console.log("SESSION STORE ERROR");
});

const sessionConfig = {
    store,
    secret: "thisshouldbeasecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        // expires: Date.now() + 1000 * 10,
        // maxAge: 1000 * 10,
    },
};
app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
// Configure Local Strategy for username/password login
passport.use(new LocalStrategy(User.authenticate()));

// Configure Google Strategy for Google OAuth
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Find a user with the Google ID
                let user = await User.findOne({ googleId: profile.id });

                // If user does not exist, create a new one
                let isNewUser = false;
                if (!user) {
                    user = new User({
                        username: profile.displayName,
                        email: profile.emails[0].value,
                        googleId: profile.id,
                    });
                    await user.save();
                    isNewUser = true; // Mark this as a new user

                    // Send a welcome email to the new user
                    await sendWelcomeEmail(user.email, user.username);
                }

                // Set the isNewUser flag for use in routes
                user.isNewUser = isNewUser;

                // Pass the user to the done function
                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    )
);
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const availableLanguages = ['en', 'th']; // Define available languages
const availableCurrencies = ['USD', 'THB']; 
// Middleware to make availableLanguages and selectedLanguage accessible in all views
app.use((req, res, next) => {
    res.locals.availableCurrencies = availableCurrencies;
    res.locals.selectedCurrency = req.session.currency || 'THB'; 
    res.locals.availableLanguages = availableLanguages;
    res.locals.selectedLanguage = req.session.language || 'th'; // Default to 'en' if no language set in session
    next();
});

// Middleware to ensure language is synchronized with the database and session
app.use(async (req, res, next) => {
    try {
        let language = req.session.language || 'th';
        let currency = req.session.currency || 'THB'; // Default to 'en'

        if (req.isAuthenticated()) {
            // Fetch the language from the database for authenticated users
            const user = await User.findById(req.user._id);
            if (user && user.language) {
                language = user.language;
            }
            if (user && user.currency) {
                currency = user.currency;
            }
        }

        req.language = language; // Store in the request object for convenience
        req.session.language = language; // Ensure session is updated
        res.locals.selectedLanguage = language; // Update locals for views
        req.currency = currency; // Store in the request object for convenience
        req.session.currency = currency; // Ensure session is updated
        res.locals.selectedCurrency = currency; // Update locals for views

        next();
    } catch (error) {
        console.error('Error syncing', error);
        next(error);
    }
});





app.use((req, res, next) => {
    console.log(req.session);
    res.locals.currentUser = req.user;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});





app.use("/", usersRoutes);
app.use("/projects", projectsRoutes);
app.use("/projects/:id/comments", commentsRoutes);
app.use(languageRoutes);
app.use(currencyRoutes);


app.get("/", (req, res) => {
    res.render("home");
});

app.use("/", authRoutes);

// Register the search route
app.use("/", searchRoute);

app.all("*", (req, res, next) => {
    next(new ExpressError("Page Not Found", 404));
});

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = "Oh no, something went wrong!";
    res.status(statusCode).render("error", { err });
});

// Start the server
app.listen(3000, () => {
    console.log("LISTENING ON PORT 3000");
});
