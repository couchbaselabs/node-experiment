var http = require('http');
var url = require('url');
var events = require('events');


function CouchbaseClustermap(bootstrapUri, bucketName, bucketPass) {
  var self = this;
  self.bucketsUri = undefined;
  self.defaultPoolUri = '';
  self.bucketsListUri = '';
  self.bucketWantedStreamingUri = '';
  self.baseReactor = undefined;

  var tUrl = url.parse(bootstrapUri);
  self.httpOptions = {
    host: tUrl.hostname,
    port: tUrl.port,
    path: tUrl.pathname
  }

  self.eventFirer = function(it) {
    console.log('Got an updated thing for you' + it);
    self.emit('updated', it);
  }


  self.bucketFinder = function() {
    console.log("searching for buckets inside " + self.bucketsListUri);
    self.httpOptions.path = this.bucketsListUri;

    var bucketsArray = '';
    var responder = function(res) {
      res.setEncoding('utf8');
      res.once('data', function (chunk) {
        bucketsArray = JSON.parse(chunk);
        var ii;
        for (ii = 0; ii<bucketsArray.length; ii++) {
          if (bucketsArray[ii].name == bucketName) {
            console.log('Found you another');
            self.bucketWantedStreamingUri = bucketsArray[ii].streamingUri;
            console.log('we will set up events on ' +
              self.bucketWantedStreamingUri);
          }
          // set up our event firer
          self.httpOptions.path = self.bucketWantedStreamingUri;
          var streamResponder = function(res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
              self.eventFirer(chunk);
            });
          }
          var sReq = http.get(self.httpOptions, streamResponder);
          sReq.on('error', function(e) {
            console.log('problem with request ' + e.message);
            self.emit('error', 'problem with request ' + e.message);
          });
        }
      });
    }
    var req = http.get(self.httpOptions, responder);
    req.on('error', function(e) {
      console.log('problem with request ' + e.message);
      self.emit('error', 'problem with request ' + e.message);
    });
  }

  // the thing to look up buckets, used later
  self.bucketListLocator = function findTheBucket() {
    self.httpOptions.path = this.defaultPoolUri;

    var defaultPoolInfo = '';
    var responder = function(res) {
      res.setEncoding('utf8');
      res.once('data', function (chunk) {
        defaultPoolInfo = JSON.parse(chunk);
        self.bucketsListUri = defaultPoolInfo.buckets.uri;
        self.bucketFinder();
      });
    }
    var req = http.get(self.httpOptions, responder);
    req.on('error', function(e) {
      console.log('problem with request ' + e.message);
      self.emit('error', 'problem with request ' + e.message);
    });

  };

  // the thing to look up the base, to be used later
  function findTheBase() {
    var clusterPools = '';
    var responder = function(res) {
      res.setEncoding('utf8');
      res.once('data', function (chunk) {
        clusterPools = JSON.parse(chunk);
        var ii;
        for (ii = 0; ii < clusterPools.pools.length; ii++) {
          if (clusterPools.pools[ii].name == "default") {
            self.defaultPoolUri = clusterPools.pools[ii].uri;
          }
        }
        console.log('The default pool seems to be at ' + self.defaultPoolUri);
        self.bucketListLocator();
      });
    }
    var req = http.get(self.httpOptions, responder);
    req.on('error', function(e) {
      console.log('problem with request ' + e.message);
      self.emit('error', 'problem with request ' + e.message);
    });
  }

  findTheBase();

}

// Add the EventEmitter to to our clustermap
CouchbaseClustermap.prototype = new process.EventEmitter();

CouchbaseClustermap.prototype.lemmeKnow = function() {
  var self = this;
  var blank = 'blank';
  self.emit('updated', blank);
};


var somebody = new CouchbaseClustermap('http://localhost:8091/pools',
  'another', '');

somebody.on('updated', function(update) {
  console.log('something has been updated sending an event with ' + update);
});

somebody.on('error', function(e) {
  console.log('ERROR: ' + e);
})

somebody.lemmeKnow();


  
