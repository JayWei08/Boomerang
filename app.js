if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

console.time("Express Import");
const express = require("express");
console.timeEnd("Express Import");

console.time("Mongoose Import");
const mongoose = require("mongoose");
console.timeEnd("Mongoose Import");

console.time("Passport Import");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
console.timeEnd("Passport Import");

const path = require("path");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const ExpressError = require("./utils/ExpressError");
const methodOverride = require("method-override");
const User = require("./models/user");

const usersRoutes = require("./routes/users");
const projectsRoutes = require("./routes/projects");
const commentsRoutes = require("./routes/comments");
const searchRoute = require("./routes/search");
const authRoutes = require("./routes/auth");
const sendWelcomeEmail = require("./utils/sendEmail"); // Import your email utility

const languageRoutes = require("./routes/languageRoutes");
const currencyRoutes = require("./routes/currencyRoutes");
const cookiesRoutes = require("./routes/cookies");
const i18n = require("i18n");

console.log("IMPORTS COMPLETED");

mongoose
    //  .connect("mongodb://localhost:27017/boomerang") // Ensure the connection string is correct
    .connect(process.env.DB_URL)
    .then(() => {
        console.log("MONGO CONNECTION OPEN");
    })
    .catch((err) => {
        console.log("MONGO CONNECTION ERROR");
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

// Where sessions are saved
const store = MongoStore.create({
    mongoUrl: process.env.DB_URL,
    touchAfter: 24 * 60 * 60,
    crypto: {
        secret: "tobereplaced", // process.env.STORE_CRYPTO
    },
});

store.on("error", function (e) {
    console.log("SESSION STORE ERROR");
});

const sessionConfig = {
    store: store,
    secret: "toberemoved", // replace that w/ this: process.env.SESSION_SECRET
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // TODO: Set to true for production
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7,
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
                    isNewUser = true;

                    await sendWelcomeEmail(user.email, user.username);
                }

                user.isNewUser = isNewUser;

                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    )
);
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const availableLanguages = ["en", "th"];
const availableCurrencies = ["USD", "THB"];

i18n.configure({
    directory: path.join(__dirname, "locales"),
    locales: availableLanguages,
    defaultLocale: "th",
    cookie: "language",
    autoReload: false,
    updateFiles: false,
    syncFiles: false,
    objectNotation: true,
});

app.use(i18n.init);

// Passes the function that i18n is called from to the front end using res.locals
app.use(async (req, res, next) => {
    res.locals.__ = res.__;
    next();
});

app.use(async (req, res, next) => {
    req.session
    try {
        // res.lcoals.__ is a FRONT END reference for any data put in it
        // req.session.__ is a BACK END quick reference for any data put in it (Only refernce this)
        // user.__ is the actual data that is saved. This saved data is then put into req.session.__ (Only save to this & load from this into req.session.__)

        // Defaults to chosen value unless session or user data exists
        let language = "th";
        let currency = "THB";

        if (req.session.cookiesBool) {
            if (req.session.language) {language = req.session.language;}
            if (req.session.currency) {currency = req.session.currency;}
        }

        // Overwrite session data with user data if available
        if (req.isAuthenticated()) {
            const user = await User.findById(req.user._id);
            if (user && user.cookiesBool) {
                req.session.cookiesBool = user.cookiesBool;

                if (user.language) {language = user.language;} // User data overrides session data
                if (user.currency) {currency = user.currency;} // User data overrides session data

                req.session.language = language;
                req.session.currency = currency;
            } else if (!req.session.cookiesBool) {
                req.session.destroy();
            }
        }

        req.setLocale(language); // Sets i18n or static-multilanguage language

        // Defines variables for global acces (including frontend)
        res.locals.availableLanguages = availableLanguages;
        res.locals.availableCurrencies = availableCurrencies;
        res.locals.selectedLanguage = language;
        res.locals.selectedCurrency = currency;

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
    error = req.flash("error");
    next();
});

app.use("/", usersRoutes);
app.use("/projects", projectsRoutes);
app.use("/projects/:id/comments", commentsRoutes);
app.use(languageRoutes);
app.use(currencyRoutes);
app.use(cookiesRoutes);

app.use("/", authRoutes);

app.use("/", searchRoute);

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
