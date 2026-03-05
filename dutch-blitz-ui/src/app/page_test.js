"use client";

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  // UI State
  const [isInRoom, setIsInRoom] = useState(false);
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  
  // Game State
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  
  // WebSocket Reference (persists across renders without triggering a re-render)
  const ws = useRef(null);

  // Handle the connection
  const joinRoom = () => {
    if (!username || !roomCode) return;

    // Connect to your FastAPI backend
    ws.current = new WebSocket(`ws://localhost:8000/ws/${roomCode}/${username}`);

    ws.current.onmessage = (event) => {
      // Add incoming messages to our state array
      setMessages((prev) => [...prev, event.data]);
    };

    setIsInRoom(true);
  };

  // Clean up the connection if the user leaves the page
  useEffect(() => {
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const sendMessage = () => {
    if (ws.current && currentInput) {
      ws.current.send(currentInput);
      setCurrentInput('');
    }
  };

  // --- MINIMALIST GAMING UI ---
  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <div className="flex flex-col gap-4 bg-neutral-900 p-8 rounded-xl shadow-2xl border border-neutral-800 w-96">
          <h1 className="text-3xl font-bold tracking-wider text-center mb-4">BLITZ<span className="text-emerald-500">ROOM</span></h1>
          <input 
            className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            placeholder="Username" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
          />
          <input 
            className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            placeholder="Room Code" 
            value={roomCode} 
            onChange={(e) => setRoomCode(e.target.value)} 
          />
          <button 
            className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-md font-bold tracking-wide transition mt-2"
            onClick={joinRoom}
          >
            JOIN LOBBY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-8 text-white flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-8 border-b border-neutral-800 pb-4">
          <h2 className="text-2xl font-bold">Room: <span className="text-emerald-500">{roomCode}</span></h2>
          <span className="bg-neutral-800 px-4 py-1 rounded-full text-sm">Playing as {username}</span>
        </div>

        <div className="bg-neutral-900 h-96 rounded-xl border border-neutral-800 p-4 mb-4 overflow-y-auto shadow-inner flex flex-col gap-2">
          {messages.map((msg, idx) => (
            <div key={idx} className="bg-neutral-800 p-3 rounded-md w-fit max-w-[80%]">
              {msg}
            </div>
          ))}
        </div>

        <div className="flex gap-2 w-full">
          <input 
            className="flex-1 p-4 bg-neutral-900 rounded-xl border border-neutral-800 focus:outline-none focus:border-emerald-500 transition"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            placeholder="Submit score or message..."
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button 
            className="p-4 px-8 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition"
            onClick={sendMessage}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}