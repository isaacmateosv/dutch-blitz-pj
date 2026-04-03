import { useState, useEffect } from "react";

export default function AiRecap({ t, lang, aiEnabled, isGenerating, generateAIRecap, recap }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [visualPrompt, setVisualPrompt] = useState(null);

  useEffect(() => {
    setImageUrl(null);
    setVisualPrompt(null);
  }, [recap]);

  // Si la IA está apagada, esto ni siquiera se renderiza (oculta el feature de imagen también)
  if (!aiEnabled) return null;

  const requestImage = async () => {
    setIsGeneratingImage(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:8000`;
      const response = await fetch(`${apiBaseUrl}/game/recap/image/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recap_text: recap })
      });

      if (response.ok) {
        const data = await response.json();
        setImageUrl(data.image_data);
        setVisualPrompt(data.visual_prompt);
      } else {
        alert("El servidor de arte está saturado. ¡Intenta de nuevo en unos segundos!");
      }
    } catch (e) {
      console.error("Error generating image:", e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const renderAIText = (text) => {
    const cleanText = text.replace(/^"|"$/g, '');
    return cleanText.split('\n').map((line, i) => {
      if (!line.trim()) return null;
      const parts = line.split('**');
      return (
        <div key={i} className="mb-3 text-purple-100 leading-relaxed text-sm md:text-base">
          {parts.map((part, index) => index % 2 === 1 ? <strong key={index} className="text-white font-bold">{part}</strong> : part)}
        </div>
      );
    });
  };

  return (
    <div className="bg-neutral-900 p-1 rounded-xl bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 shadow-lg shadow-purple-900/20 mb-8 animate-fade-in">
      <div className="bg-neutral-950 rounded-lg p-3 h-full w-full flex flex-col gap-4">

        <button
          className={`p-4 rounded-lg font-black tracking-widest uppercase transition-all w-full shadow-lg border border-purple-500/30 ${isGenerating ? "bg-neutral-900 animate-pulse text-purple-400" : "bg-purple-900/40 hover:bg-purple-800/60 text-purple-200"}`}
          onClick={generateAIRecap}
          disabled={isGenerating}
        >
          {isGenerating ? t.ai.generatingBtn : t.ai.generateBtn}
        </button>

        {recap && (
          <div className="p-4 bg-neutral-900/50 rounded-lg border border-purple-500/20 shadow-inner flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-purple-900/50 pb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="font-black text-purple-300 uppercase tracking-widest text-[10px]">{t.ai.liveBroadcast}</span>
              </div>
              <span className="text-xs opacity-50 font-mono">LIVE</span>
            </div>

            <div className="pl-3 border-l-2 border-purple-500/50 italic">
              {renderAIText(recap)}
            </div>

            <div className="mt-2 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 min-h-[150px] flex items-center justify-center relative group">
              {imageUrl ? (
                <>
                  {/* 🔥 AVISO DEL PROMPT (Con renderizado de Negritas) */}
                  {visualPrompt && (
                    <div className="absolute top-2 left-2 right-2 bg-black/70 backdrop-blur-sm p-2 rounded text-[10px] md:text-xs text-purple-200 font-mono z-10 border border-purple-500/30 text-center shadow-lg">
                      <span className="text-purple-400 font-bold">PROMPT: </span>
                      {(() => {
                        // Extraemos el texto en el idioma correcto
                        const text = visualPrompt[lang] || visualPrompt.en || (typeof visualPrompt === 'string' ? visualPrompt : "");
                        if (!text) return null;

                        // Parseamos los asteriscos inline para que se vean en negrita
                        return text.split('**').map((part, index) =>
                          index % 2 === 1
                            ? <strong key={index} className="text-white font-black">{part}</strong>
                            : part
                        );
                      })()}
                    </div>
                  )}
                  <img
                    src={imageUrl}
                    alt="AI Match Recap"
                    className="w-full h-auto object-cover animate-fade-in hover:scale-105 transition-transform duration-700"
                  />
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="text-4xl opacity-20 group-hover:opacity-40 transition-opacity">📺</div>
                  <button
                    onClick={requestImage}
                    disabled={isGeneratingImage}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter border transition-all ${isGeneratingImage ? "bg-neutral-900 border-neutral-700 text-neutral-500" : "bg-purple-600/10 border-purple-500/50 text-purple-300 hover:bg-purple-500 hover:text-white"}`}
                  >
                    {isGeneratingImage ? "🖌️ Dibujando el caos..." : "🎨 Ilustrar Partida"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}