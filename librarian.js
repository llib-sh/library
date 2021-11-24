#! /usr/bin/env node
const fs = require('fs');
const ch = require('cipherhash');
const io = require('socket.io-client');
const path = require('path');
const Peer = require('simple-peer');
const wrtc = require('wrtc');
const yargs = require('yargs');
const pepsin = require('pepsin');
const {table,getBorderCharacters} = require('table');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const options = yargs
 .usage("Usage: -f <files> -t <token> -a <user> -o <offer>")
 .option("f", { alias: "files", describe: "Route to store hosted files", type: "string", demandOption: true })
 .option("t", { alias: "token", describe: "Your unique token given at sign up", type: "string", demandOption: true })
 .option("u", { alias: "user", describe: "Your user id given at sign up", type: "string", demandOption: true })
 .option("o", { alias: "offer", describe: "Your minimum accepted offer in cents USD", type: "string", demandOption: true })
 .option("l", { alias: "log", describe: "Enable logging", type: "boolean" })
 .option("q", { alias: "quiet", describe: "Quiet mode", type: "boolean" })
 .option("h", { alias: "host", describe: "Third party host api", type: "string" })
 .argv;

let host = options.host || "http://llib.sh/dwey";
const socket = io(`ws://${new URL(host).hostname}${new URL(host).port!=""?":"+new URL(host).port:""}/`);
let filePath = options.files; // ./files
let token = options.token; // "sdajklhjlkhdsajkhsadhjkhjlkdsahjlksadjlhkjldhksa"
let user = options.user; // "618ea428eac7f3bf126031b8"
let minOffer = options.offer; // 0.01
let logging = options.log;
let quiet = options.quiet;

if (fs.existsSync(path.join(filePath,filePath+".json"))) {
  fileMap = JSON.parse(fs.readFileSync(path.join(filePath,filePath+".json")));
} else {
  fileMap = [];
  fs.writeFileSync(path.join(filePath,filePath+".json"), "[]");
}

const stats = [
  ['Stat',"Value"],
  ['Total Files', fileMap.length],
  ['Total Requests', 0],
  ['Total Packets [15kb]', 0],
  ['Current Requests', 0]
];
tests
const config = {
  header: {
    alignment: 'center',
    content: 'LIBRARIAN\nLive Stat Read-Out\nRoot: '+filePath,
  },
  border: getBorderCharacters(`norc`)
}

let logs = ``;
let log = () => {}

if (logging && !quiet) {
  log = console.log;
} else if (!quiet) {
  log = (msg) => {
    logs += msg+"\n";
  };
  setInterval(() => {
    console.clear();
    stats[1][1] = fileMap.length;
    console.log(center(table(stats, config)));
  },50)
}

socket.on("connect", (msg) => {
  log("connect");
});

socket.on("REQ", async (msg) => {
  log(msg);
  stats[2][1] += 1;
  stats[4][1] += 1;
  let msgSplit = msg.split(" ");
  let contractId = msgSplit[0];
  let fileId = msgSplit[1];
  let offer = parseFloat(msgSplit[2]);
  if (fileMap.indexOf(fileId) == -1) {
    const res = await fetch(`${host}/download/${fileId}`);
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(path.join(filePath,fileId+".lib"));
      res.body.pipe(fileStream);
      res.body.on("error", (err) => {
        reject(err);
      });
      fileStream.on("finish", function() {
        fileMap.push(fileId);
        fs.writeFileSync(path.join(filePath,filePath+".json"), JSON.stringify(fileMap));
        resolve();
      });
    });
  }
  if (offer >= minOffer) {
    const peer = new Peer({wrtc: wrtc});
    peer.on("error", (err) => {
      log(err);
    })
    let myId = pepsin();
    log(myId);
    let sdpSize = 0;
    socket.on("R"+myId, (data) => {
      log("RX");
      log(data);
      sdpSize = parseInt(data.sdp.trim().split("\n").pop().split(":")[1])-300;
      stats[3][0] = `Total Packets [${parseInt(sdpSize/1000)}kb]`
      log(sdpSize);
      let sent = false;
      peer.on("signal", (mySig) => {
        if (sent) {
          return ;
        }
        sent = true
        log(mySig);
        log("emit", contractId);
        socket.emit("contract", {data:{data:mySig,id: myId,action:"CONN INFO"},id:contractId});
      });
      peer.signal(data);
      log(path.join(filePath,"./"+fileId+".lib"));
      fs.readFile(path.join(filePath,"./"+fileId+".lib"), (err, fileBuffer) => {
        if (!err) {
          let fbSplit = fileBuffer.toString("binary").split("");
          let file = [];
          if (fbSplit.length/256 >= sdpSize) {
            file = chunk(fbSplit,fbSplit.length/256);
          } else {
            file = chunk(fbSplit,sdpSize);
          }
          peer.on('data', async (packetid) => {
            log(packetid.toString());
            let packetSplit = packetid.toString().split(" ");
            if (packetSplit[0] == "PACKET") {
              if (parseInt(packetSplit[1]) <= file.length-1) {
                let packet = file[parseInt(packetSplit[1])];
                let chunks = [packet]
                if (packet.length > sdpSize) {
                  chunks = chunk(packet, sdpSize);
                }
                chunks.forEach((item, i) => {
                  stats[3][1] += 1;
                  log(`Sending Packet: ${packetSplit[1]} Chunk: ${chunks.length-1} Size: ${item.length}`);
                  peer.send(`DATA ${packetSplit[1]} ${i} ${chunks.length-1} ${auth(token)} ${user} ${item.join("")}`);
                });
              } else {
                stats[4][1] -= 1;
                log("Killing");
                peer.send(`DATA END ${packetSplit[1]}`);
              }
            }
          });
        }
      });

      peer.on('disconnect', () => {
        log("Connection closed");
        peer.destroy();
      });
    });
    // Init the connection
    log("Emitting");
    socket.emit("contract", {
      data: {
        id: myId,
        action: "REQ CONN"
      },
      id: contractId
    });
  }
});

socket.on("disconnect", (msg) => {
  log("disconnect");
});

function auth(token) {
  let time = parseInt(new Date().getTime()/30000);
  return ch.cipherHash(time.toString(),token);
}

function chunk(arr,n){
  var r = Array(Math.ceil(arr.length/n)).fill();
  return r.map((e,i) => arr.slice(i*n, i*n+n));
}

function center(text) {
  let t = text.split("\n");
  let width = parseInt((process.stdout.columns/2)-(t[0].length/2));
  let height = parseInt((process.stdout.rows/2)-(t.length/2));
  // console.log(height);
  for (var i = 0; i < t.length; i++) {
    let line = t[i];
    t[i] = new Array(Math.max(width,0)).fill(" ").join("")+t[i];
  }
  return new Array(Math.max(height,0)).fill("\n").concat(t.join("\n")).concat(new Array(Math.max(height,0)).fill("\n").join("")).join("");
}
