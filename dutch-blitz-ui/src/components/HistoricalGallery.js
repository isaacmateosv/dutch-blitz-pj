// src/components/HistoricalGallery.js
import { useState, useEffect } from "react";

export default function HistoricalGallery({ t, roomCode, username, playerScores, lang }) {
    const [gallery, setGallery] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState(null);

    // 🔥 MAGIA: Extraemos solo los emojis de los nombres de los jugadores actuales
    // Ejemplo: de "🦊 foxy" sacamos solo "🦊"
    const availableEmojis = [...new Set(Object.keys(playerScores).map(name => name.split(" ")[0]))];

    const fetchGallery = async () => {
        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:8000`;
            const response = await fetch(`${apiBaseUrl}/rooms/${roomCode}/gallery/`);
            if (response.ok) {
                const data = await response.json();
                setGallery(data);
            }
        } catch (error) {
            console.error("Failed to load gallery:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Cargar la galería al inicio y refrescar silenciosamente cada 10 segundos
    // para ver los votos de los demás en vivo
    useEffect(() => {
        if (!roomCode) return;
        fetchGallery();
        const interval = setInterval(fetchGallery, 10000);
        return () => clearInterval(interval);
    }, [roomCode]);

    const handleReact = async (imageId, emoji) => {
        setOpenMenuId(null); // Cerramos el menú
        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:8000`;
            await fetch(`${apiBaseUrl}/gallery/${imageId}/react/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, reaction_emoji: emoji })
            });
            fetchGallery(); // Recargamos para obtener la verdad del servidor
        } catch (error) {
            console.error("Error reacting:", error);
        }
    };

    if (isLoading && gallery.length === 0) return null;
    if (gallery.length === 0) return null;

    return (
        <div className="mt-8 bg-neutral-900 p-1 rounded-xl shadow-lg border border-neutral-800">
            <div className="bg-neutral-950 rounded-lg p-4 flex flex-col gap-6">
                <h3 className="text-sm font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center justify-center gap-2 border-b border-neutral-800 pb-4">
                    🖼️ THE LOUVRE (History) 🖼️
                </h3>

                <div className="flex flex-col gap-8">
                    {gallery.map((img) => {
                        // Elegir el texto correcto según el idioma de la UI
                        const displayText = lang === "es" ? img.prompt_es : img.prompt_en;

                        // Saber si YO reaccioné a esta imagen para resaltarlo
                        const myVotes = img.raw_votes.filter(v => v.user === username).map(v => v.emoji);

                        return (
                            <div key={img.id} className="flex flex-col bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-xl group">
                                {/* LA IMAGEN */}
                                <div className="relative">
                                    <img
                                        src={img.url}
                                        alt="Match Recap"
                                        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-80" />

                                    {/* EL TEXTO ÉPICO SOBRE LA IMAGEN */}
                                    <div className="absolute bottom-0 left-0 right-0 p-4">
                                        <p className="text-sm md:text-base text-purple-100 font-bold drop-shadow-md leading-tight italic border-l-2 border-purple-500 pl-3">
                                            "{displayText}"
                                        </p>
                                    </div>
                                </div>

                                {/* LA BARRA DE REACCIONES */}
                                <div className="p-3 bg-neutral-950 flex flex-wrap items-center gap-2 relative">

                                    {/* Píldoras de reacciones existentes */}
                                    {Object.entries(img.reactions).map(([emoji, count]) => {
                                        const didIVoteThis = myVotes.includes(emoji);
                                        return (
                                            <button
                                                key={emoji}
                                                onClick={() => handleReact(img.id, emoji)}
                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border ${didIVoteThis
                                                        ? 'bg-purple-900/40 border-purple-500 text-purple-200'
                                                        : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-white'
                                                    }`}
                                            >
                                                <span className="text-base">{emoji}</span>
                                                <span>{count}</span>
                                            </button>
                                        );
                                    })}

                                    {/* Botón para Añadir Reacción */}
                                    <div className="relative ml-auto">
                                        <button
                                            onClick={() => setOpenMenuId(openMenuId === img.id ? null : img.id)}
                                            className="h-8 w-8 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 flex items-center justify-center text-neutral-400 transition-colors"
                                            title="Reaccionar"
                                        >
                                            <span className="text-lg leading-none">+</span>
                                        </button>

                                        {/* Menú Flotante de Avatares */}
                                        {openMenuId === img.id && (
                                            <div className="absolute bottom-full right-0 mb-2 p-2 bg-neutral-800 border border-neutral-600 rounded-xl shadow-2xl flex gap-2 animate-fade-in z-20">
                                                {availableEmojis.length > 0 ? (
                                                    availableEmojis.map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => handleReact(img.id, emoji)}
                                                            className="text-xl hover:scale-125 transition-transform"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-neutral-400 whitespace-nowrap px-2">Solo, sin amigos 😢</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}