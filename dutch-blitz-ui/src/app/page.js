"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [isInRoom, setIsInRoom] = useState(false);
  const isInRoomRef = useRef(false); 
  
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  
  const [hasLimit, setHasLimit] = useState(true);
  const hasLimitRef = useRef(true); 
  
  const [targetScore, setTargetScore] = useState(75);
  const targetScoreRef = useRef(75); 
  
  const [showSettings, setShowSettings] = useState(false); 
  
  const [onlineCount, setOnlineCount] = useState(1);
  const [messages, setMessages] = useState([]);
  const [playerScores, setPlayerScores] = useState({});
  const [winner, setWinner] = useState(null);
  
  const [isManualMath, setIsManualMath] = useState(true); 
  const [manualScore, setManualScore] = useState("");
  const [blitzCards, setBlitzCards] = useState("");
  const [dutchCards, setDutchCards] = useState("");

  const [recap, setRecap] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const ws = useRef(null);
  const chatRef = useRef(null);
  const winnerDeclared = useRef(false);

  useEffect(() => {
    hasLimitRef.current = hasLimit;
    targetScoreRef.current = targetScore;
  }, [hasLimit, targetScore]);

  // --- NEW: Procedural Audio Pop ---
  const playPopSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.log("Audio not supported");
    }
  };

  // --- NEW: Connection Resilience & Heartbeat Logic ---
  const connectWebSocket = () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8000`;
    const socket = new WebSocket(`${wsUrl}/ws/${roomCode}/${username}`);
    let pingInterval; // Variable to hold our heartbeat timer

    socket.onopen = () => {
      // 1. Ask the room for the rules
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "request_settings" }));
        }
      }, 500);

      // 2. Start the Heartbeat to prevent Render from killing the connection
      pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000); // Sends a ping every 30 seconds
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "system") {
          setMessages((prev) => [...prev, data.message]);
          if (data.playerCount !== undefined) setOnlineCount(data.playerCount); // Force update count
        } 
        else if (data.type === "request_settings") {
          if (isInRoomRef.current && ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: "settings",
              hasLimit: hasLimitRef.current,
              targetScore: targetScoreRef.current
            }));
          }
        } 
        else if (data.type === "settings") {
          setHasLimit(data.hasLimit);
          setTargetScore(data.targetScore);
        }
        else if (data.type === "score") {
          playPopSound();

          if (data.isManual) {
            setMessages((prev) => [...prev, `${data.username} scored ${data.roundScore} points! | (Manual Math)`]);
          } else {
            setMessages((prev) => [...prev, `${data.username} scored ${data.roundScore} points! | (Dutch: ${data.dutch}, Blitz: ${data.blitz})`]);
          }
          
          setPlayerScores((prevScores) => {
            const newTotal = (prevScores[data.username] || 0) + data.roundScore;
            
            if (hasLimitRef.current && newTotal >= targetScoreRef.current && !winnerDeclared.current) {
              winnerDeclared.current = true;
              setWinner(data.username);
              setMessages((prev) => [...prev, `🏆 ${data.username} HAS WON THE GAME WITH ${newTotal} POINTS! 🏆`]);
              
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([400, 200, 400, 200, 800]); 
              }
            }
            return { ...prevScores, [data.username]: newTotal };
          });
        }
      } catch (e) {
        setMessages((prev) => [...prev, event.data]);
      }
    };

    socket.onclose = () => {
      clearInterval(pingInterval); // Stop pinging if the connection dies
      
      // Attempt auto-reconnect if it wasn't a deliberate quit
      if (isInRoomRef.current && !winnerDeclared.current) {
        setMessages((prev) => [...prev, `⚠️ Connection lost. Reconnecting...`]);
        setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };

    ws.current = socket;
  };

  const joinRoom = () => {
    if (!username || !roomCode) return;
    setIsInRoom(true);
    isInRoomRef.current = true;
    connectWebSocket();
  };

  useEffect(() => {
    return () => { 
      isInRoomRef.current = false;
      if (ws.current) ws.current.close(); 
    };
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages]);

  const broadcastNewSettings = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "settings", hasLimit, targetScore }));
      ws.current.send(JSON.stringify({ type: "system", message: `⚙️ ${username} updated the room rules: ${hasLimit ? `First to ${targetScore}` : 'Endless Mode'}.` }));
    }
    setShowSettings(false);
  };

  const generateAIRecap = async () => {
    setIsGenerating(true);
    setRecap("");
    try {
      const formattedScores = Object.entries(playerScores).map(([name, score]) => ({
        player_name: name,
        total_score: score
      }));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:8000`;
      const response = await fetch(`${apiUrl}/generate-recap/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_code: roomCode, scores: formattedScores }),
      });

      const data = await response.json();
      setRecap(data.recap);
    } catch (error) {
      setRecap("Connection lost to the AI Announcer.");
    }
    setIsGenerating(false);
  };

  const submitScore = () => {
    let roundScore = 0;
    if (isManualMath) {
      roundScore = parseInt(manualScore) || 0;
    } else {
      const blitz = parseInt(blitzCards) || 0;
      const dutch = parseInt(dutchCards) || 0;
      roundScore = dutch * 1 - blitz * 2;
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN && !winner) {
      ws.current.send(JSON.stringify({
        type: "score",
        username: username,
        roundScore: roundScore,
        isManual: isManualMath,
        dutch: isManualMath ? 0 : parseInt(dutchCards) || 0,
        blitz: isManualMath ? 0 : parseInt(blitzCards) || 0
      }));
      setBlitzCards("");
      setDutchCards("");
      setManualScore("");
    }
  };

  const renderMessage = (msg) => {
    if (msg.includes(" | ")) {
      const parts = msg.split(" | ");
      return (
        <>
          {parts[0]} <span className="font-mono text-neutral-400 text-[11px] ml-1">{parts[1]}</span>
        </>
      );
    }
    return msg;
  };

  // --- LOBBY SCREEN ---
  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white p-4">
        <div className="flex flex-col gap-4 bg-neutral-900 p-8 rounded-xl shadow-2xl border border-neutral-800/60 w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-wider text-center mb-4">
            BLITZ<span className="text-emerald-500">ROOM</span>
          </h1>
          
          <input className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition lowercase" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
          <input className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition lowercase" placeholder="room code" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
          
          <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 mt-2 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-neutral-300">Enable Score Limit</label>
              <input type="checkbox" className="w-5 h-5 accent-emerald-500 rounded cursor-pointer" checked={hasLimit} onChange={(e) => setHasLimit(e.target.checked)}/>
            </div>
            {hasLimit && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Target Score to Win</label>
                <input type="number" className="p-2 bg-neutral-800 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 transition text-sm font-bold" value={targetScore} onChange={(e) => setTargetScore(parseInt(e.target.value) || 75)}/>
              </div>
            )}
          </div>

          <button className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-md font-bold tracking-wide transition shadow-lg mt-2" onClick={joinRoom}>
            JOIN LOBBY
          </button>
        </div>
      </div>
    );
  }

  // --- GAME SCREEN ---
  return (
    <div className="min-h-screen bg-neutral-950 p-4 md:p-8 text-white flex justify-center">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        
        {/* Header & Leaderboard */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-800/60 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">Room: <span className="text-emerald-500">{roomCode}</span></h2>
              <button onClick={() => setShowSettings(!showSettings)} className="bg-neutral-800 hover:bg-neutral-700 p-1.5 rounded-md transition text-sm" title="Room Settings">⚙️</button>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-neutral-400">{hasLimit ? `First to ${targetScore} wins` : "Endless Mode"}</p>
              <span className="bg-blue-900/30 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                {onlineCount} Online
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(playerScores).map(([name, score]) => (
              <span key={name} className="bg-neutral-800 px-3 py-1 rounded-full text-sm font-bold border border-neutral-700 shadow-sm">
                {name}: <span className={score >= 0 ? "text-emerald-400" : "text-red-400"}>{score}</span>
              </span>
            ))}
          </div>
        </div>

        {/* IN-GAME SETTINGS PANEL */}
        {showSettings && (
          <div className="bg-neutral-900 border border-neutral-700 p-4 rounded-xl flex flex-col gap-3 shadow-lg">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-neutral-300">Enable Score Limit</label>
              <input type="checkbox" className="w-5 h-5 accent-emerald-500 rounded cursor-pointer" checked={hasLimit} onChange={(e) => setHasLimit(e.target.checked)} disabled={!!winner}/>
            </div>
            {hasLimit && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Target Score to Win</label>
                <input type="number" className="p-2 bg-neutral-950 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 transition text-sm font-bold" value={targetScore} onChange={(e) => setTargetScore(parseInt(e.target.value) || 75)} disabled={!!winner}/>
              </div>
            )}
            <button className="bg-neutral-800 hover:bg-neutral-700 text-sm font-bold p-2 rounded transition mt-1" onClick={broadcastNewSettings} disabled={!!winner}>
              Save & Broadcast Rules
            </button>
          </div>
        )}

        {/* Chat */}
        <div ref={chatRef} className="bg-neutral-900 h-48 md:h-80 rounded-xl border border-neutral-800/60 p-4 overflow-y-auto shadow-inner flex flex-col gap-2">
          {messages.map((msg, idx) => (
            <div key={idx} className={`p-3 rounded-md w-fit max-w-[90%] md:max-w-[80%] text-sm md:text-base ${msg.includes("System:") || msg.includes("⚠️") || msg.includes("⚙️") || msg.includes("🟢") || msg.includes("🔴") ? "bg-neutral-950 text-neutral-500 text-xs font-mono border border-neutral-800" : "bg-neutral-800/80 shadow-sm"}`}>
              {renderMessage(msg)}
            </div>
          ))}
        </div>

        {/* Score Panel with Manual Toggle */}
        <div className={`flex flex-col gap-4 w-full bg-neutral-900 p-4 rounded-xl border transition ${winner ? 'border-amber-500/50 shadow-lg shadow-amber-900/20' : 'border-neutral-800/60'}`}>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-1">
            <span className="text-sm font-bold text-neutral-400">Score Input Method</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isManualMath} onChange={(e) => setIsManualMath(e.target.checked)} disabled={!!winner}/>
              <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-3 text-sm font-medium text-neutral-300">{isManualMath ? "Manual Math" : "Calculate for me"}</span>
            </label>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {!isManualMath ? (
              <>
                <div className="flex-1 w-full">
                  <label className="block text-sm text-neutral-400 mb-1">Blitz Cards Left (-2)</label>
                  <input type="number" className="w-full p-3 bg-neutral-950 rounded-lg border border-red-900/50 focus:border-red-500 text-red-400 font-bold disabled:opacity-50" value={blitzCards} onChange={(e) => setBlitzCards(e.target.value)} placeholder="0" disabled={!!winner}/>
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-sm text-neutral-400 mb-1">Dutch Cards Played (+1)</label>
                  <input type="number" className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50" value={dutchCards} onChange={(e) => setDutchCards(e.target.value)} placeholder="0" disabled={!!winner}/>
                </div>
              </>
            ) : (
              <div className="flex-1 w-full">
                <label className="block text-sm text-neutral-400 mb-1">Total Round Score</label>
                <input type="number" className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50" value={manualScore} onChange={(e) => setManualScore(e.target.value)} placeholder="e.g. 14 or -4" disabled={!!winner}/>
              </div>
            )}
            
            <div className="flex items-end w-full md:w-auto mt-2 md:mt-0">
              <button className={`w-full md:w-auto p-3 px-8 h-[50px] rounded-lg font-bold transition shadow-lg ${winner ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`} onClick={submitScore} disabled={!!winner}>
                {winner ? "GAME OVER" : "SUBMIT"}
              </button>
            </div>
          </div>
        </div>

        {/* AI Recap Section */}
        <div className="bg-neutral-900 p-4 rounded-xl border border-purple-900/40 flex flex-col gap-3 shadow-lg shadow-purple-900/20 mb-8">
          <button className={`p-3 rounded-lg font-bold transition-all w-full shadow-lg ${isGenerating ? "bg-purple-900 animate-pulse text-purple-300" : "bg-purple-600 hover:bg-purple-500 text-white"}`} onClick={generateAIRecap} disabled={isGenerating}>
            {isGenerating ? "🎙️ AI is analyzing the match..." : "🎙️ Generate AI Match Recap"}
          </button>
          {recap && <div className="p-4 bg-neutral-950 rounded-lg border border-purple-500/40 text-purple-200 italic shadow-inner text-sm md:text-base leading-relaxed">"{recap}"</div>}
        </div>

      </div>
    </div>
  );
}