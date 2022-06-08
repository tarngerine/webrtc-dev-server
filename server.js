const express = require("express"),
  http = require("http"),
  app = express(),
  server = http.createServer(app),
  WebSocket = require("ws");

const wss = new WebSocket.Server({ server, path: "/ws" });

// A room in websocket is a generic concept: a pool of sockets that broadcast to each other
// this follows common language in popular libraries like socket.io
// A websocket can request to be moved to a room, or be in multiple rooms at once
// In Realm terms, we can use a room for Realm Rooms OR Channels... just providing their ID as the websocket room ID

// Store references to each socket
// Record<SocketID, WebSocket>
let socketIdInc = 0;
const sockets = {};
// Record<RoomID, Set<SocketID>>
const rooms = {};

wss.on("connection", function connection(ws) {
  // Store the socket
  const wsId = socketIdInc++;
  sockets[wsId] = ws;
  console.log("New websocket connection:", wsId);

  ws.on("message", function incoming(message) {
    // console.log("received: %s", message);

    try {
      const payload = JSON.parse(message);
      // console.log("message parsed", JSON.stringify(payload, null, 2));

      switch (payload.event) {
        // interface JoinPayload {
        //   event: "join";
        //   roomId: string;
        // }
        case "join": {
          // create a set for room if it doesn't exist
          rooms[payload.roomId] = rooms[payload.roomId] || new Set();
          // add the socket to the room
          rooms[payload.roomId].add(wsId);
          console.log("Socket", wsId, "joined room", payload.roomId);

          // Cleanup handler when socket closes
          ws.on("close", () => {
            rooms[payload.roomId].delete(wsId);
            console.log("Socket", wsId, "closed");
            // Clean up room if empty
            if (rooms[payload.roomId].size === 0) {
              delete rooms[payload.roomId];
            }
          });
          break;
        }
        // interface LeavePayload {
        //   event: "leave";
        //   roomId: string;
        // }
        case "leave": {
          rooms[payload.roomId].delete(wsId);
          console.log("Socket", wsId, "left room", payload.roomId);
          // Clean up room if empty
          if (rooms[payload.roomId].size === 0) {
            delete rooms[payload.roomId];
          }
          break;
        }
      }

      // Pass through payloads to other sockets in the same room as this one
      // Find all rooms with this socketId
      const roomsWithSocket = Object.keys(rooms).filter((roomId) =>
        rooms[roomId].has(wsId)
      );
      // Find all other sockets in those rooms
      const otherSocketIds = roomsWithSocket.reduce((acc, roomId) => {
        acc.push(
          ...rooms[roomId]
          // TEMPORARY: send payload back to current client to test
          // .filter((socketId) => socketId !== wsId)
        );
        return acc;
      }, []);
      const otherSockets = otherSocketIds.map((socketId) => sockets[socketId]);

      // Send the message to all other sockets
      otherSockets.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(payload));
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
