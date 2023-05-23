const express = require("express");
const app = express();
let http = require("http").Server();
let minimist = require("minimist");
let io = require("socket.io")(http);
const kurento = require("kurento-client");

let kurentoClient = null;
let iceCandidateQueues = {};

let argv = minimist(process.argv.slice(2), {
  default: {
    as_uri: "http://localhost:3000",
    ws_uri: "ws://localhost:8888/kurento",
  },
});

io.on("connection", (socket) => {
  socket.on("message", (message) => {
    switch (message.event) {
      case "joinRoom":
        joinRoom(socket, message.userName, message.roomName, (err) => {
          if (err) {
            console.log(err);
          }
        });
        break;
      case "receiveVideoRoom":
        receiveVideoFrom(
          socket,
          message.userid,
          message.roomName,
          message.sdpOffer,
          (err) => {
            if (err) {
              console.log(err);
            }
          }
        );
        break;
      case "candidate":
        addIceCandidate(
          socket,
          message.userid,
          message.roomName,
          message.candidate,
          (err) => {
            if (err) {
              console.log(err);
            }
          }
        );
        break;
    }
  });
});

function joinRoom(socket, username, roonname, callback) {
  getRoom(socket, roonname, (err, myRoom) => {
    if (err) {
      return callback(err);
    }
  });

  myRoom.pipeline.create("WebRtcEndpoint", (err, outgoingMedia) => {
    if (err) {
      return callback(err);
    }
    let user = {
      id: socket.id,
      name: username,
      outgoingMedia: outgoingMedia,
      incomingMedia: {},
    };

    let iceCandidateQueue = iceCandidateQueues[user.id];
    if (iceCandidateQueue) {
      while (iceCandidateQueue.length) {
        let ice = iceCandidateQueue.shift();
        user.outgoingMedia.addIceCandidate(ice.candidate);
      }
    }

    user.outgoingMedia.on("OnIceCandidate", (event) => {
      let candidate = kurento.register.complexTypes.IceCandidates(
        event.candidate
      );
      socket.emit("message", {
        event: "candidate",
        userid: user.id,
        candidate: candidate,
      });
    });

    socket.to(roomname).emit("message", {
      event: "newParticipantArrived",
      userid: user.id,
      username: user.name,
    });

    let existingusers = [];
    for (let i in myRoom.participants) {
      if (myRoom.participants[i].id != user.id) {
        existingusers.push({
          id: myRoom.participants[i].id,
          name: myRoom.participants[i].name,
        });
      }
    }

    socket.emit("message", {
      event: "existingParticipants",
      existingusers: existingusers,
      userid: user.id,
    });

    myRoom.participants[user.id] = user;
  });
}

function getKurentoClient(callback) {
  if (kurentoClient != null) {
    return callback(null, kurentoClient);
  }

  kurento(argv.ws_uri, (err, _kurentoClient) => {
    if (err) {
      console.log(err);
      return callback(err);
    }
    kurentoClient = _kurentoClient;
    callback(null, kurentoClient);
  });
}

function getRoom(socket, roomname, callback) {
  let myRoom = io.sockets.adapter.rooms[roomname] || { length: 0 };
  let numClients = myRoom.length;

  if (numClients == 0) {
    socket.join(roomname, () => {
      myRoom = io.sockets.adapter.rooms[roomname];
      getKurentoClient((err, kurento) => {
        kurento.create("MediaPipeline", (err, pipeline) => {
          myRoom.pipeline = pipeline;
          myRoom.participants = {};
          callback(null, myRoom);
        });
      });
    });
  } else {
    socket.join(roomname);
    callback(null, myRoom);
  }
}

app.use(express.static("public"));

http.listen(3000, () => {
  console.log("listening");
});
