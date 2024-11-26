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

const languageRoutes = require("./routes/languageRoutes");
const currencyRoutes = require("./routes/currencyRoutes");
const i18n = require("i18n");

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

passport.use(new LocalStrategy(User.authenticate()));

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

const availableLanguages = ['en', 'th'];
const availableCurrencies = ["USD", "THB"];

i18n.configure({
    locales: ['en', 'th'],
    directory: path.join(__dirname, "locales"),
    defaultLocale: "th",
    cookie: "language",
    autoReload: true,
    updateFiles: false,
    syncFiles: false,
    objectNotation: true,
});

app.use(i18n.init);

app.use(async (req, res, next) => {
    try {
        let language = req.query.language || req.session.language || "th";
        let currency = req.query.language || req.session.currency || "THB";

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
        
        console.log(language);
        console.log(availableLanguages.includes(language));
        req.setLocale(language);
        console.log(language + " " + req.getLocale());
        req.session.language = language;
        res.locals.selectedLanguage = language;
        res.locals.availableLanguages = availableLanguages;
        
        req.currency = currency;
        req.session.currency = currency;
        res.locals.selectedCurrency = currency;
        res.locals.availableCurrencies = availableCurrencies;

        next();
    } catch (error) {
        console.error("Error syncing", error);
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

app.use("/", authRoutes);

// Register the search route
app.use("/", searchRoute);

// Redirects user to /projects page if they go to /
app.get("/", (req, res) => {
    res.redirect("/projects");
});

app.get("/about", (req, res) => {
    res.render("about/about.ejs");
});

app.get("/how-boomerang-works", (req, res) => {
    res.render("about/how-it-works.ejs");
});

app.get("/faq", (req, res) => {
    res.render("usefulLinks/faq.ejs");
});

app.get("/rules", (req, res) => {
    res.render("usefulLinks/rules.ejs");
});

app.get("/creators", (req, res) => {
    res.render("usefulLinks/creators.ejs");
});

app.get("/nonprofit-resources", (req, res) => {
    res.render("usefulLinks/non-profit.ejs");
});

app.get("/prohibited-content", (req, res) => {
    res.render("usefulLinks/prohibitedContent.ejs");
});

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
