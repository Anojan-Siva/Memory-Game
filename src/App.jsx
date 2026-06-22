import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

import backgroundImg from './assets/Background.png';
import idleDown from './assets/Sprites/IDLE/idle_down.png';
import idleUp from './assets/Sprites/IDLE/idle_up.png';
import idleLeft from './assets/Sprites/IDLE/idle_left.png';
import idleRight from './assets/Sprites/IDLE/idle_right.png';
import runDown from './assets/Sprites/RUN/run_down.png';
import runUp from './assets/Sprites/RUN/run_up.png';
import runLeft from './assets/Sprites/RUN/run_left.png';
import runRight from './assets/Sprites/RUN/run_right.png';
import introVideo from './assets/Memory Game Intro.mp4';

const FRAME_COUNT = 8;
const FRAME_MS = 110;
const SPRITE_SCALE = 0.75;
const CHAR_W = Math.round(96 * SPRITE_SCALE);
const CHAR_H = Math.round(80 * SPRITE_SCALE);

const SPRITES = {
  idle: { down: idleDown, up: idleUp, left: idleLeft, right: idleRight },
  run: { down: runDown, up: runUp, left: runLeft, right: runRight },
};

const GRID_TOP = 24.98;
const GRID_LEFT = 11.7;
const GRID_WIDTH = 76.6;
const GRID_HEIGHT = 53.72;
const GRID_COLS = 24;
const GRID_ROWS = 11;

const CELL_W = GRID_WIDTH / GRID_COLS;
const CELL_H = GRID_HEIGHT / GRID_ROWS;

const ENT_COL = 11;
const ENT_ROW = -1;

function generatePath(difficulty) {
  let minLen = 12, maxLen = 16;
  if (difficulty === 'medium') { minLen = 20; maxLen = 35; }
  if (difficulty === 'hard') { minLen = 40; maxLen = 100; }

  for (let attempt = 0; attempt < 2000; attempt++) {
    const path = [];
    const visited = new Set();
    let r = 0, c = ENT_COL;

    path.push({ row: r, col: c });
    visited.add(`${r},${c}`);

    let stuck = false;
    while (!(r === GRID_ROWS - 1 && c === ENT_COL)) {
      const dirs = [
        { dr: 1, dc: 0, weight: difficulty === 'easy' ? 10 : (difficulty === 'medium' ? 6 : 2) },
        { dr: 0, dc: 1, weight: difficulty === 'easy' ? 2 : (difficulty === 'medium' ? 4 : 6) },
        { dr: 0, dc: -1, weight: difficulty === 'easy' ? 2 : (difficulty === 'medium' ? 4 : 6) },
        { dr: -1, dc: 0, weight: difficulty === 'easy' ? 0 : (difficulty === 'medium' ? 1 : 3) }
      ];

      const validDirs = dirs.filter(d => {
        const nr = r + d.dr, nc = c + d.dc;
        return nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && !visited.has(`${nr},${nc}`);
      });

      if (validDirs.length === 0) {
        stuck = true;
        break;
      }

      const totalWeight = validDirs.reduce((sum, d) => sum + d.weight, 0);
      let rVal = Math.random() * totalWeight;
      let chosen = validDirs[0];
      for (const d of validDirs) {
        rVal -= d.weight;
        if (rVal <= 0) {
          chosen = d;
          break;
        }
      }

      r += chosen.dr;
      c += chosen.dc;
      path.push({ row: r, col: c });
      visited.add(`${r},${c}`);
    }

    if (!stuck && path.length >= minLen && path.length <= maxLen) {
      return path;
    }
  }

  return Array.from({ length: GRID_ROWS }, (_, i) => ({ row: i, col: ENT_COL }));
}

const tileKey = (r, c) => `${r},${c}`;

function cellCentre(row, col) {
  return {
    x: GRID_LEFT + (col + 0.5) * CELL_W,
    y: GRID_TOP + (row + 0.5) * CELL_H,
  };
}

