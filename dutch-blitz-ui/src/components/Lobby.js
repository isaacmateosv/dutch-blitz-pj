"use client";

const EMOJIS = ["👾", "🦊", "🐶", "🐱", "🐰", "🐼", "🐯", "🐸", "🦄", "👽", "👻", "🤖", "🤡", "👹", "👑", "🔥", "🐳", "🫍", "💯", "💩", "💀", "🐢", "🐺", "🦖", "🐝"];

export default function Lobby({
    t,
    rawUsername, setRawUsername,
    selectedEmoji, setSelectedEmoji,
    roomCode, setRoomCode,
    recentRooms,
    joinRoom,
    targetScore, setTargetScore,
    inactivityAlert
}) {
    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white p-4">
            <div className="flex flex-col gap-4 bg-neutral-900 p-8 rounded-xl shadow-2xl border border-neutral-800/60 w-full max-w-sm">
                <h1 className="text-3xl font-bold tracking-wider text-center mb-4 text-[#4ade80]">
                    BLITZ<span className="text-white">ROOM</span>
                </h1>

                {inactivityAlert && (
                    <div className="bg-red-900/40 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm text-center font-medium animate-pulse shadow-lg mb-2">
                        {inactivityAlert === "timeout" ? t.lobby.inactivity : inactivityAlert}
                    </div>
                )}

                <div className="flex gap-2">
                    <select
                        className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fbd304] text-xl cursor-pointer"
                        value={selectedEmoji}
                        onChange={(e) => setSelectedEmoji(e.target.value)}
                    >
                        {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <input
                        className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fbd304] transition lowercase w-full"
                        placeholder={t.lobby.username}
                        value={rawUsername}
                        onChange={(e) => setRawUsername(e.target.value)}
                        autoCapitalize="none" autoCorrect="off" spellCheck="false"
                    />
                </div>

                <div className="flex flex-col">
                    <input
                        className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fbd304] transition lowercase"
                        placeholder={t.lobby.room}
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toLowerCase())}
                        autoCapitalize="none" autoCorrect="off" spellCheck="false"
                    />
                    {recentRooms.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {recentRooms.map(room => (
                                <button
                                    key={room}
                                    onClick={() => joinRoom(room)}
                                    className="bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-400 px-3 py-1.5 rounded-full transition border border-neutral-700 hover:border-[#005ba1]/50"
                                >
                                    🕒 {room}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 mt-2 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-neutral-500 uppercase tracking-wider">{t.lobby.targetScore}</label>
                        <input
                            type="number"
                            min="75"
                            className="p-2 bg-neutral-800 rounded focus:outline-none focus:ring-1 focus:ring-[#d22730] transition text-sm font-bold"
                            value={targetScore}
                            onChange={(e) => setTargetScore(e.target.value === "" ? "" : parseInt(e.target.value))}
                            onBlur={() => { if (targetScore === "" || targetScore < 75) setTargetScore(75); }}
                            onKeyDown={(e) => { if (['e', 'E', '+', '.', '-'].includes(e.key)) e.preventDefault(); }}
                        />
                    </div>
                </div>

                <button
                    className="p-3 bg-[#005ba1] hover:bg-blue-600 rounded-md font-bold tracking-wide transition shadow-lg mt-2"
                    onClick={() => joinRoom(roomCode)}
                >
                    {t.lobby.joinBtn}
                </button>
            </div>
        </div>
    );
}