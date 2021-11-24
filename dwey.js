const fs = require('fs');
const ch = require('cipherhash');
const fastify = require("fastify");
const fastifyIO = require("fastify-socket.io");
const path = require('path');
const pepsin = require('pepsin');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');

const AWSKeys = JSON.parse(fs.readFileSync("./rootkey.json").toString());

//configuring the AWS environment
AWS.config.update({
  accessKeyId: AWSKeys.AWSAccessKeyId,
  secretAccessKey: AWSKeys.AWSSecretKey
});

let s3 = new AWS.S3();

const uri = 'mongodb+srv://mason:1qaz2wsx%21QAZ%40WSX@llib-dwey-0.d35tj.mongodb.net/dwey?retryWrites=true&w=majority'

// Esablish mongodb connection
mongoose.connect(uri, (err, res) => {
  if(err) {
    console.log(err);
  }
  else {
    console.log('Mongo Connected');
  }
});

// Mongoose Schema
const UserSchema = new mongoose.Schema({
  username: {
    type: String, // Set the type of the field
    required: true // Drop the required field if the username field is optional
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    required: true
  },
  token: {
    type: String,
    required: true
  },
  files: {
    type: Object,
    required: true
  }
});

const User = mongoose.model('users', UserSchema); // Mongoose.model takes 2 args. The first is the collection name, the second is the schema to use for the collection
(async () => {
  let acc = await User.find();
  console.log(acc);
})()
const server = fastify({
  // 100mb limit
  bodyLimit: 1048576*100
});
server.register(require('fastify-cors'), {
  origin: "*",
  methods: ["GET", "POST"],
  credentials: false,
});
server.register(fastifyIO, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
  }
});

let openOffers = JSON.parse(fs.readFileSync("./openOffers.json").toString());

// llib.sh/
server.get("/", (req, reply) => {
  return "Working"
});

// llib.sh/dwey/download/fileid
server.get("/dwey/download/*", (req, reply) => {
  let url = req.url.split("/");
  console.log(url);
  reply.redirect(`https://dwey.s3.us-east-2.amazonaws.com/${url[3]}`);
});

// llib.sh/dwey/upload
server.post("/dwey/upload", async (req, reply) => {
  console.log("Uploaded");
  let data = req.body;
  let account = await User.findById(req.headers.user);
  if (auth(account.token) == req.headers.token) {
    let baseName = ch.hash(data);
    s3.upload({
      Bucket: 'dwey',
      Body : data,
      Key : baseName
    }, async (err, data) => {
      if (data) {
        reply.send({
          sucess: true,
          hash: baseName,
          url: data.Location
        });
        if (!account.files) {
          account.files = {};
        }
        account.files[baseName] = {
          cost: 0,
          views: 0
        };
        await User.findByIdAndUpdate(req.headers.user,account);
      }
    });
  } else {
    reply.send({
      sucess: false
    });
  }
});

// llib.sh/dwey/close
server.post("/dwey/close", async (req, reply) => {
  console.log("Close");
  let data = req.body;
  let packetNumbers = {};
  let closeTime = new Date().getTime();
  let account = await User.findById(req.headers.user);
  let offer = openOffers[req.headers.contract];
  if (auth(account.token) == req.headers.token && offer) {
    for (var i = 0; i < data.length; i++) {
      let packet = data[i];
      let rxer = await User.findById(packet.user);
      console.log(packet,rxer);
      if (rxer != null) {
        let time = deauth(packet.token,rxer.token);
        if (time >= offer.time && time <= closeTime) {
          if (typeof packetNumbers[packet.user] == "undefined") {
            packetNumbers[packet.user] = 0;
          }
          packetNumbers[packet.user] += 1;
        }
      }
    }
    account.balance += offer.offer;

    let keys = Object.keys(packetNumbers);
    for (var i = 0; i < keys.length; i++) {
      let user = await User.findById(keys[i]);
      if (typeof user != "undefined") {
        user.balance += offer.offer*(packetNumbers[user._id]/255);
        account.balance -= offer.offer*(packetNumbers[user._id]/255);
        account.files[req.headers.file].views += 1;
        account.files[req.headers.file].cost += offer.offer*(packetNumbers[user._id]/255);
        await User.findByIdAndUpdate(keys[i],user);
        await User.findByIdAndUpdate(req.headers.user,account);
      }
    }
    delete openOffers[req.headers.contract];
    fs.writeFileSync("./openOffers.json",JSON.stringify(openOffers));
    return "succes";
  } else {
    return "403";
  }
});

