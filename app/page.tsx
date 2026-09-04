"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Song = { id:number; title:string; artist:string; album:string; preview:string; artwork:string; progarchives:string };
const STAGES = [0.1, 1, 3, 5, 10, 15];
const normalize = (value:string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const label = (song:Song) => `${song.title} — ${song.artist}`;

export default function Home() {
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [answer, setAnswer] = useState<Song | null>(null);
  const [stage, setStage] = useState(0);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [result, setResult] = useState<"playing"|"won"|"lost">("playing");
  const [audioState, setAudioState] = useState<"idle"|"playing"|"error">("idle");
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newRound = (songs = catalog) => {
    if (!songs.length) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    audioRef.current?.pause();
    const previous = Number(localStorage.getItem("prog-snippet-last"));
    const pool = songs.length > 1 ? songs.filter((song) => song.id !== previous) : songs;
    const next = pool[Math.floor(Math.random() * pool.length)];
    localStorage.setItem("prog-snippet-last", String(next.id));
    setAnswer(next); setStage(0); setQuery(""); setHistory([]); setResult("playing"); setAudioState("idle");
  };

  useEffect(() => {
    fetch("./catalog.json")
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((songs:Song[]) => { setCatalog(songs); newRound(songs); })
      .catch(() => setAudioState("error"));
  }, []);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const suggestions = useMemo(() => {
    const needle = normalize(query);
    if (needle.length < 2) return [];
    const seen = new Set<string>();
    return catalog.filter((song) => {
      const key = normalize(label(song));
      if (!key.includes(needle) || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 7);
  }, [catalog, query]);

  const stopAudio = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    audioRef.current?.pause(); setAudioState("idle");
  };
  const play = async () => {
    const audio = audioRef.current;
    if (!audio || !answer || result !== "playing") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    audio.pause(); audio.currentTime = 0;
    try { await audio.play(); setAudioState("playing"); timerRef.current = setTimeout(stopAudio, STAGES[stage] * 1000); }
    catch { setAudioState("error"); }
  };
  const advance = (entry:string) => {
    stopAudio(); setHistory((items) => [...items, entry]);
    if (stage === STAGES.length - 1) setResult("lost"); else setStage((value) => value + 1);
    setQuery("");
  };
  const submitGuess = (event:FormEvent) => {
    event.preventDefault();
    if (!answer || !query.trim() || result !== "playing") return;
    const chosen = catalog.find((song) => normalize(label(song)) === normalize(query));
    if (chosen && normalize(label(chosen)) === normalize(label(answer))) { stopAudio(); setHistory((items) => [...items, `Correct: ${label(answer)}`]); setResult("won"); }
    else advance(query.trim());
  };
  const reveal = () => { if (answer) { stopAudio(); setHistory((items) => [...items, "Gave up"]); setResult("lost"); } };

  return <main>
    <header className="topbar">
      <a className="brand" href="./" aria-label="Prog Snippet home"><span className="brand-mark">P</span><span>PROG SNIPPET</span></a>
      <button className="new-button" onClick={() => newRound()} disabled={!catalog.length}>New song <span aria-hidden="true">↗</span></button>
    </header>
    <section className="game-shell">
      <div className="eyebrow">A progressive rock ear test</div>
      <h1>Name that track.</h1>
      <p className="lede">Six chances. The first clue is only a tenth of a second.</p>
      <div className="progress" aria-label={`Clue ${stage + 1} of ${STAGES.length}`}>
        {STAGES.map((seconds,index) => <div className={`progress-step ${index < stage ? "used" : ""} ${index === stage ? "active" : ""}`} key={seconds}><span>{seconds}s</span></div>)}
      </div>
      <div className="player-card">
        <div className="record" aria-hidden="true"><div className="record-label">?</div></div>
        <div className="player-copy"><span className="clue-label">CLUE {stage + 1} / {STAGES.length}</span><strong>{result === "playing" ? `${STAGES[stage]} second${STAGES[stage] === 1 ? "" : "s"}` : "Round complete"}</strong><span>{audioState === "error" ? "Preview unavailable — try a new song." : audioState === "playing" ? "Listen closely…" : "Starts at the beginning of the preview"}</span></div>
        <button className={`play-button ${audioState === "playing" ? "is-playing" : ""}`} onClick={audioState === "playing" ? stopAudio : play} disabled={!answer || result !== "playing"} aria-label={audioState === "playing" ? "Stop clip" : `Play ${STAGES[stage]} second clip`}>{audioState === "playing" ? "■" : "▶"}</button>
      </div>
      {history.length > 0 && <ol className="history" aria-label="Previous guesses">{history.map((item,index) => <li key={`${item}-${index}`}><span>{String(index + 1).padStart(2,"0")}</span>{item}</li>)}</ol>}
      {result === "playing" ? <form onSubmit={submitGuess} className="guess-form">
        <label htmlFor="guess">Your guess</label>
        <div className="input-wrap"><input id="guess" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search song or artist…" autoComplete="off" />
          {suggestions.length > 0 && <div className="suggestions">{suggestions.map((song) => <button type="button" key={song.id} onClick={() => setQuery(label(song))}><b>{song.title}</b><span>{song.artist}</span></button>)}</div>}
        </div>
        <button className="submit-button" type="submit" disabled={!query.trim()}>Guess</button>
      </form> : answer ? <div className="answer-card"><img src={answer.artwork} alt="" /><div><span>{result === "won" ? "You got it" : "The answer was"}</span><h2>{answer.title}</h2><p>{answer.artist} · {answer.album}</p></div><a href={answer.progarchives} target="_blank" rel="noreferrer">Find on ProgArchives ↗</a></div> : null}
      <div className="actions">{result === "playing" ? <><button onClick={() => advance("Skipped")}>{stage < STAGES.length - 1 ? `Skip to ${STAGES[stage + 1]}s` : "Use final skip"}</button><button onClick={reveal}>Give up</button></> : <button className="again" onClick={() => newRound()}>Play another song</button>}</div>
      <audio ref={audioRef} src={answer?.preview} preload="auto" onEnded={() => setAudioState("idle")} />
    </section>
    <footer><p><b>{catalog.length.toLocaleString()}</b> previewable tracks from artists catalogued by <a href="https://www.progarchives.com/" target="_blank" rel="noreferrer">ProgArchives</a>.</p><p>Audio previews and artwork provided by Apple. Fan-made and unaffiliated.</p></footer>
  </main>;
}
