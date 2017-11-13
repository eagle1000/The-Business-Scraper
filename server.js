// Dependencies
var express = require("express");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var path = require("path");
var methodOverride = require("method-override");
var request = require("request");
var cheerio = require("cheerio");
var logger = require("morgan");
var axios = require("axios");
// Database models to require
var Note = require("./models/note.js");
var Article = require("./models/article.js");

// Initialize Express
var app = express();
var PORT = process.env.PORT || 3000;
// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body parser with our app
app.use(bodyParser.urlencoded({
  extended: false
}));

// override with POST having ?_method=PUT
app.use(methodOverride('_method'));

// Make public a static dir
app.use(express.static("./public"));

// Set Handlebars.
var exphbs = require("express-handlebars");

app.set('views', __dirname + '/views');
app.engine("handlebars", exphbs({ defaultLayout: "main", layoutsDir: __dirname + "/views/layouts" }));
app.set("view engine", "handlebars");

// Set mongoose to leverage built in JavaScript ES6 Promises
mongoose.Promise = Promise;
// Connect to mongo database
mongoose.connect("mongodb://localhost/testscrape100", {
  useMongoClient: true
});

var db = mongoose.connection;

// Routes
app.get("/", function (req, res) {
  Article.find({})
    .exec(function (error, data) {
      if (error) {
        res.send(error);
      }
      else {
        var newsObj = {
          Article: data
        };
        res.render("index", newsObj);
      }
    });
});

// // A GET route for scraping the new york times website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("https://www.nytimes.com/section/business", function(error, response, html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);
    // Now, we grab every h1 within an article tag, and do the following:
    $(".story").each(function(i, element) {

      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this).children(".story-body").children("h2")
        .children("a")
        .text();
      result.link = $(this).children(".story-body").children("h2")
        .children("a")
        .attr("href");
      result.summary = $(this).children(".story-body")
        .children(".summary")
        .text();
      result.image = $(this).children(".photo").children("a").children("img").attr("src");
      // Using our Article model, create a new entry
      // This effectively passes the result object to the entry.
      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        // Or log the doc
        else {
          console.log(doc);
        }
      });

    });
    res.redirect("/");
    console.log("Successfully Scraped");
  });
});

// Route for saving/updating an Article's associated Note
app.post("/notes/:id", function (req, res) {
  var newNote = new Note(req.body);
  newNote.save(function (error, doc) {
    if (error) {
      console.log(error);
    }
    else {
      Article.findOneAndUpdate({
        "_id": req.params.id
      },
        { $push: { "note": doc._id } }, {new: true},  function (err, doc) {
          if (err) {
            console.log(err);
          } else {
            console.log("note saved: " + doc);
            res.redirect("/notes/" + req.params.id);
          }
        });
    }
  });
});

// Get route for notes
app.get("/notes/:id", function (req, res) {
  console.log("This is the req.params: " + req.params.id);
  Article.find({
    "_id": req.params.id
  }).populate("note")
    .exec(function (error, doc) {
      if (error) {
        console.log(error);
      }
      else {
        var notesObj = {
          Article: doc
        };
        console.log(notesObj);
        res.render("notes", notesObj);
      }
    });
});

// Delete route for notes
app.get("/delete/:id", function (req, res) {
  Note.remove({
    "_id":req.params.id
  }).exec(function (error, doc) {
    if (error) {
      console.log(error);
    }
    else {
      console.log("note deleted");
      res.redirect("/" );
    }
  });
});

// Listen on port 3000
app.listen(PORT, function() {
  console.log("App running on PORT" + PORT + "!");
});