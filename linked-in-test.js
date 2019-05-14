const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const port = process.env.PORT || 3000;
var path = require('path');

// passport

var passport = require('passport');
var LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;

// linked in

var LINKEDIN_CLIENT_ID = "client_id_here"; // replace this with your own
var LINKEDIN_CLIENT_SECRET = "client_secret_here"; // replace this with your own

var Linkedin = require('node-linkedin')(LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET);

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

passport.use(new LinkedInStrategy({
    clientID: LINKEDIN_CLIENT_ID,
    clientSecret: LINKEDIN_CLIENT_SECRET,
    // local callback url
    callbackURL: "http://127.0.0.1:3000/auth/linkedin/callback",
    scope: ['r_emailaddress', 'r_basicprofile', 'rw_company_admin'],
    passReqToCallback: true
},
    function (req, accessToken, refreshToken, profile, done) {
        req.session.accessToken = accessToken;
        process.nextTick(function () {
            // To keep the example simple, the user's LinkedIn profile is returned to
            // represent the logged-in user. In a typical application, you would want
            // to associate the LinkedIn account with a user record in your database,
            // and return that user instead.
            
            // console.log(profile);
            // return res.json(profile);
            return done(null, profile);
        });
    }));

const app = express();

//configure
app.set('views', __dirname + '/pages');
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(session({
    secret: 'keyboard cat',
    saveUninitialized: false
}));
app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));

app.get('/',
    passport.authenticate('linkedin', { state: 'SOME STATE' }),
    function (req, res) {
        // The request will be redirected to LinkedIn for authentication, so this
        // function will not be called.
    });

app.get('/auth/linkedin/callback', passport.authenticate('linkedin', { failureRedirect: '/' }),
    function (req, res, profile) {
        res.send(req.user);
    });

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
