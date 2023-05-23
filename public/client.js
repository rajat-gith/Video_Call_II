let divRoomSelection = document.getElementById("roomSelection");
let divMeetingRoom = document.getElementById("meetingRoom");
let inputRoom = document.getElementById("room");
let inputName = document.getElementById("name");
let btnRegister = document.getElementById("register");

//variable
let roomName;
let userName;
let participants = {};

let socket = io();

btnRegister.onclick = () => {
  roomName = inputRoom.value;
  userName = inputName.value;

  if (roomName == "" || userName == "") {
    alert("Please enter a room name and a name");
  } else {
    let message = {
      event: "joinRoom",
      userName: userName,
      roomName: roomName,
    };

    sendMessage(message);
    divRoomSelection.style = "display:none;";
    divMeetingRoom.style = "display:block;";
  }
};

socket.on("message", (message) => {
  console.log("Message arrived", message.event);

  switch (message.event) {
    case "newParticipantArrived":
      receiveVide(message.userid, message.username);
      break;
    case "existingParticipant":
      onExistingParticipant(message.userid, message.existingUsers);
      break;
    case "receiveVideoAnswer":
      onReceiveVideoAnswer(message.senderid, message.sdpAnswer);
      break;
    case "candidate":
      addIceCandidate(message.userid, message.candidate);
      break;
  }
});

function sendMessage(message) {
  socket.emit("message", message);
}
