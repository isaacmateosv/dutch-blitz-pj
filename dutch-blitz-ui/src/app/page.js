"use client";

import { useState, useEffect, useRef } from "react";

const EMOJIS = ["👾", "🦊", "🐶", "🐱", "🐰", "🐼", "🐯", "🐸", "🦄", "👽", "👻", "🤖", "🤡", "👹", "👑", "🔥", "🐳", "🫍"];

const getUserColor = (name) => {
  const colors = [
    'text-[#fbd304]', 'text-[#005ba1]', 'text-[#d22730]', 'text-[#4ade80]'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Home() {
  const [rawUsername, setRawUsername] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("👾");
  const [recentRooms, setRecentRooms] = useState([]);

  const [isInRoom, setIsInRoom] = useState(false);
  const isInRoomRef = useRef(false);
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [myThought, setMyThought] = useState("");

  const [hasLimit, setHasLimit] = useState(true);
  const hasLimitRef = useRef(true);
  const [targetScore, setTargetScore] = useState(75);
  const targetScoreRef = useRef(75);
  const [aiEnabled, setAiEnabled] = useState(true);
  const aiEnabledRef = useRef(true);
  const [showSettings, setShowSettings] = useState(false);

  const [onlineCount, setOnlineCount] = useState(1);
  const [messages, setMessages] = useState([]);
  const [toasts, setToasts] = useState([]); 
  
  // NUEVO: Estados para el Timeout de Inactividad (Tarea 11)
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [inactivityAlert, setInactivityAlert] = useState("");
  const INACTIVITY_LIMIT = 25 * 60 * 1000; // 15 minutos (Cambia el 15 por 0.1 para probarlo en 6 segundos)

  const [playerScores, setPlayerScores] = useState({});
  const playerScoresRef = useRef({});

  const [playerStatuses, setPlayerStatuses] = useState({});
  const playerStatusesRef = useRef({});

  const [winner, setWinner] = useState(null);
  const winnerRef = useRef(null);
  const winnerDeclared = useRef(false);

  const [isManualMath, setIsManualMath] = useState(true);
  const [manualScore, setManualScore] = useState("");
  const [blitzCards, setBlitzCards] = useState("");
  const [dutchCards, setDutchCards] = useState("");

  const [recap, setRecap] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const ws = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    setSelectedEmoji(randomEmoji);
    const savedHistory = JSON.parse(localStorage.getItem("blitzRoomHistory") || "[]");
    setRecentRooms(savedHistory);
  }, []);

  useEffect(() => {
    hasLimitRef.current = hasLimit;
    targetScoreRef.current = targetScore;
    playerScoresRef.current = playerScores;
    playerStatusesRef.current = playerStatuses;
    winnerRef.current = winner;
    aiEnabledRef.current = aiEnabled;

    if (isInRoomRef.current) {
      sessionStorage.setItem("blitzScores", JSON.stringify(playerScores));
      sessionStorage.setItem("blitzStatuses", JSON.stringify(playerStatuses));
      sessionStorage.setItem("blitzRules", JSON.stringify({ hasLimit, targetScore }));
      sessionStorage.setItem("blitzMessages", JSON.stringify(messages));
      sessionStorage.setItem("blitzAiEnabled", JSON.stringify(aiEnabled));
      if (winner) sessionStorage.setItem("blitzWinner", winner);
      else sessionStorage.removeItem("blitzWinner");
    }
  }, [hasLimit, targetScore, playerScores, playerStatuses, messages, winner, aiEnabled]);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("blitzUsername");
    const savedRoom = sessionStorage.getItem("blitzRoomCode");
    const savedScores = sessionStorage.getItem("blitzScores");
    const savedStatuses = sessionStorage.getItem("blitzStatuses");
    const savedRules = sessionStorage.getItem("blitzRules");
    const savedMessages = sessionStorage.getItem("blitzMessages");
    const savedWinner = sessionStorage.getItem("blitzWinner");
    const savedAiEnabled = sessionStorage.getItem("blitzAiEnabled");

    if (savedUser && savedRoom) {
      setUsername(savedUser);
      setRoomCode(savedRoom);
      
      if (savedAiEnabled) setAiEnabled(JSON.parse(savedAiEnabled));
      if (savedScores) setPlayerScores(JSON.parse(savedScores));

      if (savedStatuses) {
        const parsedStatuses = JSON.parse(savedStatuses);
        setPlayerStatuses(parsedStatuses);
        if (parsedStatuses[savedUser]) setMyThought(parsedStatuses[savedUser]);
      }

      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        const formatted = parsed.map(m => typeof m === 'string' ? { id: Math.random().toString(), text: m, count: 1 } : { ...m, count: m.count || 1 });
        setMessages(formatted);
      }

      if (savedRules) {
        const rules = JSON.parse(savedRules);
        setHasLimit(rules.hasLimit);
        setTargetScore(rules.targetScore);
      }
      if (savedWinner) {
        setWinner(savedWinner);
        winnerDeclared.current = true;
      }
      setIsInRoom(true);
      isInRoomRef.current = true;
      connectWebSocket(savedRoom, savedUser);
    }
  }, []);

  // ⏱️ EFECTO DE TIMEOUT POR INACTIVIDAD (Dead Man's Switch)
  useEffect(() => {
    if (!isInRoom) return; // Si estamos en el lobby, el reloj se apaga
    
    const timer = setTimeout(() => {
      leaveRoom(); // Expulsa al jugador
      setInactivityAlert("⏳ Fuiste desconectado de la sala por inactividad (~20 min).");
    }, INACTIVITY_LIMIT);

    // Si hay actividad, este "return" limpia el reloj viejo para que empiece de 0
    return () => clearTimeout(timer);
  }, [lastActivity, isInRoom]);

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
    } catch (e) { console.log("Audio not supported"); }
  };

  // NUEVO: La función faltante que dibuja las notificaciones flotantes
  const showToast = (msg) => {
    const id = Date.now() + Math.random(); // ID único
    setToasts(prev => [...prev, { id, msg }]);
    
    // Desaparece mágicamente a los 4 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000); 
  };

  const connectWebSocket = (currentRoom = roomCode, currentUser = username) => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8000`;
    const socket = new WebSocket(`${wsUrl}/ws/${currentRoom}/${currentUser}`);
    let pingInterval;

    // FIX: Agrupador inteligente de mensajes
    const appendMsg = (text, isTemporary = false) => {
      const id = Date.now().toString() + Math.random().toString();
      
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1];
        
        if (lastMsg && lastMsg.text === text && isTemporary) {
           lastMsg.count = (lastMsg.count || 1) + 1;
           return newMsgs;
        }
        return [...newMsgs, { id, text, count: 1 }];
      });

      if (isTemporary) {
        setTimeout(() => {
          setMessages(prev => prev.filter(m => m.id !== id));
        }, 10000);
      }
    };

    socket.onopen = () => {
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "request_settings" }));
          socket.send(JSON.stringify({ type: "score", username: currentUser, roundScore: 0, isManual: true, isSilent: true }));

          if (aiEnabledRef.current) {
            socket.send(JSON.stringify({ type: "request_greeting", username: currentUser }));
          }
        }
      }, 500);
      pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // NUEVO: Si alguien hace CUALQUIER COSA (excepto pings internos), reiniciamos el reloj
        if (data.type !== "pong" && data.type !== "request_settings") {
          setLastActivity(Date.now());
        }

        if (data.type === "system") {
          const isJoinOrLeave = data.message.includes("joined") || data.message.includes("left");
          
          // FIX DE UX: Si es entrar/salir, es un Toast flotante. NO se guarda en el chat.
          if (isJoinOrLeave) {
            showToast(data.message.replace('🟢 ', '').replace('🔴 ', ''));
          } else {
            appendMsg(data.message); 
          }

          if (data.playerCount !== undefined) setOnlineCount(data.playerCount);
        }
        else if (data.type === "request_settings") {
          if (isInRoomRef.current && ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "settings", hasLimit: hasLimitRef.current, targetScore: targetScoreRef.current, aiEnabled: aiEnabledRef.current, playerScores: playerScoresRef.current, playerStatuses: playerStatusesRef.current, winner: winnerRef.current }));
          }
        }
        else if (data.type === "settings") {
          setHasLimit(data.hasLimit);
          setTargetScore(data.targetScore);
          if (data.aiEnabled !== undefined) setAiEnabled(data.aiEnabled);

          // FIX: Fusión pacífica. Aceptamos a todos los jugadores de la sala sin sobreescribirnos si no es necesario.
          if (data.playerScores) {
            setPlayerScores(prev => ({ ...prev, ...data.playerScores }));
          }
          if (data.playerStatuses) {
            setPlayerStatuses(prev => ({ ...prev, ...data.playerStatuses }));
          }

          setWinner(data.winner || null);
          winnerDeclared.current = !!data.winner;
        }
        else if (data.type === "pong") return;
        else if (data.type === "status_update") {
          setPlayerStatuses(prev => ({ ...prev, [data.username]: data.status }));

          if (data.username === currentUser) {
            setMyThought(data.status);
          }
        }
        else if (data.type === "kick_player") {
          setPlayerScores((prev) => {
            const newScores = { ...prev };
            delete newScores[data.target];
            return newScores;
          });
          setPlayerStatuses((prev) => {
            const newStatuses = { ...prev };
            delete newStatuses[data.target];
            return newStatuses;
          });
        }
        else if (data.type === "restart_game") {
          setPlayerScores((prev) => {
            const resetScores = {};
            Object.keys(prev).forEach(player => { resetScores[player] = 0; });
            return resetScores;
          });
          setWinner(null);
          winnerDeclared.current = false;
          appendMsg(`🔄 ${data.username} restarted the game! All scores reset to 0.`);
          playPopSound();
        }
        else if (data.type === "score") {
          if (!data.isSilent) {
            playPopSound();
            if (data.isManual) appendMsg(`${data.username} scored ${data.roundScore} points! | (Manual Math)`);
            else appendMsg(`${data.username} scored ${data.roundScore} points! | (Dutch: ${data.dutch}, Blitz: ${data.blitz})`);
          }
          setPlayerScores((prevScores) => {
            const newTotal = (prevScores[data.username] || 0) + data.roundScore;
            if (hasLimitRef.current && newTotal >= targetScoreRef.current && !winnerDeclared.current) {
              winnerDeclared.current = true;
              setWinner(data.username);
              appendMsg(`🏆 ${data.username} HAS WON THE GAME WITH ${newTotal} POINTS! 🏆`);
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 800]);
            }
            return { ...prevScores, [data.username]: newTotal };
          });
        }
        else if (data.type === "ai_recap_broadcast") {
          setIsGenerating(false);
          setRecap(data.message);
        }
      } catch (e) { appendMsg(event.data); }
    };

    socket.onclose = () => {
      clearInterval(pingInterval);
      if (isInRoomRef.current && !winnerDeclared.current) {
        appendMsg(`⚠️ Connection lost. Reconnecting...`);
        setTimeout(() => { connectWebSocket(currentRoom, currentUser); }, 3000);
      }
    };
    ws.current = socket;
  };

  const joinRoom = (codeToJoin = roomCode) => {
    const cleanName = rawUsername.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!cleanName || !codeToJoin) return;

    // NUEVO: Limpiamos alertas viejas y empezamos el reloj al entrar
    setInactivityAlert("");
    setLastActivity(Date.now());

    setPlayerScores({});
    setPlayerStatuses({});
    setWinner(null);
    winnerDeclared.current = false;
    setMessages([]);
    setRecap("");

    const fullUsername = `${selectedEmoji} ${cleanName}`;
    setUsername(fullUsername);
    setRoomCode(codeToJoin);

    const loadingSalute = aiEnabled ? "💭 Mmm..." : "Listo! 🃏";
    setMyThought(loadingSalute);

    setPlayerScores(prev => ({ ...prev, [fullUsername]: prev[fullUsername] || 0 }));
    setPlayerStatuses(prev => ({ ...prev, [fullUsername]: loadingSalute }));

    sessionStorage.setItem("blitzUsername", fullUsername);
    sessionStorage.setItem("blitzRoomCode", codeToJoin);

    const newHistory = [codeToJoin, ...recentRooms.filter(r => r !== codeToJoin)].slice(0, 3);
    setRecentRooms(newHistory);
    localStorage.setItem("blitzRoomHistory", JSON.stringify(newHistory));

    setIsInRoom(true);
    isInRoomRef.current = true;
    connectWebSocket(codeToJoin, fullUsername);
  };

  const leaveRoom = () => {
    sessionStorage.clear();
    setIsInRoom(false);
    isInRoomRef.current = false;
    if (ws.current) ws.current.close();
    setMessages([]);
    setPlayerScores({});
    setPlayerStatuses({});
    setWinner(null);
    setRawUsername("");
    winnerDeclared.current = false;
  };

  const handleStatusUpdate = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && myThought.trim() !== "") {
      ws.current.send(JSON.stringify({ type: "status_update", username, status: myThought }));
    }
  };

  const kickPlayer = (playerToKick) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "kick_player", target: playerToKick }));
    }
  };

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);

  const broadcastNewSettings = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "settings", hasLimit, targetScore, aiEnabled, playerScores: playerScoresRef.current, playerStatuses: playerStatusesRef.current, winner: winnerRef.current }));
      ws.current.send(JSON.stringify({ type: "system", message: `⚙️ ${username} updated the room rules: ${hasLimit ? `First to ${targetScore}` : 'Endless Mode'}.` }));
    }
    setShowSettings(false);
  };

  const generateAIRecap = async () => {
    setIsGenerating(true);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const formattedScores = Object.entries(playerScores).map(([name, score]) => ({
        player_name: name,
        total_score: score,
        status: playerStatuses[name] || "concentrating"
      }));
      ws.current.send(JSON.stringify({ type: "request_ai_recap", scores: formattedScores }));
    } else {
      setRecap("Error: No estás conectado a la sala.");
      setIsGenerating(false);
    }
  };

  const restartGame = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: "restart_game", username: username }));
  };

  const submitScore = () => {
    let roundScore = 0;
    if (isManualMath) roundScore = parseInt(manualScore) || 0;
    else {
      const blitz = parseInt(blitzCards) || 0;
      const dutch = parseInt(dutchCards) || 0;
      roundScore = dutch * 1 - blitz * 2;
    }
    if (ws.current && ws.current.readyState === WebSocket.OPEN && !winner) {
      ws.current.send(JSON.stringify({ type: "score", username: username, roundScore: roundScore, isManual: isManualMath, dutch: isManualMath ? 0 : parseInt(dutchCards) || 0, blitz: isManualMath ? 0 : parseInt(blitzCards) || 0 }));
      setBlitzCards(""); setDutchCards(""); setManualScore("");
    }
  };

  const renderMessage = (text) => {
    // FIX: Si es el mensaje de victoria, le damos un estilo ÉPICO y dorado
    if (text.includes("HAS WON THE GAME")) {
      return <span className="text-amber-400 font-extrabold text-base tracking-wide drop-shadow-md">{text}</span>;
    }

    let userColor = "text-white";

    
    const players = Object.keys(playerScoresRef.current);
    const sender = players.find(p => text.includes(p));
    
    if (sender) userColor = getUserColor(sender);

    if (text.includes(" | ")) {
      const parts = text.split(" | ");
      // UX FIX: Solo coloreamos el nombre del usuario, el resto del texto se queda blanco
      if (sender && parts[0].startsWith(sender)) {
         const actionText = parts[0].substring(sender.length).trim(); // <-- AÑADIDO: .trim()
         return (
           <>
             <span className={`font-bold ${userColor}`}>{sender}</span>
             {/* AÑADIDO: ml-1 para forzar la separación */}
             <span className="font-bold text-neutral-200 ml-1">{actionText}</span>
             <span className="font-mono text-neutral-500 text-[11px] ml-2">{parts[1]}</span>
           </>
         );
      }
      
      return (
        <>
          <span className={`font-bold ${userColor}`}>{parts[0]}</span>
          <span className="font-mono text-neutral-500 text-[11px] ml-2">{parts[1]}</span>
        </>
      );
    }
    return <span className={sender ? userColor : "text-neutral-300"}>{text}</span>;
  };

  const renderAIText = (text) => {
    const cleanText = text.replace(/^"|"$/g, '');
    return cleanText.split('\n').map((line, i) => {
      if (!line.trim()) return null;
      const parts = line.split('**');
      return (
        <p key={i} className="mb-3 text-purple-100 leading-relaxed text-sm md:text-base">
          {parts.map((part, index) => index % 2 === 1 ? <strong key={index} className="text-white font-bold">{part}</strong> : part)}
        </p>
      );
    });
  };

  // --- LOBBY SCREEN ---
  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white p-4">
        <div className="flex flex-col gap-4 bg-neutral-900 p-8 rounded-xl shadow-2xl border border-neutral-800/60 w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-wider text-center mb-4 text-[#4ade80]">
            BLITZ<span className="text-white">ROOM</span>
          </h1>
          
          {/* NUEVO: Alerta de Inactividad */}
          {inactivityAlert && (
            <div className="bg-red-900/40 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm text-center font-medium animate-pulse shadow-lg mb-2">
              {inactivityAlert}
            </div>
          )}

          <div className="flex gap-2">
            <select className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fbd304] text-xl cursor-pointer" value={selectedEmoji} onChange={(e) => setSelectedEmoji(e.target.value)}>
              {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fbd304] transition lowercase w-full" placeholder="username" value={rawUsername} onChange={(e) => setRawUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
          </div>
          <div className="flex flex-col">
            <input className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fbd304] transition lowercase" placeholder="room code" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
            {recentRooms.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {recentRooms.map(room => (
                  <button key={room} onClick={() => joinRoom(room)} className="bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-400 px-3 py-1.5 rounded-full transition border border-neutral-700 hover:border-[#005ba1]/50">
                    🕒 {room}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 mt-2 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-neutral-300">Enable Score Limit</label>
              <input type="checkbox" className="w-5 h-5 accent-[#d22730] rounded cursor-pointer" checked={hasLimit} onChange={(e) => setHasLimit(e.target.checked)} />
            </div>
            {hasLimit && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Target Score to Win</label>
                <input 
                  type="number" 
                  className="p-2 bg-neutral-800 rounded focus:outline-none focus:ring-1 focus:ring-[#d22730] transition text-sm font-bold" 
                  value={targetScore} 
                  onChange={(e) => setTargetScore(e.target.value === "" ? "" : parseInt(e.target.value))} 
                  onBlur={() => { if (targetScore === "" || targetScore <= 0) setTargetScore(75); }}
                  onKeyDown={(e) => { if (['e', 'E', '+', '.', '-'].includes(e.key)) e.preventDefault(); }}
                />
              </div>
            )}
          </div>
          <button className="p-3 bg-[#005ba1] hover:bg-blue-600 rounded-md font-bold tracking-wide transition shadow-lg mt-2" onClick={() => joinRoom(roomCode)}>
            JOIN LOBBY
          </button>
        </div>
      </div>
    );
  }

  // --- GAME SCREEN ---
  return (
    <div className="min-h-screen bg-neutral-950 p-4 md:p-8 text-white flex justify-center relative">
      
      {/* NUEVO: TOAST NOTIFICATIONS (Flotan en la esquina superior derecha) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-neutral-800/90 backdrop-blur-sm text-neutral-300 text-xs md:text-sm px-4 py-2 rounded-xl shadow-2xl border border-neutral-700/50 transition-all duration-300">
            {t.msg}
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Header */}
        <div className="flex flex-col border-b border-neutral-800/60 pb-4 gap-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Room: <span className="text-[#fbd304]">{roomCode}</span></h2>
                <button onClick={() => setShowSettings(!showSettings)} className="bg-neutral-800 hover:bg-neutral-700 p-1.5 rounded-md transition text-sm" title="Room Settings">⚙️</button>
                <button onClick={leaveRoom} className="bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-900 p-1.5 px-3 rounded-md transition text-sm font-bold ml-2">🚪 Salir</button>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-neutral-400">{hasLimit ? `First to ${targetScore} wins` : "Endless Mode"}</p>
                <span className="bg-blue-900/30 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> {onlineCount} Online
                </span>
              </div>
            </div>

            <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-full pl-3 pr-1 py-1 shadow-inner">
              <span className="text-xs mr-2">💭</span>
              <input
                type="text"
                maxLength={40}
                placeholder="What's on your mind?"
                className="bg-transparent text-xs focus:outline-none w-32 md:w-64 text-purple-200 placeholder-neutral-600"
                value={myThought}
                onChange={(e) => setMyThought(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStatusUpdate(); }}
              />
              <button onClick={handleStatusUpdate} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-3 py-1.5 rounded-full font-bold transition ml-1">SET</button>
            </div>
          </div>

          {/* LEADERBOARD */}
          <div className="flex gap-4 flex-wrap mt-8 md:mt-6 justify-end w-full md:w-auto">
            {Object.entries(playerScores).map(([name, score]) => {
              const isMe = name === username;
              return (
                <div key={name} className={`relative flex flex-col items-center ${isMe ? 'scale-105' : 'opacity-90'}`}>

                  {playerStatuses[name] && (
                    <div className="absolute bottom-full mb-1 w-max max-w-[140px] z-10">
                      <div className="text-[11px] text-neutral-800 bg-neutral-200 px-3 py-1.5 rounded-xl text-center break-words leading-tight shadow-md border border-neutral-400 font-medium">
                        {playerStatuses[name]}
                      </div>
                      <div className="w-2 h-2 bg-neutral-200 rotate-45 border-r border-b border-neutral-400 absolute -bottom-1 left-1/2 transform -translate-x-1/2"></div>
                    </div>
                  )}

                  <span className={`px-4 py-1.5 text-sm font-bold border shadow-md flex items-center gap-1 rounded-full ${isMe ? 'bg-neutral-800 border-neutral-400 ring-2 ring-neutral-400' : 'bg-neutral-900 border-neutral-700'}`}>
                    <span className={getUserColor(name)}>
                      {name} {isMe && <span className="text-[10px] text-[#fbd304] font-bold ml-1 tracking-widest uppercase">(You)</span>}
                    </span>: <span className={score >= 0 ? "text-white" : "text-red-400"}>{score}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* IN-GAME SETTINGS */}
        {showSettings && (
          <div className="bg-neutral-900 border border-neutral-700 p-4 rounded-xl flex flex-col gap-4 shadow-lg">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <h3 className="font-bold text-white flex items-center gap-2">⚙️ Room Settings</h3>
              <button onClick={() => setShowSettings(false)} className="bg-neutral-800 hover:bg-red-900/50 text-neutral-400 hover:text-red-400 rounded-full w-8 h-8 flex items-center justify-center transition" title="Close Settings">
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-neutral-300">Enable Score Limit</label>
                <input type="checkbox" className="w-5 h-5 accent-[#4ade80] rounded cursor-pointer" checked={hasLimit} onChange={(e) => setHasLimit(e.target.checked)} disabled={!!winner} />
              </div>
              <div className="flex items-center justify-between border-t border-neutral-800 pt-3 mt-1">
                <label className="text-sm font-bold text-neutral-300">Enable AI Features 🎙️</label>
                <input type="checkbox" className="w-5 h-5 accent-purple-500 rounded cursor-pointer" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
              </div>
              {hasLimit && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500 uppercase tracking-wider">Target Score to Win</label>
                  <input 
                    type="number" 
                    className="p-2 bg-neutral-950 rounded focus:outline-none focus:ring-1 focus:ring-[#4ade80] transition text-sm font-bold" 
                    value={targetScore} 
                    onChange={(e) => setTargetScore(e.target.value === "" ? "" : parseInt(e.target.value))} 
                    onBlur={() => { if (targetScore === "" || targetScore <= 0) setTargetScore(75); }}
                    onKeyDown={(e) => { if (['e', 'E', '+', '.', '-'].includes(e.key)) e.preventDefault(); }}
                    disabled={!!winner} 
                  />
                </div>
              )}
              <button className="bg-neutral-800 hover:bg-neutral-700 text-sm font-bold p-2 rounded transition mt-1" onClick={broadcastNewSettings} disabled={!!winner}>Save & Broadcast</button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-neutral-500 uppercase tracking-wider">Manage Players (Kick Ghosts)</label>
              <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800 flex flex-col gap-1 max-h-32 overflow-y-auto">
                {Object.keys(playerScores).length === 0 ? (
                  <span className="text-xs text-neutral-600 italic">No players available to kick.</span>
                ) : (
                  Object.keys(playerScores).map(player => (
                    <div key={player} className="flex justify-between items-center bg-neutral-900 px-3 py-1.5 rounded">
                      <span className={`text-sm ${getUserColor(player)}`}>{player}</span>
                      
                      {/* FIX: Ocultar botón de kick para ti mismo */}
                      {player !== username ? (
                        <button onClick={() => kickPlayer(player)} className="text-xs bg-red-900/40 hover:bg-red-600 text-red-200 px-2 py-1 rounded transition border border-red-900/50">
                          Kick
                        </button>
                      ) : (
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">(You)</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat */}
        <div ref={chatRef} className="bg-neutral-900 h-48 md:h-80 rounded-xl border border-neutral-800/60 p-4 overflow-y-auto shadow-inner flex flex-col gap-2">
          {messages.map((msg) => {
            const text = typeof msg === 'string' ? msg : msg.text;
            const key = typeof msg === 'string' ? Math.random() : msg.id;
            const count = typeof msg === 'string' ? 1 : (msg.count || 1);
            
            const isSystemEvent = text.includes("joined") || text.includes("left") || text.includes("restarted");

            // RENDERIZADO DISCRETO Y MÁS GRANDE PARA EVENTOS (Píldoras)
            if (isSystemEvent) {
              const cleanText = text.replace('🟢 ', '').replace('🔴 ', '');
              return (
                <div key={key} className="w-full flex justify-center my-1 opacity-80">
                  <span className="text-xs text-neutral-400 bg-neutral-950 px-5 py-2 rounded-full border border-neutral-800/80 shadow-sm flex items-center">
                    {cleanText} 
                    {count > 1 && <span className="font-bold ml-2 bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded text-[10px]">x{count}</span>}
                  </span>
                </div>
              );
            }

            // RENDERIZADO MINIMALISTA PARA PUNTAJES (Sin colores invasivos)
            return (
              <div key={key} className="p-3 rounded-xl w-fit max-w-[90%] md:max-w-[80%] text-sm md:text-base bg-neutral-800/50 border border-neutral-700/50 shadow-sm flex items-center">
                {renderMessage(text)}
                
                {count > 1 && (
                  <span className="ml-2 bg-neutral-700 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                    x{count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Score Panel */}
        <div className={`flex flex-col gap-4 w-full bg-neutral-900 p-4 rounded-xl border transition ${winner ? 'border-amber-500/50 shadow-lg shadow-amber-900/20' : 'border-neutral-800/60'}`}>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-1">
            <span className="text-sm font-bold text-neutral-400">Score Input Method</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={isManualMath} onChange={(e) => setIsManualMath(e.target.checked)} disabled={!!winner} />
              <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2a7a40]"></div>
              <span className="ml-3 text-sm font-medium text-neutral-300">{isManualMath ? "Manual Math" : "Calculate for me"}</span>
            </label>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {!isManualMath ? (
              <>
                <div className="flex-1 w-full">
                  <label className="block text-sm text-neutral-400 mb-1">Blitz Cards Left (-2)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 bg-neutral-950 rounded-lg border border-red-900/50 focus:border-red-500 text-red-400 font-bold disabled:opacity-50" 
                    value={blitzCards} 
                    onChange={(e) => setBlitzCards(e.target.value)} 
                    onKeyDown={(e) => { if (['e', 'E', '+', '.'].includes(e.key)) e.preventDefault(); }}
                    placeholder="0" 
                    disabled={!!winner} 
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-sm text-neutral-400 mb-1">Dutch Cards Played (+1)</label>
                  <input 
                    type="number" 
                    className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50" 
                    value={dutchCards} 
                    onChange={(e) => setDutchCards(e.target.value)} 
                    onKeyDown={(e) => { if (['e', 'E', '+', '.'].includes(e.key)) e.preventDefault(); }}
                    placeholder="0" 
                    disabled={!!winner} 
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 w-full">
                <label className="block text-sm text-neutral-400 mb-1">Total Round Score</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50" 
                  value={manualScore} 
                  onChange={(e) => setManualScore(e.target.value)} 
                  onKeyDown={(e) => { if (['e', 'E', '+', '.'].includes(e.key)) e.preventDefault(); }}
                  placeholder="e.g. 14 or -4" 
                  disabled={!!winner} 
                />
              </div>
            )}

            <div className="flex items-end w-full md:w-auto mt-2 md:mt-0 gap-2">
              {winner && (
                <button className="w-full md:w-auto p-3 px-6 h-[50px] rounded-lg font-bold transition shadow-lg bg-[#005ba1] hover:bg-blue-500 text-white" onClick={restartGame}>
                  🔄 REMATCH
                </button>
              )}
              <button className={`w-full md:w-auto p-3 px-8 h-[50px] rounded-lg font-bold transition shadow-lg ${winner ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed border border-neutral-700' : 'bg-[#4ade80] hover:bg-green-400 text-black'}`} onClick={submitScore} disabled={!!winner}>
                {winner ? "GAME OVER" : "SUBMIT"}
              </button>
            </div>
          </div>
        </div>

        {/* Beautiful AI Recap Section */}
        {aiEnabled && (
          <div className="bg-neutral-900 p-1 rounded-xl bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 shadow-lg shadow-purple-900/20 mb-8">
            <div className="bg-neutral-950 rounded-lg p-3 h-full w-full">
              <button className={`p-3 rounded-lg font-bold transition-all w-full shadow-lg border border-purple-500/30 ${isGenerating ? "bg-neutral-900 animate-pulse text-purple-400" : "bg-purple-900/40 hover:bg-purple-800/60 text-purple-200"}`} onClick={generateAIRecap} disabled={isGenerating}>
                {isGenerating ? "🎙️ Generating studio broadcast..." : "🎙️ Generate AI Match Recap"}
              </button>

              {recap && (
                <div className="mt-4 p-4 bg-neutral-900/50 rounded-lg border border-purple-500/20 shadow-inner">
                  <div className="flex items-center gap-2 mb-3 border-b border-purple-900/50 pb-2">
                    <span className="text-xl">📻</span>
                    <span className="font-bold text-purple-300 uppercase tracking-widest text-xs">Live Studio Broadcast</span>
                  </div>
                  <div className="pl-2 border-l-2 border-purple-500/50">
                    {renderAIText(recap)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}