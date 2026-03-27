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
  const playerScoresRef = useRef({});

  // --- NUEVO: Estado para manejar los AFK/Listo ---
  const [playerStatuses, setPlayerStatuses] = useState({});
  const playerStatusesRef = useRef({});

  const [winner, setWinner] = useState(null);
  const winnerRef = useRef(null); // NUEVO: Para poder enviar al ganador por WebSocket

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
    playerScoresRef.current = playerScores;
    playerStatusesRef.current = playerStatuses; 
    winnerRef.current = winner; 

    if (isInRoomRef.current) {
      sessionStorage.setItem("blitzScores", JSON.stringify(playerScores));
      sessionStorage.setItem("blitzStatuses", JSON.stringify(playerStatuses));
      sessionStorage.setItem("blitzRules", JSON.stringify({ hasLimit, targetScore }));
      sessionStorage.setItem("blitzMessages", JSON.stringify(messages)); 
      
      // NUEVO: Si hay ganador lo guarda, si es null (reinicio), lo borra de la memoria
      if (winner) sessionStorage.setItem("blitzWinner", winner); 
      else sessionStorage.removeItem("blitzWinner"); 
    }
  }, [hasLimit, targetScore, playerScores, playerStatuses, messages, winner]);

  // --- RECUPERACIÓN DE SESIÓN (ESTO ARREGLA EL F5) ---
  // --- RECUPERACIÓN DE SESIÓN (SNAPSHOT TOTAL) ---
  useEffect(() => {
    const savedUser = sessionStorage.getItem("blitzUsername");
    const savedRoom = sessionStorage.getItem("blitzRoomCode");
    const savedScores = sessionStorage.getItem("blitzScores");
    const savedStatuses = sessionStorage.getItem("blitzStatuses");
    const savedRules = sessionStorage.getItem("blitzRules");
    const savedMessages = sessionStorage.getItem("blitzMessages");
    const savedWinner = sessionStorage.getItem("blitzWinner");

    if (savedUser && savedRoom) {
      setUsername(savedUser);
      setRoomCode(savedRoom);
      
      if (savedScores) setPlayerScores(JSON.parse(savedScores));
      if (savedStatuses) setPlayerStatuses(JSON.parse(savedStatuses));
      if (savedMessages) setMessages(JSON.parse(savedMessages)); // Restaura el chat
      
      if (savedRules) {
        const rules = JSON.parse(savedRules);
        setHasLimit(rules.hasLimit);
        setTargetScore(rules.targetScore);
      }
      
      if (savedWinner) {
        setWinner(savedWinner); // Restaura la UI de "GAME OVER"
        winnerDeclared.current = true;
      }
      
      setIsInRoom(true);
      isInRoomRef.current = true;
      connectWebSocket(savedRoom, savedUser);
    }
  }, []);

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

  // --- ACTUALIZADO: Reconexión, IA y Estados AFK ---
  const connectWebSocket = (currentRoom = roomCode, currentUser = username) => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8000`;
    const socket = new WebSocket(`${wsUrl}/ws/${currentRoom}/${currentUser}`);
    let pingInterval;

    socket.onopen = () => {
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "request_settings" }));
          
          // Anunciar mi estado inicial como "Jugando"
          socket.send(JSON.stringify({ 
            type: "status_update", 
            username: currentUser, 
            status: "🃏 Jugando" 
          }));
        }
      }, 500);

      pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "system") {
          setMessages((prev) => [...prev, data.message]);
          if (data.playerCount !== undefined) setOnlineCount(data.playerCount);
          
          // Si alguien se va, limpiar su estado de la memoria
          if (data.message.includes("left the table")) {
             const leftUser = data.message.split(" ")[1];
             setPlayerStatuses(prev => {
                const newStatuses = {...prev};
                delete newStatuses[leftUser];
                return newStatuses;
             });
          }
        }
        else if (data.type === "request_settings") {
          // Mat envía la configuración a Cami
          if (isInRoomRef.current && ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: "settings",
              hasLimit: hasLimitRef.current,
              targetScore: targetScoreRef.current,
              playerScores: playerScoresRef.current,
              playerStatuses: playerStatusesRef.current,
              winner: winnerRef.current // NUEVO: Le decimos a Cami si alguien ya ganó
            }));
          }
        }
        else if (data.type === "settings") {
          // Cami recibe la configuración de Mat
          setHasLimit(data.hasLimit);
          setTargetScore(data.targetScore);

          if (data.playerScores && Object.keys(playerScoresRef.current).length === 0) {
            setPlayerScores(data.playerScores);
          }
          if (data.playerStatuses) {
            setPlayerStatuses(prev => ({...prev, ...data.playerStatuses}));
          }
          
          // NUEVO: Si el juego ya terminó, bloquearle la pantalla a Cami inmediatamente
          if (data.winner) {
            setWinner(data.winner);
            winnerDeclared.current = true;
          }
        }
        else if (data.type === "pong") {
          return;
        }
        else if (data.type === "status_update") {
          // Actualizar el estado AFK de un jugador
          setPlayerStatuses(prev => ({...prev, [data.username]: data.status}));
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
        else if (data.type === "ai_recap_broadcast") {
          setIsGenerating(false);
          setRecap(`🎙️ AI Announcer: "${data.message}"`);
        }
        // ... otros else if ...
        else if (data.type === "restart_game") {
          // 1. Convertir todos los puntajes actuales a 0
          setPlayerScores((prev) => {
            const resetScores = {};
            Object.keys(prev).forEach(player => {
              resetScores[player] = 0;
            });
            return resetScores;
          });
          
          // 2. Limpiar el ganador y desbloquear la UI
          setWinner(null);
          winnerDeclared.current = false;
          
          // 3. Anunciar en el chat
          setMessages((prev) => [...prev, `🔄 ${data.username} restarted the game! All scores reset to 0.`]);
          playPopSound(); // Un ruidito para avisar que empezó una nueva ronda
        }
      } catch (e) {
        setMessages((prev) => [...prev, event.data]);
      }
    };

    socket.onclose = () => {
      clearInterval(pingInterval);

      if (isInRoomRef.current && !winnerDeclared.current) {
        setMessages((prev) => [...prev, `⚠️ Connection lost. Reconnecting...`]);
        setTimeout(() => {
          connectWebSocket(currentRoom, currentUser);
        }, 3000);
      }
    };

    ws.current = socket;
  };

  const joinRoom = () => {
    if (!username || !roomCode) return;
    
    // Guardar en sesión
    sessionStorage.setItem("blitzUsername", username);
    sessionStorage.setItem("blitzRoomCode", roomCode);

    setIsInRoom(true);
    isInRoomRef.current = true;
    connectWebSocket(roomCode, username);
  };

  // --- FUNCIÓN PARA SALIR DE LA SALA ---
  // --- FUNCIÓN PARA SALIR DE LA SALA ---
  // --- FUNCIÓN PARA SALIR DE LA SALA ---
  const leaveRoom = () => {
    // Limpiar toda la memoria del navegador
    sessionStorage.removeItem("blitzUsername");
    sessionStorage.removeItem("blitzRoomCode");
    sessionStorage.removeItem("blitzScores");
    sessionStorage.removeItem("blitzStatuses");
    sessionStorage.removeItem("blitzRules");
    sessionStorage.removeItem("blitzMessages");
    sessionStorage.removeItem("blitzWinner");
    
    setIsInRoom(false);
    isInRoomRef.current = false;
    if (ws.current) ws.current.close();
    
    setMessages([]);
    setPlayerScores({});
    setPlayerStatuses({});
    setWinner(null);
    winnerDeclared.current = false;
    setUsername("");
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
      ws.current.send(JSON.stringify({ type: "settings", hasLimit, targetScore, playerScores: playerScoresRef.current, playerStatuses: playerStatusesRef.current }));
      ws.current.send(JSON.stringify({ type: "system", message: `⚙️ ${username} updated the room rules: ${hasLimit ? `First to ${targetScore}` : 'Endless Mode'}.` }));
    }
    setShowSettings(false);
  };

  // --- NUEVO: Enviar cambio de estado AFK ---
  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "status_update",
        username: username,
        status: newStatus
      }));
    }
  };

  const generateAIRecap = async () => {
    setIsGenerating(true);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const formattedScores = Object.entries(playerScores).map(([name, score]) => ({
        player_name: name,
        total_score: score
      }));

      ws.current.send(JSON.stringify({
        type: "request_ai_recap",
        scores: formattedScores
      }));
    } else {
      setRecap("Error: No estás conectado a la sala.");
      setIsGenerating(false);
    }
  };

  // --- NUEVO: Función para reiniciar el juego ---
  const restartGame = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "restart_game",
        username: username
      }));
    }
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
              <input type="checkbox" className="w-5 h-5 accent-emerald-500 rounded cursor-pointer" checked={hasLimit} onChange={(e) => setHasLimit(e.target.checked)} />
            </div>
            {hasLimit && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Target Score to Win</label>
                <input type="number" className="p-2 bg-neutral-800 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 transition text-sm font-bold" value={targetScore} onChange={(e) => setTargetScore(parseInt(e.target.value) || 75)} />
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
              
              {/* SELECTOR DE ESTADO AFK/LISTO */}
              <select 
                className="bg-neutral-800 text-xs p-1 rounded border border-neutral-700 focus:outline-none"
                value={playerStatuses[username] || "🃏 Jugando"}
                onChange={handleStatusChange}
              >
                <option value="🃏 Jugando">🃏 Jugando</option>
                <option value="🟡 AFK">🟡 AFK</option>
                <option value="👀 Espectando">👀 Espectando</option>
                <option value="✅ Listo">✅ Listo</option>
              </select>

              <button onClick={() => setShowSettings(!showSettings)} className="bg-neutral-800 hover:bg-neutral-700 p-1.5 rounded-md transition text-sm" title="Room Settings">⚙️</button>
              
              <button onClick={leaveRoom} className="bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-900 p-1.5 px-3 rounded-md transition text-sm font-bold ml-2">
                🚪 Salir
              </button>
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
              <span key={name} className="bg-neutral-800 px-3 py-1 rounded-full text-sm font-bold border border-neutral-700 shadow-sm flex items-center gap-1">
                <span className="text-xs opacity-80">{playerStatuses[name] || "🃏 Jugando"}</span>
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
              <input type="checkbox" className="w-5 h-5 accent-emerald-500 rounded cursor-pointer" checked={hasLimit} onChange={(e) => setHasLimit(e.target.checked)} disabled={!!winner} />
            </div>
            {hasLimit && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Target Score to Win</label>
                <input type="number" className="p-2 bg-neutral-950 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 transition text-sm font-bold" value={targetScore} onChange={(e) => setTargetScore(parseInt(e.target.value) || 75)} disabled={!!winner} />
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
              <input type="checkbox" className="sr-only peer" checked={isManualMath} onChange={(e) => setIsManualMath(e.target.checked)} disabled={!!winner} />
              <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-3 text-sm font-medium text-neutral-300">{isManualMath ? "Manual Math" : "Calculate for me"}</span>
            </label>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {!isManualMath ? (
              <>
                <div className="flex-1 w-full">
                  <label className="block text-sm text-neutral-400 mb-1">Blitz Cards Left (-2)</label>
                  <input type="number" className="w-full p-3 bg-neutral-950 rounded-lg border border-red-900/50 focus:border-red-500 text-red-400 font-bold disabled:opacity-50" value={blitzCards} onChange={(e) => setBlitzCards(e.target.value)} placeholder="0" disabled={!!winner} />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-sm text-neutral-400 mb-1">Dutch Cards Played (+1)</label>
                  <input type="number" className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50" value={dutchCards} onChange={(e) => setDutchCards(e.target.value)} placeholder="0" disabled={!!winner} />
                </div>
              </>
            ) : (
              <div className="flex-1 w-full">
                <label className="block text-sm text-neutral-400 mb-1">Total Round Score</label>
                <input type="number" className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50" value={manualScore} onChange={(e) => setManualScore(e.target.value)} placeholder="e.g. 14 or -4" disabled={!!winner} />
              </div>
            )}

            <div className="flex items-end w-full md:w-auto mt-2 md:mt-0 gap-2">
              {/* BOTÓN DE REINICIO (Solo visible si hay un ganador) */}
              {winner && (
                <button 
                  className="w-full md:w-auto p-3 px-6 h-[50px] rounded-lg font-bold transition shadow-lg bg-blue-600 hover:bg-blue-500 text-white border border-blue-500" 
                  onClick={restartGame}
                >
                  🔄 REMATCH
                </button>
              )}
              
              <button className={`w-full md:w-auto p-3 px-8 h-[50px] rounded-lg font-bold transition shadow-lg ${winner ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed border border-neutral-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`} onClick={submitScore} disabled={!!winner}>
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