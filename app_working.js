//jshint esversion:6
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
// const LinkedInStrategy = require('passport-linkedin').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const https = require('https');

const app = express();

// linkedin app settings
const Linkedin = require('node-linkedin')(process.env.LINKEDIN_KEY, process.env.LINKEDIN_SECRET);
Linkedin.auth.setCallback('http://localhost:3000/auth/google/secrets');


app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: 'Our little secret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://localhost:27017/userDB', {useNewUrlParser: true});
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  secret: String,
  linkedinId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new LinkedInStrategy({
    clientID: process.env.LINKEDIN_KEY,
    clientSecret: process.env.LINKEDIN_SECRET,
    callbackURL: "http://localhost:3000/auth/linkedin/secrets",
    scope: ['r_emailaddress', 'r_liteprofile', 'w_member_social'],
    passReqToCallback: true,
    userProfileURL: 'https://api.linkedin.com/v2/me'
},
function (req, accessToken, refreshToken, profile, done) {
	req.session.accessToken = accessToken;
  console.log(accessToken);
    process.nextTick(function () {
        return done(null, profile);
	});
}));

//Original
// passport.use(new LinkedInStrategy({
//   clientID: process.env.LINKEDIN_KEY,
//   clientSecret: process.env.LINKEDIN_SECRET,
//   callbackURL: "http://localhost:3000/auth/linkedin/secrets",
//   scope: ['r_emailaddress', 'r_basicprofile'],
// }, function(accessToken, refreshToken, profile, done) {
//   // asynchronous verification, for effect...
//   process.nextTick(function () {
//     // To keep the example simple, the user's LinkedIn profile is returned to
//     // represent the logged-in user. In a typical application, you would want
//     // to associate the LinkedIn account with a user record in your database,
//     // and return that user instead.
//     return done(null, profile);
//   });
// }));


app.get('/', function(req, res){
  res.render('home');
});

app.get('/auth/google',
  passport.authenticate('google', {scope:['profile']})
);

//google authentication
app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/secrets');
  });

//facebook authentication
app.get('/auth/facebook',
passport.authenticate('facebook'));

app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

  // linkedin - for auth
  app.get('/auth/linkedin',
    passport.authenticate('linkedin', { state: 'SOME STATE'  }),
    function(req, res){
      // The request will be redirected to LinkedIn for authentication, so this
      // function will not be called.
  });

  // linkedin - for callback
  app.get('/auth/linkedin/secrets', passport.authenticate('linkedin', { failureRedirect: '/' }),
  function (req, res) {
      res.redirect('/');
  });


  app.get('/companies', function (req, res) {

      var user_companies = null;
      if (req.session.accessToken != undefined) {
          var linkedin = Linkedin.init(req.session.accessToken);
          linkedin.companies.asAdmin(function (err, companies) {
              this.user_companies = companies;

              res.json(this.user_companies);
              // now use this data in view
              // e.g.
              // res.render('index', { companies: user_companies });
          });
      }
      else
      {
          console.log(req.session.accessToken);
          res.render('home', { companies: user_companies });
      }
  });


  // // linkedin authentication
  // app.get('/auth/linkedin',
  //   passport.authenticate('linkedin'),
  //   function(req, res){
  //     // The request will be redirected to LinkedIn for authentication, so this
  //     // function will not be called.
  //   });

  // // linkedin callback
  // app.get('/auth/linkedin/secrets', passport.authenticate('linkedin', {
  //   successRedirect: '/',
  //   failureRedirect: '/login'
  // }));

  // original
  // app.get('/auth/linkedin/secrets',
  //   passport.authenticate('linkedin', { failureRedirect: '/login' }),
  //   function(req, res) {
  //     // Successful authentication, redirect home.
  //     res.redirect('/');
  //   });



app.get('/login', function(req, res){
  res.render('login');
});

app.get('/register', function(req, res){
  res.render('register');
});

app.get('/secrets', function(req, res){
  User.find({'secret': {$ne: null}}, function(err, foundUsers){
    if (err){
      console.log(err);
    } else {
      if (foundUsers) {
        res.render('secrets', {usersWithSecrets: foundUsers});
      }
    }
  });
});

app.get('/submit', function(req, res){
  if (req.isAuthenticated()){
    res.render('submit');
  } else {
    res.redirect('/login');
  }
});

app.post('/submit', function(req, res){
  const submittedSecret = req.body.secret;

  console.log(req.user.id);

  User.findById(req.user.id, function(err, foundUser){
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function(){
          res.redirect('/secrets')
        });
      }
    }
  });
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.post('/register', function(req, res){

  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err){
      console.log(err);
      res.redirect('/register');
    } else {
      passport.authenticate('local')(req, res, function(){
        res.redirect('/secrets');
      });
    }
  });

});

app.post('/login', function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate('local')(req, res, function(){
        res.redirect('/secrets');
      });
    }
  });

});

app.listen(3000, function() {
  console.log('Server started on port 3000');
});
