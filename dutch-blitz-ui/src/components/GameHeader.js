export default function GameHeader({
    t,
    roomCode,
    targetScore,
    onlineCount,
    lang,
    toggleLang,
    setShowSettings,
    showSettings,
    leaveRoom,
    authUser
}) {
    return (
        <div className="flex justify-between items-start w-full">
            <button
                onClick={leaveRoom}
                className="text-red-400 font-bold flex items-center gap-1 text-sm bg-red-900/10 px-3 py-1.5 rounded-lg hover:bg-red-900/30 transition border border-red-900/30 mt-1"
            >
                <span className="text-lg leading-none mb-0.5">‹</span> {t.header.exit.replace('🚪 ', '')}
            </button>

            <div className="flex flex-col items-center">
                {/* THE DYNAMIC AUTH BADGE */}
                <div className="mb-1 flex justify-center">
                    {authUser ? (
                        <span className="text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-widest bg-emerald-900/30 text-emerald-400 border-emerald-800">
                            ✓ Registered
                        </span>
                    ) : (
                        <span className="text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-widest bg-neutral-800 text-neutral-400 border-neutral-700">
                            👤 Guest
                        </span>
                    )}
                </div>
                {/* 🔥 FIX: 1-TAP SHARE BUTTON (Ahora copia la URL completa) */}
                <h2
                    onClick={() => {
                        // Generamos el link mágico usando la URL actual de tu web
                        const inviteLink = `${window.location.origin}/?room=${roomCode}`;

                        if (navigator.share) {
                            navigator.share({
                                title: 'BlitzRoom',
                                text: `Join my room: "${roomCode}"`,
                                url: inviteLink
                            }).catch(console.error); // Silenciamos si el usuario cancela
                        } else {
                            navigator.clipboard.writeText(inviteLink);
                            alert("Invite link copied!");
                        }
                    }}
                    className="text-xl md:text-2xl font-black tracking-wider uppercase text-white cursor-pointer hover:scale-105 transition active:scale-95 flex items-center gap-2"
                    title="Click to share room link"
                >
                    {t.header.room} <span className="text-[#fbd304]">{roomCode}</span> <span className="text-sm opacity-50">🔗</span>
                </h2>
                <div className="flex items-center gap-2 mt-1 opacity-80">
                    <p className="text-[10px] md:text-xs text-neutral-400 font-medium tracking-wide">
                        {t.header.firstTo} {targetScore}
                    </p>
                    <span className="w-1 h-1 rounded-full bg-neutral-600"></span>
                    <span className="text-[10px] md:text-xs text-blue-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> {onlineCount} {t.header.online}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-1">
                <button
                    onClick={toggleLang}
                    className="bg-neutral-800 hover:bg-neutral-700 w-8 h-8 rounded-full transition flex items-center justify-center text-sm shadow-sm border border-neutral-700"
                >
                    {lang === 'en' ? '🇬🇧' : '🇪🇸'}
                </button>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="bg-neutral-800 hover:bg-neutral-700 w-8 h-8 rounded-full transition flex items-center justify-center shadow-sm border border-neutral-700"
                    title={t.settings.title}
                >
                    ⚙️
                </button>
            </div>
        </div>
    );
}