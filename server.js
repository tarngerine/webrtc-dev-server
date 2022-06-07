const express = require("express"),
  http = require("http"),
  app = express(),
  server = http.createServer(app),
  WebSocket = require("ws");

const wss = new WebSocket.Server({ server, path: "/ws" });

const clients = {}; // Record<UUID, WebSocket>

wss.on("connection", function connection(ws) {
  ws.on("message", function incoming(message) {
    console.log("received: %s", message);

    // When a new user joins, pick another user to sync data over
    try {
      const payload = JSON.parse(message);
      console.log("message parsed", JSON.stringify(payload, null, 2));

      // interface Payload {
      //   event: "join";
      //   id: string;
      // }
      if (payload.event === "join") {
        // store client by client generated ID
        clients[payload.id] = ws;

        // Cleanup handler
        ws.on("close", () => {
          delete clients[payload.id];
        });
      }

      wss.clients.forEach((client) => {
        // dont send payload back to the same client
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(payload));
        }
      });
    } catch (e) {
      console.log("message not valid json", e);
      ws.send(
        JSON.stringify({
          event: "error",
          message: "message not valid json",
        })
      );
    }
  });
});

const port = process.env.NODE_ENV === "production" ? 80 : 3001;
server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
