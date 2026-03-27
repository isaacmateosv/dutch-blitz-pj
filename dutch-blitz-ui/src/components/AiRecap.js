export default function AiRecap({ aiEnabled, isGenerating, generateAIRecap, recap }) {
  // Si la IA está apagada, no renderizamos nada
  if (!aiEnabled) return null;

  // La función de formateo ahora vive exclusivamente aquí
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

  return (
    <div className="bg-neutral-900 p-1 rounded-xl bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 shadow-lg shadow-purple-900/20 mb-8">
      <div className="bg-neutral-950 rounded-lg p-3 h-full w-full">
        <button 
          className={`p-3 rounded-lg font-bold transition-all w-full shadow-lg border border-purple-500/30 ${isGenerating ? "bg-neutral-900 animate-pulse text-purple-400" : "bg-purple-900/40 hover:bg-purple-800/60 text-purple-200"}`} 
          onClick={generateAIRecap} 
          disabled={isGenerating}
        >
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
  );
}