export default function App() {

  const [phase, setPhase] = useState('intro');
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [litTiles, setLitTiles] = useState(new Set());
  const [pos, setPos] = useState({ row: ENT_ROW, col: ENT_COL });
  const [facing, setFacing] = useState('down');
  const [walking, setWalking] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const [tileResult, setTileResult] = useState(null);
  const [sequence, setSequence] = useState([]);
  const [seqIndex, setSeqIndex] = useState(0);
  const [difficulty, setDifficulty] = useState('easy');

  const [hintPref, setHintPref] = useState('next_tile');
  const [hintsLeft, setHintsLeft] = useState(0);
  const [hintActive, setHintActive] = useState(false);
  const [hintTiles, setHintTiles] = useState(new Set());

  useEffect(() => {
    const id = setInterval(
      () => setAnimFrame(f => (f + 1) % FRAME_COUNT),
      FRAME_MS
    );
    return () => clearInterval(id);
  }, []);

  const startGame = useCallback((selectedDifficulty) => {
    setDifficulty(selectedDifficulty);
    setPos({ row: ENT_ROW, col: ENT_COL });
    setFacing('down');
    setWalking(false);
    setLitTiles(new Set());
    setHintTiles(new Set());
    setTileResult(null);
    setSeqIndex(0);
    setHintActive(false);

    let hints = 5;
    if (selectedDifficulty === 'medium') hints = 3;
    if (selectedDifficulty === 'hard') hints = 1;
    setHintsLeft(hints);

    setPhase('watching');

    const newPath = generatePath(selectedDifficulty);
    setSequence(newPath);

    let t = 600;
    const speed = selectedDifficulty === 'hard' ? 150 : (selectedDifficulty === 'medium' ? 220 : 300);

    newPath.forEach((tile, idx) => {
      setTimeout(() => {
        setLitTiles(() => {

          const next = new Set();
          for (let i = 0; i <= idx; i++) {
            next.add(tileKey(newPath[i].row, newPath[i].col));
          }
          return next;
        });
      }, t);
      t += speed;
    });

    t += Math.max(1500, newPath.length * 150);

    setTimeout(() => {
      setLitTiles(new Set());
    }, t);
    t += 300;

    setTimeout(() => {
      setPhase(p => p === 'watching' ? 'moving' : p);
    }, t);
  }, []);

  const useHint = useCallback(() => {
    if (phase !== 'moving' || hintActive || hintsLeft <= 0) return;

    setHintsLeft(h => h - 1);
    setHintActive(true);

    if (hintPref === 'next_tile') {

      const nextT = sequence[seqIndex];
      if (nextT) {
        setHintTiles(new Set([tileKey(nextT.row, nextT.col)]));
        setTimeout(() => {
          setHintTiles(new Set());
          setHintActive(false);
        }, 1500);
      } else {
        setHintActive(false);
      }
    } else {

      setLitTiles(new Set());
      let t = 0;
      const speed = difficulty === 'hard' ? 150 : (difficulty === 'medium' ? 220 : 300);

      sequence.forEach((tile, idx) => {
        setTimeout(() => {
          setLitTiles(prev => {
            const next = new Set(prev);
            next.add(tileKey(tile.row, tile.col));
            return next;
          });
        }, t);
        t += speed;
      });

      t += Math.max(1500, sequence.length * 150);

      setTimeout(() => {
        setLitTiles(new Set());
        setHintActive(false);
      }, t);
    }
  }, [phase, hintActive, hintsLeft, hintPref, sequence, seqIndex, difficulty]);

  const move = useCallback((dir) => {
    if (phase !== 'moving' || hintActive) return;

    setFacing(dir);
    setWalking(true);
    setTimeout(() => setWalking(false), 200);

    setPos(prev => {
      let { row, col } = prev;
      if (dir === 'up') row--;
      if (dir === 'down') row++;
      if (dir === 'left') col--;
      if (dir === 'right') col++;

      const onGrid = row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
      const atEntry = row === ENT_ROW && col === ENT_COL;

      if (!onGrid && !atEntry) return prev;

      if (onGrid) {
        const expected = sequence[seqIndex];
        if (expected && row === expected.row && col === expected.col) {

          const nextIdx = seqIndex + 1;
          setSeqIndex(nextIdx);
          setTileResult({ row, col, type: 'correct' });

          if (nextIdx === sequence.length) {

            setPhase('win');
            setTimeout(() => {

              setFacing('down');
              setWalking(true);
              setPos(p => ({ row: p.row + 1, col: p.col }));
            }, 600);
          } else {

            setTimeout(() => setTileResult(null), 350);
          }
        } else {

          setTileResult({ row, col, type: 'wrong' });
          setPhase('gameover');
        }
      }

      return { row, col };
    });
  }, [phase, sequence, seqIndex, hintActive]);

  useEffect(() => {
    const KEY_MAP = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right',
    };
    const onKey = e => {
      const dir = KEY_MAP[e.key];
      if (dir) { e.preventDefault(); move(dir); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  const sprite = SPRITES[walking ? 'run' : 'idle'][facing];
  const { x: cx, y: cy } = cellCentre(pos.row, pos.col);

  const charStyle = {
    left: `calc(${cx}% - ${CHAR_W / 2}px)`,
    top: `calc(${cy}% - ${CHAR_H / 2}px)`,
    width: CHAR_W,
    height: CHAR_H,
    backgroundImage: `url(${sprite})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${CHAR_W * FRAME_COUNT}px ${CHAR_H}px`,
    backgroundPositionX: `${-animFrame * CHAR_W}px`,
  };

  return (
    <div className="game-root" tabIndex={-1}>
      <div className="game-container">
        <img src={backgroundImg} className="game-bg" alt="" aria-hidden="true" />

        <div
          className="grid-overlay"
          style={{
            top: `${GRID_TOP}%`,
            left: `${GRID_LEFT}%`,
            width: `${GRID_WIDTH}%`,
            height: `${GRID_HEIGHT}%`,
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          }}
          aria-hidden="true"
        >
          {Array.from({ length: GRID_ROWS }, (_, row) =>
            Array.from({ length: GRID_COLS }, (_, col) => {
              const k = tileKey(row, col);
              const lit = litTiles.has(k);
              const hint = hintTiles.has(k);
              const isRes = tileResult?.row === row && tileResult?.col === col;
              let cls = 'grid-tile';
              if (lit) cls += ' tile-lit';
              if (hint) cls += ' tile-hint';
              if (isRes && tileResult.type === 'correct') cls += ' tile-correct';
              if (isRes && tileResult.type === 'wrong') cls += ' tile-wrong';
              return <div key={k} className={cls} />;
            })
          )}
        </div>

        <div className="character" style={charStyle} aria-label="Player character" />

        {phase === 'moving' && (
          <button
            className="btn-hint"
            onClick={useHint}
            disabled={hintsLeft <= 0 || hintActive}
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              background: hintsLeft > 0 && !hintActive ? '#ffd700' : '#555',
              color: '#000',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: hintsLeft > 0 && !hintActive ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              boxShadow: hintsLeft > 0 && !hintActive ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none',
              zIndex: 10
            }}
          >
            💡 Hint ({hintsLeft})
          </button>
        )}
      </div>

      {phase === 'idle' && (
        <div className="overlay" id="overlay-start" role="dialog" aria-modal="true">
          <div className="overlay-card">
            <p className="game-sub">
              Watch the path light up — then walk the exact same route!
            </p>
            <div className="controls-hint">
              <span>⬆️ ⬇️ ⬅️ ➡️ </span>
              <span className="hint-sep">or</span>
              <span>W A S D</span>
            </div>

            <div className="hint-config" style={{ margin: '20px 0', padding: '10px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>Hint Mode</div>
              <div style={{ display: 'flex', gap: '20px', fontSize: '1.1rem', color: 'white' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="hintType" value="next_tile" checked={hintPref === 'next_tile'} onChange={e => setHintPref(e.target.value)} />
                  Show Next Tile
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="hintType" value="full_path" checked={hintPref === 'full_path'} onChange={e => setHintPref(e.target.value)} />
                  Show Entire Path
                </label>
              </div>
            </div>

            <div className="difficulty-buttons" style={{ display: 'flex', gap: '15px', marginTop: '10px', justifyContent: 'center' }}>
              <button className="game-btn" onClick={() => startGame('easy')}>Easy</button>
              <button className="game-btn" onClick={() => startGame('medium')}>Medium</button>
              <button className="game-btn" onClick={() => startGame('hard')}>Hard</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div
          className="intro-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#000',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <button
            onClick={() => setIsMuted(!isMuted)}
            style={{
              position: 'absolute',
              top: '30px',
              right: '30px',
              padding: '10px 15px',
              fontSize: '1rem',
              fontFamily: '"Cinzel", "Georgia", serif',
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: '8px',
              cursor: 'pointer',
              zIndex: 210,
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = 'rgba(255,255,255,0.2)')}
            onMouseOut={(e) => (e.target.style.backgroundColor = 'rgba(0,0,0,0.6)')}
          >
            {isMuted ? '🔇 Unmute' : '🔊 Mute'}
          </button>
          <video
            ref={videoRef}
            src={introVideo}
            autoPlay
            muted={isMuted}
            playsInline
            onEnded={() => setPhase('idle')}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          <button
            onClick={() => setPhase('idle')}
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px',
              padding: '12px 24px',
              fontSize: '1.1rem',
              fontFamily: '"Cinzel", "Georgia", serif',
              fontWeight: 'bold',
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.4)',
              borderRadius: '8px',
              cursor: 'pointer',
              zIndex: 210,
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = 'rgba(255,255,255,0.2)')}
            onMouseOut={(e) => (e.target.style.backgroundColor = 'rgba(0,0,0,0.6)')}
          >
            Skip Intro
          </button>
        </div>
      )}

      {(phase === 'watching' || phase === 'moving') && (
        <div
          className={`hud-banner ${phase === 'watching' ? 'hud-watch' : 'hud-move'}`}
          id={phase === 'watching' ? 'hud-watch' : 'hud-move'}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 20px' }}
        >
          <span>
            {phase === 'watching'
              ? 'Memorise the path…'
              : 'Follow the path'}
          </span>
        </div>
      )}

      {phase === 'win' && (
        <div className="overlay" id="overlay-win" role="dialog" aria-modal="true">
          <div className="overlay-card win-card">
            <div className="result-emoji" id="emoji-win">🏆</div>
            <h2 className="result-title">Victory!</h2>
            <p className="result-msg">You walked the entire path without a single misstep!</p>
            <button id="btn-play-again" className="game-btn" onClick={() => setPhase('idle')}>
              ▶&nbsp; Play Again
            </button>
          </div>
        </div>
      )}

      {phase === 'gameover' && (
        <div className="overlay" id="overlay-gameover" role="dialog" aria-modal="true">
          <div className="overlay-card dead-card">
            <div className="result-emoji" id="emoji-dead">💀</div>
            <h2 className="result-title">Game Over</h2>
            <p className="result-msg">You stepped on a trap tile — the floor gave way!</p>
            <button id="btn-retry" className="game-btn" onClick={() => setPhase('idle')}>
              ↩&nbsp; Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

