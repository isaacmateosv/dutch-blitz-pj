from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Guarda las conexiones activas por cada código de sala
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_code: str):
        await websocket.accept()
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        self.active_connections[room_code].append(websocket)

    def disconnect(self, websocket: WebSocket, room_code: str):
        if room_code in self.active_connections:
            if websocket in self.active_connections[room_code]:
                self.active_connections[room_code].remove(websocket)
            
            # Limpieza: Si la sala se queda vacía, borramos el registro para no gastar RAM
            if len(self.active_connections[room_code]) == 0:
                del self.active_connections[room_code]

    async def broadcast(self, message: str, room_code: str):
        if room_code in self.active_connections:
            # Iteramos sobre una copia de la lista (list(...)) para evitar errores 
            # si alguien se desconecta justo en medio del ciclo for.
            for connection in list(self.active_connections[room_code]):
                try:
                    await connection.send_text(message)
                except RuntimeError:
                    # FIX CRÍTICO: El usuario presionó F5 muy rápido y mató el socket
                    # Ignoramos el error y lo desconectamos silenciosamente
                    self.disconnect(connection, room_code)
                except Exception as e:
                    # Cualquier otro error extraño, también lo limpiamos sin colapsar el servidor
                    print(f"Error enviando mensaje a un socket: {e}")
                    self.disconnect(connection, room_code)

manager = ConnectionManager()