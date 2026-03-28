export default function MatchHistory({ t, history, getUserColor }) {
    if (!history || history.length === 0) return null;

    // Magia Premium: Agrupamos por jugador y sacamos su récord histórico máximo
    const maxScores = history.reduce((acc, curr) => {
        if (!acc[curr.player_name] || curr.total_score > acc[curr.player_name].total_score) {
            acc[curr.player_name] = curr;
        }
        return acc;
    }, {});

    // Ordenamos de mayor a menor y sacamos el Top 3
    const podium = Object.values(maxScores)
        .sort((a, b) => b.total_score - a.total_score)
        .slice(0, 3);

    return (
        <div className="mt-8 bg-neutral-900/40 rounded-xl border border-neutral-800 p-6 shadow-inner">
            <h3 className="text-sm font-black text-neutral-500 uppercase tracking-[0.2em] mb-4 flex items-center justify-center gap-2">
                🏆 HALL OF FAME 🏆
            </h3>
            <div className="flex flex-col gap-3">
                {podium.map((entry, idx) => {
                    // Asignamos medallas
                    const medal = idx === 0 ? "👑" : idx === 1 ? "🥈" : "🥉";
                    // El primer lugar brilla en dorado
                    const glow = idx === 0
                        ? "border-[#fbd304]/50 shadow-[0_0_15px_rgba(251,211,4,0.15)] bg-gradient-to-r from-neutral-950 to-[#fbd304]/10"
                        : "border-neutral-800/50 bg-neutral-950/50";

                    return (
                        <div key={idx} className={`flex justify-between items-center p-3 md:p-4 rounded-xl border transition-all ${glow}`}>
                            <div className="flex items-center gap-3">
                                <span className="text-xl md:text-2xl drop-shadow-md">{medal}</span>
                                <span className={`text-sm md:text-base font-black tracking-wide ${getUserColor(entry.player_name)}`}>
                                    {entry.player_name}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-emerald-400 font-black text-xl md:text-2xl">{entry.total_score}</span>
                                <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold">Record</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}