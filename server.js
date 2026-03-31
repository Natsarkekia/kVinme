const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const waitingUsers = [];
const activePairs = new Map();
const groupUsers = new Set();

app.use(express.static("public"));

function broadcastUserCount() {
  const waitingCount = waitingUsers.length;
  const chattingCount = activePairs.size;
  const groupCount = groupUsers.size;
  const totalUsers = waitingCount + chattingCount + groupCount;

  const msg = JSON.stringify({ type: "userCount", totalUsers });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("New user connected");
  broadcastUserCount();

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "join") {
      ws.username = data.username;

      if (waitingUsers.length > 0) {
        const partner = waitingUsers.shift();
        activePairs.set(ws, partner);
        activePairs.set(partner, ws);

        ws.send(JSON.stringify({ type: "match", username: partner.username }));
        partner.send(JSON.stringify({ type: "match", username: ws.username }));

        broadcastUserCount();
      } else {
        waitingUsers.push(ws);
        ws.send(JSON.stringify({ type: "waiting" }));
        broadcastUserCount();
      }
    }

    if (data.type === "join_group") {
      ws.username = data.username;
      ws.inGroup = true;
      groupUsers.add(ws);

      // tell everyone else in the group that this user joined
      groupUsers.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "user_joined", username: ws.username }));
        }
      });

      broadcastUserCount();
    }

    if (data.type === "message") {
      const partner = activePairs.get(ws);
      if (partner && partner.readyState === WebSocket.OPEN) {
        partner.send(
          JSON.stringify({
            type: "message",
            from: ws.username,
            text: data.text,
          })
        );
      }
    }

    if (data.type === "group_message") {
      groupUsers.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "group_message",
              from: ws.username,
              text: data.text,
            })
          );
        }
      });
    }
  });

  ws.on("close", () => {
    console.log("User disconnected");

    const partner = activePairs.get(ws);
    if (partner && partner.readyState === WebSocket.OPEN) {
      partner.send(JSON.stringify({ type: "partner_left" }));
      activePairs.delete(partner);
    }

    activePairs.delete(ws);

    const index = waitingUsers.indexOf(ws);
    if (index !== -1) waitingUsers.splice(index, 1);

    groupUsers.delete(ws);

    broadcastUserCount();
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});