"use client";
const EMOJIS = ["👾", "🦊", "🐶", "🐱", "🐰", "🐼", "🐯", "🐸", "🦄", "👽", "👻", "🤖", "🤡", "👹", "👑", "🔥", "🐳", "🫍", "💯", "💩", "💀", "🐢", "🐺", "🦖", "🐝"];

import { useState, useEffect, useRef } from "react";
import RoomSettings from "../components/RoomSettings";
import Lobby from "../components/Lobby";
import ScorePanel from "../components/ScorePanel";
import ChatBox from "../components/ChatBox";
import AiRecap from "../components/AiRecap";

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

  useEffect(() => {
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    setSelectedEmoji(randomEmoji);
    const savedHistory = JSON.parse(localStorage.getItem("blitzRoomHistory") || "[]");
    setRecentRooms(savedHistory);
  }, []);

  useEffect(() => {
    targetScoreRef.current = targetScore;
    playerScoresRef.current = playerScores;
    playerStatusesRef.current = playerStatuses;
    winnerRef.current = winner;
    aiEnabledRef.current = aiEnabled;

    if (isInRoomRef.current) {
      sessionStorage.setItem("blitzScores", JSON.stringify(playerScores));
      sessionStorage.setItem("blitzStatuses", JSON.stringify(playerStatuses));
      sessionStorage.setItem("blitzRules", JSON.stringify({ targetScore }));
      sessionStorage.setItem("blitzMessages", JSON.stringify(messages));
      sessionStorage.setItem("blitzAiEnabled", JSON.stringify(aiEnabled));
      if (winner) sessionStorage.setItem("blitzWinner", winner);
      else sessionStorage.removeItem("blitzWinner");
    }
  }, [targetScore, playerScores, playerStatuses, messages, winner, aiEnabled]);

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
            // Asegúrate de borrar 'hasLimit: hasLimitRef.current' de este envío de vuelta
            ws.current.send(JSON.stringify({ 
              type: "settings", 
              targetScore: targetScoreRef.current, 
              aiEnabled: aiEnabledRef.current, 
              playerScores: playerScoresRef.current, 
              playerStatuses: playerStatusesRef.current, 
              winner: winnerRef.current 
            }));
          }
        }
        else if (data.type === "settings") {
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
          // 1. Calculamos el puntaje AFUERA de setPlayerScores usando la referencia
          const currentScore = playerScoresRef.current[data.username] || 0;
          const newTotal = currentScore + data.roundScore;

          // 2. Imprimimos los puntos en el chat tranquilamente
          if (!data.isSilent) {
            playPopSound();
            if (data.isManual) appendMsg(`${data.username} scored ${data.roundScore} points! | (Manual Math)`);
            else appendMsg(`${data.username} scored ${data.roundScore} points! | (Dutch: ${data.dutch}, Blitz: ${data.blitz})`);
          }

          // 3. Actualizamos el estado de React (Cero efectos secundarios aquí adentro)
          setPlayerScores(prev => ({ ...prev, [data.username]: newTotal }));

          // 4. Revisamos si hubo victoria usando la variable que ya calculamos
          if (newTotal >= targetScoreRef.current && !winnerDeclared.current) {
            winnerDeclared.current = true;
            setWinner(data.username);
            appendMsg(`🏆 ${data.username} HAS WON THE GAME WITH ${newTotal} POINTS! 🏆`);
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 800]);
          }
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

  const broadcastNewSettings = (newScore, newAi) => {
    setTargetScore(newScore);
    setAiEnabled(newAi);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "settings",
        targetScore: newScore,
        aiEnabled: newAi,
        playerScores: playerScoresRef.current,
        playerStatuses: playerStatusesRef.current,
        winner: winnerRef.current
      }));

      const aiMsg = newAi ? '🎙️ AI ON' : '🚫 AI OFF';
      ws.current.send(JSON.stringify({
        type: "system",
        message: `⚙️ ${username} updated the room rules: [First to ${newScore}] | [${aiMsg}]`
      }));
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

  // --- LOBBY SCREEN ---
  if (!isInRoom) {
    return (
      <Lobby
        rawUsername={rawUsername}
        setRawUsername={setRawUsername}
        selectedEmoji={selectedEmoji}
        setSelectedEmoji={setSelectedEmoji}
        roomCode={roomCode}
        setRoomCode={setRoomCode}
        recentRooms={recentRooms}
        joinRoom={joinRoom}
        targetScore={targetScore}
        setTargetScore={setTargetScore}
        inactivityAlert={inactivityAlert}
      />
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
                {/* FIX: Texto fijo, ya no preguntamos por Endless Mode */}
                <p className="text-sm text-neutral-400">First to {targetScore} wins</p>

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
          <RoomSettings
            currentTargetScore={targetScore}
            currentAiEnabled={aiEnabled}
            winner={winner}
            username={username}
            playerScores={playerScores}
            getUserColor={getUserColor}
            kickPlayer={kickPlayer}
            onClose={() => setShowSettings(false)}
            onSave={broadcastNewSettings}
          />
        )}

        {/* Chat Box */}
        <ChatBox 
          messages={messages} 
          playerScores={playerScores} 
          getUserColor={getUserColor} 
        />

        {/* Score Panel */}
        <ScorePanel 
          isManualMath={isManualMath} setIsManualMath={setIsManualMath}
          manualScore={manualScore} setManualScore={setManualScore}
          blitzCards={blitzCards} setBlitzCards={setBlitzCards}
          dutchCards={dutchCards} setDutchCards={setDutchCards}
          winner={winner}
          restartGame={restartGame}
          submitScore={submitScore}
        />

        {/* Beautiful AI Recap Section */}
        <AiRecap 
          aiEnabled={aiEnabled} 
          isGenerating={isGenerating} 
          generateAIRecap={generateAIRecap} 
          recap={recap} 
        />
      </div>
    </div>
  );
}