"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Song = { id:number; title:string; artist:string; album:string; rank:number; preview:string; artwork:string; progarchives:string };
type Mode = "easy" | "medium" | "hard";
type GameType = "solo" | "challenge";
type Result = "playing" | "won" | "lost";
type ChallengeResult = { won:boolean; moves:number };
type Stats = { played:number; wins:number; winMoves:number; streak:number; bestStreak:number; distribution:number[] };

const STAGES = [0.1, 0.5, 2, 4, 8, 15];
const MODE_LIMITS:Record<Mode,number> = { easy:10, medium:25, hard:50 };
const MODES:Mode[] = ["easy", "medium", "hard"];
const EMPTY_STATS:Stats = { played:0, wins:0, winMoves:0, streak:0, bestStreak:0, distribution:[0,0,0,0,0,0] };
const normalize = (value:string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const label = (song:Song) => `${song.title} — ${song.artist}`;
const validMode = (value:string | null):value is Mode => value === "easy" || value === "medium" || value === "hard";

function savedMode():Mode {
  const linked = new URLSearchParams(window.location.search).get("mode");
  if (validMode(linked)) return linked;
  const saved = localStorage.getItem("prog-snippet-mode");
  return validMode(saved) ? saved : "medium";
}

function savedStats():Stats {
  try {
    const value = JSON.parse(localStorage.getItem("prog-snippet-stats-v1") ?? "null");
    const numericKeys = ["played", "wins", "winMoves", "streak", "bestStreak"];
    if (value && numericKeys.every((key) => Number.isFinite(value[key])) && Array.isArray(value.distribution) && value.distribution.length === 6 && value.distribution.every(Number.isFinite)) return value;
  } catch { /* Start fresh if local data was edited or corrupted. */ }
  return EMPTY_STATS;
}

export default function Home() {
  const [catalog, setCatalog] = useState<Song[]>([]);
  const [answer, setAnswer] = useState<Song | null>(null);
  const [mode, setMode] = useState<Mode>(savedMode);
  const [gameType, setGameType] = useState<GameType>(() => new URLSearchParams(window.location.search).has("challenge") ? "challenge" : "solo");
  const [challengeSongs, setChallengeSongs] = useState<Song[]>([]);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [challengeResults, setChallengeResults] = useState<ChallengeResult[]>([]);
  const [stats, setStats] = useState<Stats>(savedStats);
  const [copyStatus, setCopyStatus] = useState("");
  const [stage, setStage] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);
  const [result, setResult] = useState<Result>("playing");
  const [audioState, setAudioState] = useState<"idle"|"playing"|"error">("idle");
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const recordedRef = useRef(false);

  const stopAudio = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    audioRef.current?.pause();
    setAudioState("idle");
  };

  const beginSong = (song:Song) => {
    stopAudio();
    localStorage.setItem("prog-snippet-last", String(song.id));
    recordedRef.current = false;
    setAnswer(song); setStage(0); setQuery(""); setSuggestionsOpen(false); setActiveSuggestion(-1);
    setHistory([]); setResult("playing"); setCopyStatus("");
  };

  const poolFor = (songs:Song[], difficulty:Mode) => songs.filter((song) => song.rank <= MODE_LIMITS[difficulty]);

  const randomSongs = (songs:Song[], count:number) => {
    const shuffled = [...songs];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    return shuffled.slice(0, count);
  };

  const clearChallengeUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("challenge"); url.searchParams.delete("mode");
    window.history.replaceState({}, "", url);
  };

  const setChallengeUrl = (songs:Song[], difficulty:Mode) => {
    const url = new URL(window.location.href);
    url.searchParams.set("challenge", songs.map((song) => song.id).join("."));
    url.searchParams.set("mode", difficulty);
    window.history.replaceState({}, "", url);
  };

  const startSolo = (songs = catalog, difficulty = mode) => {
    const eligible = poolFor(songs, difficulty);
    if (!eligible.length) return;
    const previous = Number(localStorage.getItem("prog-snippet-last"));
    const choices = eligible.length > 1 ? eligible.filter((song) => song.id !== previous) : eligible;
    setGameType("solo"); setChallengeSongs([]); setChallengeIndex(0); setChallengeResults([]);
    clearChallengeUrl(); beginSong(choices[Math.floor(Math.random() * choices.length)]);
  };

  const startChallenge = (songs = catalog, difficulty = mode, supplied?:Song[]) => {
    const selected = supplied ?? randomSongs(poolFor(songs, difficulty), 5);
    if (selected.length !== 5) return;
    setGameType("challenge"); setChallengeSongs(selected); setChallengeIndex(0); setChallengeResults([]);
    setChallengeUrl(selected, difficulty); beginSong(selected[0]);
  };

  useEffect(() => {
    fetch("./catalog.json")
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((songs:Song[]) => {
        setCatalog(songs);
        const params = new URLSearchParams(window.location.search);
        const linkedMode = validMode(params.get("mode")) ? params.get("mode") as Mode : mode;
        const ids = (params.get("challenge") ?? "").split(".").map(Number).filter(Number.isFinite);
        const linkedSongs = ids.map((id) => songs.find((song) => song.id === id)).filter((song):song is Song => Boolean(song));
        if (ids.length === 5 && linkedSongs.length === 5 && new Set(ids).size === 5 && linkedSongs.every((song) => song.rank <= MODE_LIMITS[linkedMode])) {
          setMode(linkedMode); localStorage.setItem("prog-snippet-mode", linkedMode);
          startChallenge(songs, linkedMode, linkedSongs);
        } else startSolo(songs, linkedMode);
      })
      .catch(() => setAudioState("error"));
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const eligibleCatalog = useMemo(() => poolFor(catalog, mode), [catalog, mode]);

  const changeMode = (nextMode:Mode) => {
    if (nextMode === mode) return;
    setMode(nextMode); localStorage.setItem("prog-snippet-mode", nextMode);
    if (gameType === "challenge") startChallenge(catalog, nextMode); else startSolo(catalog, nextMode);
  };

  const changeGameType = (nextType:GameType) => {
    if (nextType === "challenge") startChallenge(); else startSolo();
  };

  const suggestions = useMemo(() => {
    const needle = normalize(query);
    if (needle.length < 2) return [];
    const seen = new Set<string>();
    return eligibleCatalog.filter((song) => {
      const key = normalize(label(song));
      if (!key.includes(needle) || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [eligibleCatalog, query]);

  useEffect(() => {
    if (activeSuggestion < 0) return;
    suggestionsRef.current?.querySelector<HTMLElement>(`#guess-option-${activeSuggestion}`)?.scrollIntoView({ block:"nearest" });
  }, [activeSuggestion]);

  const selectSuggestion = (song:Song) => { setQuery(label(song)); setSuggestionsOpen(false); setActiveSuggestion(-1); };
  const handleGuessKeyDown = (event:React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen || !suggestions.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveSuggestion((index) => Math.min(index + 1, suggestions.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActiveSuggestion((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Enter" && activeSuggestion >= 0) { event.preventDefault(); selectSuggestion(suggestions[activeSuggestion]); }
    else if (event.key === "Escape") { event.preventDefault(); setSuggestionsOpen(false); setActiveSuggestion(-1); }
  };

  const recordResult = (won:boolean, moves:number) => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    setStats((current) => {
      const distribution = [...current.distribution];
      if (won) distribution[moves - 1] += 1;
      const streak = won ? current.streak + 1 : 0;
      const next = { played:current.played + 1, wins:current.wins + (won ? 1 : 0), winMoves:current.winMoves + (won ? moves : 0), streak, bestStreak:Math.max(current.bestStreak, streak), distribution };
      localStorage.setItem("prog-snippet-stats-v1", JSON.stringify(next));
      return next;
    });
    if (gameType === "challenge") setChallengeResults((current) => [...current, { won, moves }]);
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
    if (stage === STAGES.length - 1) { setResult("lost"); recordResult(false, STAGES.length); }
    else setStage((value) => value + 1);
    setQuery(""); setSuggestionsOpen(false); setActiveSuggestion(-1);
  };

  const submitGuess = (event:FormEvent) => {
    event.preventDefault();
    if (!answer || !query.trim() || result !== "playing") return;
    const chosen = eligibleCatalog.find((song) => normalize(label(song)) === normalize(query));
    if (chosen && normalize(label(chosen)) === normalize(label(answer))) {
      stopAudio(); setHistory((items) => [...items, `Correct: ${label(answer)}`]); setResult("won"); recordResult(true, stage + 1);
    } else advance(query.trim());
  };

  const reveal = () => {
    if (!answer) return;
    stopAudio(); setHistory((items) => [...items, "Gave up"]); setResult("lost"); recordResult(false, stage + 1);
  };

  const nextChallengeSong = () => {
    const next = challengeIndex + 1;
    if (next >= challengeSongs.length) return;
    setChallengeIndex(next); beginSong(challengeSongs[next]);
  };

  const challengeUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("challenge", challengeSongs.map((song) => song.id).join("."));
    url.searchParams.set("mode", mode);
    return url.href;
  };

  const copyText = async (text:string, success:string) => {
    try { await navigator.clipboard.writeText(text); setCopyStatus(success); }
    catch { setCopyStatus("Copy failed — select the address from your browser."); }
  };

  const copyChallengeLink = () => copyText(challengeUrl(), "Challenge link copied!");
  const copyChallengeScore = () => {
    const rows = challengeResults.map((item, index) => {
      const boxes = item.won ? `${"🟧".repeat(item.moves - 1)}🟩${"⬜".repeat(STAGES.length - item.moves)}` : "⬛".repeat(STAGES.length);
      return `${index + 1} ${boxes}`;
    });
    const wins = challengeResults.filter((item) => item.won).length;
    copyText([`PROG!!!!!!!!!!!! Challenge · ${mode.toUpperCase()}`, `${wins}/5 songs`, ...rows, challengeUrl()].join("\n"), "Score copied!");
  };

  const resetStats = () => {
    if (!window.confirm("Reset all stats stored in this browser?")) return;
    localStorage.removeItem("prog-snippet-stats-v1"); setStats(EMPTY_STATS);
  };

  const winRate = stats.played ? Math.round(stats.wins / stats.played * 100) : 0;
  const averageMoves = stats.wins ? (stats.winMoves / stats.wins).toFixed(1) : "—";
  const maxDistribution = Math.max(...stats.distribution, 1);
  const challengeComplete = gameType === "challenge" && challengeIndex === 4 && result !== "playing";

  return <main>
    <header className="topbar">
      <a className="brand" href="./" aria-label="Prog game"><span className="brand-mark">P</span><span>PROG!!!!!!!!!!!!</span></a>
      <button className="new-button" onClick={() => gameType === "challenge" ? startChallenge() : startSolo()} disabled={!catalog.length}>{gameType === "challenge" ? "New set" : "New song"} <span aria-hidden="true">↗</span></button>
    </header>

    <section className="stats-panel" aria-label="Browser statistics">
      <div className="stats-heading"><b>Your browser stats</b><button type="button" onClick={resetStats}>Reset</button></div>
      <div className="stat-numbers"><div><strong>{stats.wins}</strong><span>Solved</span></div><div><strong>{stats.played}</strong><span>Played</span></div><div><strong>{winRate}%</strong><span>Win rate</span></div><div><strong>{averageMoves}</strong><span>Avg. moves</span></div><div><strong>{stats.streak}</strong><span>Streak</span></div></div>
      <div className="distribution" aria-label="Winning move distribution">{stats.distribution.map((count,index) => <div key={index}><span>{index + 1}</span><i style={{ width:`${Math.max(8, count / maxDistribution * 100)}%` }}>{count}</i></div>)}</div>
    </section>

    <section className="game-shell">
      <div className="eyebrow">how e is your prog ebk???</div>
      <h1>Name this song!</h1>
      <h6>(why does it have 10/8 time signature and/or declare "glockenspiel" and/or have train noises and/or DIONYSUS!! and/or pvz but its hogweed yep yep and/or</h6>

      <div className="game-options">
        <fieldset className="difficulty"><legend>Album pool</legend><div className="mode-switch">{MODES.map((option) => <button type="button" key={option} className={mode === option ? "active" : ""} aria-pressed={mode === option} onClick={() => changeMode(option)}><b>{option}</b><span>Top {MODE_LIMITS[option]}</span></button>)}</div></fieldset>
        <fieldset className="difficulty"><legend>Game</legend><div className="mode-switch round-switch"><button type="button" className={gameType === "solo" ? "active" : ""} aria-pressed={gameType === "solo"} onClick={() => changeGameType("solo")}><b>Solo</b><span>Endless</span></button><button type="button" className={gameType === "challenge" ? "active" : ""} aria-pressed={gameType === "challenge"} onClick={() => changeGameType("challenge")}><b>Challenge</b><span>5 songs</span></button></div></fieldset>
      </div>

      {gameType === "challenge" && challengeSongs.length === 5 && <div className="challenge-bar"><b>Song {challengeIndex + 1} of 5</b><div className="challenge-dots">{[0,1,2,3,4].map((index) => <span key={index} className={index < challengeResults.length ? challengeResults[index].won ? "won" : "lost" : index === challengeIndex ? "current" : ""}>{index + 1}</span>)}</div><button type="button" onClick={copyChallengeLink}>Copy this set</button></div>}

      <div className="progress" aria-label={`Clue ${stage + 1} of ${STAGES.length}`}>{STAGES.map((seconds,index) => <div className={`progress-step ${index < stage ? "used" : ""} ${index === stage ? "active" : ""}`} key={seconds}><span>{seconds}s</span></div>)}</div>
      <div className="player-card">
        <div className="record" aria-hidden="true"><div className="record-label">?</div></div>
        <div className="player-copy"><span className="clue-label">CLUE {stage + 1} / {STAGES.length}</span><strong>{result === "playing" ? `${STAGES[stage]} second${STAGES[stage] === 1 ? "" : "s"}` : "Round complete"}</strong><span>{audioState === "error" ? "Preview unavailable — try a new song." : audioState === "playing" ? "Listen closely…" : "Starts at the beginning of the preview"}</span></div>
        <button className={`play-button ${audioState === "playing" ? "is-playing" : ""}`} onClick={audioState === "playing" ? stopAudio : play} disabled={!answer || result !== "playing"} aria-label={audioState === "playing" ? "Stop clip" : `Play ${STAGES[stage]} second clip`}>{audioState === "playing" ? "■" : "▶"}</button>
      </div>

      {history.length > 0 && <ol className="history" aria-label="Previous guesses">{history.map((item,index) => <li key={`${item}-${index}`}><span>{String(index + 1).padStart(2,"0")}</span>{item}</li>)}</ol>}
      {result === "playing" ? <form onSubmit={submitGuess} className="guess-form">
        <label htmlFor="guess">Your guess</label>
        <div className="input-wrap"><input id="guess" value={query} onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); setActiveSuggestion(-1); }} onFocus={() => setSuggestionsOpen(true)} onKeyDown={handleGuessKeyDown} placeholder="Search song or artist…" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen && suggestions.length > 0} aria-controls="guess-options" aria-activedescendant={activeSuggestion >= 0 ? `guess-option-${activeSuggestion}` : undefined} />
          {suggestionsOpen && suggestions.length > 0 && <div className="suggestions" id="guess-options" role="listbox" ref={suggestionsRef}><div className="suggestions-meta">{suggestions.length} match{suggestions.length === 1 ? "" : "es"}</div>{suggestions.map((song,index) => <button type="button" role="option" aria-selected={index === activeSuggestion} id={`guess-option-${index}`} className={index === activeSuggestion ? "active" : ""} key={song.id} onClick={() => selectSuggestion(song)}><b>{song.title}</b><span>{song.artist}</span></button>)}</div>}
        </div><button className="submit-button" type="submit" disabled={!query.trim()}>Guess</button>
      </form> : answer ? <div className="answer-card"><img src={answer.artwork} alt="" /><div><span>{result === "won" ? "You got it" : "The answer was"}</span><h2>{answer.title}</h2><p>{answer.artist} · {answer.album}</p></div><a href={answer.progarchives} target="_blank" rel="noreferrer">Find on ProgArchives ↗</a></div> : null}

      <div className="actions">{result === "playing" ? <><button onClick={() => advance("Skipped")}>{stage < STAGES.length - 1 ? `Skip to ${STAGES[stage + 1]}s` : "Use final skip"}</button><button onClick={reveal}>Give up</button></> : gameType === "challenge" && !challengeComplete ? <button className="again" onClick={nextChallengeSong}>Next song · {challengeIndex + 2}/5</button> : gameType === "solo" ? <button className="again" onClick={() => startSolo()}>Play another song</button> : null}</div>

      {challengeComplete && <section className="challenge-summary"><span>Challenge complete</span><h2>{challengeResults.filter((item) => item.won).length}/5 songs</h2><div className="summary-rows">{challengeResults.map((item,index) => <div key={index}><b>{index + 1}</b><span>{item.won ? `${item.moves} move${item.moves === 1 ? "" : "s"}` : "Missed"}</span></div>)}</div><div className="share-actions"><button type="button" onClick={copyChallengeScore}>Copy score</button><button type="button" onClick={copyChallengeLink}>Copy challenge link</button><button type="button" onClick={() => startChallenge()}>New challenge</button></div></section>}
      {copyStatus && <p className="copy-status" role="status">{copyStatus}</p>}
      <audio ref={audioRef} src={answer?.preview} preload="auto" onEnded={() => setAudioState("idle")} />
    </section>
    <footer><p><b>{eligibleCatalog.length.toLocaleString()}</b> tracks in {mode} mode · <a href="https://www.progarchives.com/top-prog-albums.asp?salbumtypes=1&smaxresults=50" target="_blank" rel="noreferrer">ProgArchives top {MODE_LIMITS[mode]} albums</a>.</p><p>Audio previews and artwork provided by Apple. Fan-made and unaffiliated.</p></footer>
  </main>;
}
