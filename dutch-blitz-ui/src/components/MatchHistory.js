// src/components/MatchHistory.js
export default function MatchHistory({ t, history, getUserColor }) {
    if (!history || history.length === 0) return null;

    const top10 = history.slice(0, 10);

    return (
        <div className="mt-8 bg-neutral-900/40 rounded-xl border border-neutral-800 p-6 shadow-inner">
            <h3 className="text-sm font-black text-neutral-500 uppercase tracking-[0.2em] mb-4 flex items-center justify-center gap-2">
                🏆 HALL OF FAME 🏆
            </h3>
            <div className="flex flex-col gap-2">
                {top10.map((entry, idx) => {
                    const isPodium = idx < 3;
                    const medal = idx === 0 ? "👑" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

                    const glow = idx === 0
                        ? "border-[#fbd304]/50 shadow-[0_0_15px_rgba(251,211,4,0.15)] bg-gradient-to-r from-neutral-950 to-[#fbd304]/10"
                        : isPodium
                            ? "border-neutral-700/50 bg-neutral-900/60"
                            : "border-neutral-800/30 bg-neutral-950/30 opacity-70 hover:opacity-100";

                    // Padding y tamaños de fuente dinámicos aplicados al div
                    return (
                        <div key={idx} className={`flex justify-between items-center ${isPodium ? 'p-3 md:p-4' : 'px-3 py-2'} rounded-xl border transition-all ${glow}`}>
                            <div className="flex items-center gap-3">
                                <span className={`${isPodium ? 'text-xl md:text-2xl drop-shadow-md' : 'text-sm font-bold text-neutral-500 w-5 text-center'}`}>
                                    {medal}
                                </span>
                                <span className={`${isPodium ? 'text-sm md:text-base font-black' : 'text-xs md:text-sm font-bold'} tracking-wide ${getUserColor(entry.player_name)}`}>
                                    {entry.player_name}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`${isPodium ? 'text-emerald-400 font-black text-xl md:text-2xl' : 'text-emerald-500/50 font-bold text-base'}`}>
                                    {entry.total_score}
                                </span>
                                {isPodium && <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Record</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}