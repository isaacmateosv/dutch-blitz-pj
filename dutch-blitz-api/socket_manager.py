from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # We store connections in a dictionary. 
        # The key is the room_code, the value is a list of active WebSockets in that room.
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_code: str):
        await websocket.accept()
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        self.active_connections[room_code].append(websocket)

    def disconnect(self, websocket: WebSocket, room_code: str):
        if room_code in self.active_connections:
            self.active_connections[room_code].remove(websocket)
            # Clean up the room if everyone leaves
            if not self.active_connections[room_code]:
                del self.active_connections[room_code]

    async def broadcast(self, message: str, room_code: str):
        # Send a message to everyone in a specific room
        if room_code in self.active_connections:
            for connection in self.active_connections[room_code]:
                await connection.send_text(message)

# Create a single instance of the manager to use across the app
manager = ConnectionManager()