// llib.sh/dwey/account ~ Create Account
// to create header needs to say create and add the schema info
// to delete header needs to say delete and the body needs to be  {_id:"id"}
server.post("/dwey/account", (req, reply) => {
  console.log(req.body);
  let body = req.body;
  if (req.headers.action == "create") {
    const user = new User(body);
    user.save((err, obj) => {
      if (err) {
        return err
      }
      return obj
    });
  } else if (req.headers.action == "delete") {
    User.deleteOne({ _id: body._id }, (err) => {
      return {sucess: err != undefined, error: err};
    })
  }
});

// llib.sh/dwey/account/email/"email" ~ Get Account by email address
server.get("/dwey/account/email/*", async (req, reply) => {
  let url = req.url.split("/");
  let account = await User.find({email: url[4]});
  account = JSON.parse(JSON.stringify(account[0]));
  delete account.password;
  delete account.token;
  return account;
});

// llib.sh/dwey/account/email/"email" ~ Get Account by email address
server.get("/dwey/account/username/*", async (req, reply) => {
  let url = req.url.split("/");
  let account = await User.find({username: url[4]});
  account = JSON.parse(JSON.stringify(account[0]));
  delete account.password;
  delete account.token;
  return account;
});

// llib.sh/dwey/account/_id ~ Get Account
server.get("/dwey/account/*", (req, reply) => {
  let url = req.url.split("/");
  return User.findById(url[3]);
});

// llib.sh/dwey/user/token/fileid/offer/
server.get("/dwey/*/*/*/*/*", async (req, reply) => {
  let url = req.url.split("/");
  url.shift();
  console.log(`${url[1]} ${url[2]} ${url[3]} ${url[4]}`);
  let account = await User.findById(url[1]);
  console.log(account);
  let token = auth(account.token);
  if (token == url[2] && account.balance-Math.abs(parseFloat(url[4])) > 0) {
    let id = req.headers.contract;
    // id fileid offer
    server.io.emit('REQ', `${id} ${url[3]} ${url[4]}`);
    openOffers[id] = {
      offer: Math.abs(parseFloat(url[4])),
      file: url[3],
      time: parseInt(new Date().getTime()/30000),
      user: url[1]
    };
    account.balance -= Math.abs(openOffers[id].offer);
    await User.findByIdAndUpdate(url[1],account);
    fs.writeFileSync("./openOffers.json",JSON.stringify(openOffers));
    return id;
  } else {
    return "403";
  }
});

server.ready().then(() => {
  // we need to wait for the server to be ready, else `server.io` is undefined
  server.io.on("connection", (socket) => {
    console.log("Connection");
    socket.on("contract", (data) => {
      console.log("init contract connection",new Date().getTime());
      console.log("C"+data.id);
      server.io.emit("C"+data.id,data.data);
    });
    socket.on("return", (data) => {
      console.log("secondary contract connection");
      console.log("R"+data.id);
      server.io.emit("R"+data.id,data.data);
    })
  });
});

server.listen(3000);

function auth(token) {
  let time = parseInt(new Date().getTime()/30000);
  return ch.cipherHash(time.toString(),token);
}
function deauth(data,token) {
  return parseInt(ch.unCipherHash(data,token))*30000;
}
function chunk(arr,n){
  var r = Array(Math.ceil(arr.length/n)).fill();
  return r.map((e,i) => arr.slice(i*n, i*n+n));
}
