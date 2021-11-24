/**
 * description
 *
 * @class
 * @param  {String} user                    clients user id that will be paying
 * @param  {String} offer                      clients maximum offer to the miner
 * @param  {String} token                      clients unqiue token given at sign up
 * @param  {String} host="http://llib.sh/dwey" (optional) third party DWEY server
 * @return {void}                            void
 */
function Library(user, offer, token, host="http://llib.sh/dwey") {
/**
 * description
 * @param  {String} fileName                    name of file requested
 * @return {Promise} (Response Object)         https://developer.mozilla.org/en-US/docs/Web/API/Response
 */
  this.get = (fileName) => {
    return new Promise(async function(resolve, reject) {
      let contractId = pepsin();
      const socket = io(`${new URL(host).hostname}${new URL(host).port!=""?":"+new URL(host).port:""}/`);
      socket.on("connect", async () => {
        const p = new Simple({
          initiator: true
        }, socket, contractId);

        let packets = [];
        let currentPacket = 0;
        let packetCounter = [];
        let killed = false;

        p.on('connect', (id) => {
          p.send(id,`PACKET ${currentPacket}`);
          packetCounter[currentPacket] = 0;
          currentPacket++;
        });
        let endPacket = undefined;
        p.on('data', function(d) {
          let id = d[0];
          let msg = d[1];
          let msgSplit = msg.toString().split(" ");
          // DATA packetid numofpacket amountofpackets token user data...
          if (msgSplit[0] == "DATA" && msgSplit[1] != "END") {
            if (typeof packets[parseInt(msgSplit[1])] == "undefined") {
              packets[parseInt(msgSplit[1])] = [];
            }
            packets[parseInt(msgSplit[1])][parseInt(msgSplit[2])] = {
              token: msgSplit[4],
              user: msgSplit[5],
              data: msgSplit.slice(6).join(" ")
            }
            // number of chunks received for the current (last) packet are all there
            if ([...new Set(packets[parseInt(msgSplit[1])])].length-1 >= parseInt(msgSplit[3])) {
              packetCounter[parseInt(msgSplit[1])] = 1;
            }
          }
          if (msg.toString().slice(0,8) == "DATA END" && !endPacket) {
            endPacket = parseInt(msgSplit[2]);
          }
          // IF (the number of packets is >= 255 and the number of chunks received for the current (last) packet are all there)
          // or the message has END in it and the number of filled packets are equal to the end packet send by the DATA END # command
          if ((parseInt(msgSplit[1]) >= 255 && [...new Set(packets[parseInt(msgSplit[1])])].length-1 >= parseInt(msgSplit[3])) || msgSplit[1] == "END" && packetCounter.reduce((a, b) => a + b, 0) == endPacket && !killed) {
            killed = true;
            p.destroy(id);
            let fileData = ``;
            let newPackets = [];
            for (var i = 0; i < packets.length; i++) {
              let dp = "";
              packets[i].forEach((item, i) => {
                dp += item.data
              });
              fileData += dp;
              newPackets[i] = {
                data: dp.length,
                token: packets[i][0].token,
                user: packets[i][0].user
              };
            }
            let base64 = btoa(fileData);
            // console.log(base64);
            // console.log(fileData);
            let mime = detectMimeType(base64);
            // console.log(mime);
            resolve(fetch(`data:${mime};base64,${base64}`).catch(reject));
            fetch(`${host}/close`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'contract': contractId,
                'token': auth(token),
                'user': user,
                'file': fileName
              },
              body: JSON.stringify(newPackets)
            });
          } else {
            if ([...new Set(packets[parseInt(msgSplit[1])])].length-1 >= parseInt(msgSplit[3])) {
              p.send(id,`PACKET ${currentPacket}`);
              currentPacket++;
            }
          }
        });
        p.init();
        await fetch(`${host}/${user}/${auth(token)}/${fileName}/${offer}`,{
          method: 'GET',
          headers: {
            "contract": contractId
          }
        });
      });
    });
  }
/**
 * description
 * @param  {String} data                    this data needs to be a {String} to work properly
 * @return {Object} {sucess: true, hash: "SHA256 hash of the file data"}
 */
  this.post = (data) => {
    return new Promise(function(resolve, reject) {
      fetch(`${host}/upload`, {
        method: 'POST',
        headers: {
          'token': auth(token),
          'user': user
        },
        body: data
      }).then(res=>res.json()).then(resolve).catch(reject);
    });
  }
  function auth(token) {
    let time = parseInt(new Date().getTime()/30000);
    return cipherHash(time.toString(),token);
  }
  function pepsin() {
    return (new Date().getTime()+parseInt(Math.random()*1000000).toString(16));
  };
}
