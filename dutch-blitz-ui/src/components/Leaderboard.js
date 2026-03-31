export default function Leaderboard({ playerScores, playerStatuses, username, getUserColor, t }) {
    if (!playerScores || Object.keys(playerScores).length === 0) return null;

    return (
        <div className="flex flex-wrap justify-center gap-6 p-4">
            {Object.entries(playerScores).map(([name, score]) => {
                const isMe = name === username;
                return (
                    <div key={name} className={`relative flex flex-col items-center ${isMe ? 'scale-105 z-10' : 'opacity-90'}`}>
                        {playerStatuses[name] && (
                            <div className="absolute bottom-full mb-1 w-max max-w-[130px] z-20 pointer-events-none">
                                <div className="text-[10px] text-neutral-800 bg-neutral-200 px-2.5 py-1.5 rounded-xl text-center break-words leading-tight shadow-lg border border-neutral-400 font-bold">
                                    {playerStatuses[name]}
                                </div>
                                <div className="w-2 h-2 bg-neutral-200 rotate-45 border-r border-b border-neutral-400 absolute -bottom-1 left-1/2 transform -translate-x-1/2"></div>
                            </div>
                        )}
                        <span className={`px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-bold border shadow-sm flex items-center gap-1 rounded-full ${isMe ? 'bg-neutral-800 border-neutral-400 ring-1 ring-neutral-400' : 'bg-neutral-900 border-neutral-700'}`}>
                            <span className={getUserColor(name)}>
                                {name} {isMe && <span className="text-[9px] text-[#fbd304] font-black ml-1 tracking-widest uppercase">{t.header.you}</span>}
                            </span>: <span className={score >= 0 ? "text-white" : "text-red-400"}>{score}</span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
}