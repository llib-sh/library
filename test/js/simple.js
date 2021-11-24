function Simple(options, socket, contractId) {
  let connections = {};
  let connectionsState = {};
  let handlers = {}
  this.init = () => {
    socket.on("C"+contractId, (data) => {
      let connId = data.id;
      if (data.action == "REQ CONN") {
        connectionsState[connId] = false
        connections[connId] = new SimplePeer({
          initiator: true
        });
        let sent = false;
        connections[connId].on('signal', async (data) => {
          if (sent) {
            return null;
          }
          sent = true;
          socket.emit("return", {data:data,id:connId});
        });
      } else if (data.action == "CONN INFO" && !connectionsState[connId]) {
        connectionsState[connId] = true;
        connections[connId].signal(data.data);
        connections[connId].on("connect", () => {
          emit("connect", connId);
        });
        connections[connId].on("data", (msg) => {
          emit("data", [connId,msg]);
        });
      }
    });
  }

  this.send = (id, msg) => {
    connections[id].send(msg);
  }

  this.on = (eventName, handler) => {
    if (!handlers[eventName]) {
      handlers[eventName] = [];
    }
    handlers[eventName].push(handler);
  }
  this.destroy = (id) => {
    connections[id].destroy();
  }
  function emit(eventName, data) {
    // console.log(handlers[eventName]);
    for (const handler of handlers[eventName])
      handler(data);
  }
}
