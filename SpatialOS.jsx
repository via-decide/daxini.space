import React, { useState, useEffect, useRef } from 'react';

// Registered macro pattern codes
const MACRO_APPS = {
  'UP,RIGHT,DOWN': 'Zayvora Engine',
  'LEFT,UP,RIGHT': 'Decision Core',
  'DOWN,LEFT,UP': 'Code Nexus'
};

export const SpatialOS = () => {
  // Navigation State: Path representation of recursive spatial matrix
  // E.g. ['5'] is Home Anchor. ['5', '7'] is Node 7 on Floor 0. ['5', '7', '2'] is Node 7 elevated once.
  const [path, setPath] = useState(['5']);
  const [limitWarning, setLimitWarning] = useState(false);
  const [transitionState, setTransitionState] = useState('idle'); // 'idle' | 'zooming-in' | 'zooming-out' | 'sliding'

  // Macro Engine State
  const [tracePath, setTracePath] = useState([]);
  const [activeApp, setActiveApp] = useState(null);

  // Raw Console Telemetry Logs
  const [logs, setLogs] = useState([
    '[BOOT] INITIALIZING SPATIAL OS MATRIX V4.2...',
    '[BOOT] DECOUPLING LEGACY DESKTOP METAPHOR CORRIDORS...',
    '[BOOT] DETECTING CORE GRAVITY MATRIX ANCHOR...',
    '[BOOT] READY FOR MULTI-LEVEL KEYBOARD PATH SELECTIONS'
  ]);

  const keyHistoryRef = useRef([]);
  const debounceTimerRef = useRef(null);
  const logTerminalEndRef = useRef(null);

  // Helper to add timestamped logs
  const addLog = (message) => {
    setLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Scroll logs container to bottom on update
  useEffect(() => {
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Inject custom cyber aesthetics styles on mount
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap');
      
      .spatial-os-container {
        font-family: 'Fira Code', monospace;
        background-color: #050505;
        color: #e5e8f0;
      }
      
      .hud-title {
        font-family: 'Space Grotesk', sans-serif;
      }

      /* Parallax Matrix Zoom Transitions */
      .matrix-zoom-in {
        animation: matrixZoomInAnimation 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
      }
      .matrix-zoom-out {
        animation: matrixZoomOutAnimation 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
      }

      @keyframes matrixZoomInAnimation {
        0% {
          transform: scale(0.65) translateZ(0);
          opacity: 0.1;
          filter: blur(8px);
        }
        100% {
          transform: scale(1) translateZ(0);
          opacity: 1;
          filter: blur(0);
        }
      }

      @keyframes matrixZoomOutAnimation {
        0% {
          transform: scale(1.5) translateZ(0);
          opacity: 0.1;
          filter: blur(12px);
        }
        100% {
          transform: scale(1) translateZ(0);
          opacity: 1;
          filter: blur(0);
        }
      }

      /* Scanline sweep simulation */
      .scanline {
        background: linear-gradient(
          to bottom,
          rgba(255, 255, 255, 0),
          rgba(0, 255, 204, 0.05) 50%,
          rgba(255, 255, 255, 0)
        );
        background-size: 100% 20px;
        animation: scanlineAnimation 10s linear infinite;
      }

      @keyframes scanlineAnimation {
        0% { background-position: 0 0; }
        100% { background-position: 0 100%; }
      }
      
      .node-active-glow {
        box-shadow: inset 0 0 18px rgba(0, 255, 204, 0.25), 0 0 12px rgba(0, 255, 204, 0.2);
        border-color: #00ffcc !important;
      }
      
      .cursor-blink::after {
        content: '▋';
        animation: blink 1.2s step-start infinite;
      }
      
      @keyframes blink {
        50% { opacity: 0; }
      }

      .svg-trace-line {
        stroke-dasharray: 800;
        stroke-dashoffset: 800;
        animation: traceDraw 0.6s ease-in-out forwards;
      }

      @keyframes traceDraw {
        to {
          stroke-dashoffset: 0;
        }
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Compute stats from the path
  const depth = path.length - 1; // Number of steps taken from Home Anchor
  
  // Z elevation calculated by occurrences of UP (Node 2) minus DOWN (Node 8)
  const zElevation = path.slice(1).reduce((acc, curr) => {
    if (curr === '2') return acc + 1;
    if (curr === '8') return acc - 1;
    return acc;
  }, 0);

  // Procedural Room State generator mapping the hierarchical address
  const getRoomData = (nodeIndex) => {
    // Generate distinct rooms dynamically based on full hierarchical address path
    const sectors = ["Orion", "Titan", "Kepler", "Hyperion", "Vela", "Sirius", "Vega", "Rigel", "Polaris"];
    const functions = ["Vault", "Logic Reactor", "System Gateway", "Synaptic Relay", "Archive", "Spectrum Console", "Telemetry Deck", "Core Processor", "Data Node"];

    const currentAddress = [...path, nodeIndex.toString()];
    const pathString = currentAddress.join(',');
    
    // Hash generator based on current path string to guarantee deterministic states
    let hash = 0;
    for (let i = 0; i < pathString.length; i++) {
      hash = ((hash << 5) - hash) + pathString.charCodeAt(i);
      hash |= 0;
    }
    hash = Math.abs(hash);

    const sector = sectors[hash % sectors.length];
    const func = functions[(hash + 3) % functions.length];

    if (nodeIndex === 5) {
      const isHome = path.length === 1 && path[0] === '5';
      return {
        title: isHome ? 'Home Anchor' : `ANCHOR [${path.join('➔')}]`,
        id: isHome ? '0x000-CORE' : `0x${hash.toString(16).toUpperCase().substring(0,3)}`,
        desc: isHome ? 'System Core Gravitational Center' : `Local Sub-Anchor. Address: ${pathString}`,
        status: isHome ? 'ANCHOR ACTIVE' : 'LOCAL NEST RESUMED'
      };
    }

    return {
      title: `${sector} ${func}`,
      id: `0x${hash.toString(16).toUpperCase().substring(0,3)}`,
      desc: `ADDRESS: ${pathString} | Z: ${zElevation}`,
      status: 'SUSPENDED STATE'
    };
  };

  // Maps nodes to coordinates for drawing paths dynamically
  const getSvgCoordinates = (node) => {
    const coords = {
      'UP': { cx: '50%', cy: '16.66%' },
      'DOWN': { cx: '50%', cy: '83.33%' },
      'LEFT': { cx: '16.66%', cy: '50%' },
      'RIGHT': { cx: '83.33%', cy: '50%' },
      'CENTER': { cx: '50%', cy: '50%' }
    };
    return coords[node] || { cx: '50%', cy: '50%' };
  };

  // Keyboard navigation controller
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key;

      // Escape / Numpad 5: Reset matrix completely
      if (key === 'Escape' || key === '5' || key === 'Clear') {
        e.preventDefault();
        setTransitionState('zooming-out');
        setPath(['5']);
        setActiveApp(null);
        setTracePath([]);
        keyHistoryRef.current = [];
        addLog('[NAV] GRAV-ANCHOR RESET: Core status fully collapsed back to [5].');
        setTimeout(() => setTransitionState('idle'), 500);
        return;
      }

      // Block grid movements if a macro overlay application is open
      if (activeApp) return;

      let keyDirection = '';
      let targetNode = '';

      // Map keyboard to layout matching telephone layout blueprint:
      // 1 2 3
      // 4 5 6
      // 7 8 9
      if (key === 'ArrowUp' || key === '2' || key === 'w' || key === 'W') {
        e.preventDefault();
        keyDirection = 'UP';
        targetNode = '2';
      } else if (key === 'ArrowDown' || key === '8' || key === 's' || key === 'S') {
        e.preventDefault();
        keyDirection = 'DOWN';
        targetNode = '8';
      } else if (key === 'ArrowLeft' || key === '4' || key === 'a' || key === 'A') {
        e.preventDefault();
        keyDirection = 'LEFT';
        targetNode = '4';
      } else if (key === 'ArrowRight' || key === '6' || key === 'd' || key === 'D') {
        e.preventDefault();
        keyDirection = 'RIGHT';
        targetNode = '6';
      } else if (['1', '3', '7', '9'].includes(key)) {
        e.preventDefault();
        targetNode = key;
        keyDirection = key === '1' ? 'UP-LEFT' : key === '3' ? 'UP-RIGHT' : key === '7' ? 'DOWN-LEFT' : 'DOWN-RIGHT';
      }

      if (targetNode) {
        // Evaluate the 4-step limit boundary condition
        if (path.length >= 5) {
          setLimitWarning(true);
          addLog(`[WARN] STATE OVERFLOW: Exceeded max 4 steps from Home Anchor. Path locked.`);
          setTimeout(() => setLimitWarning(false), 1000);
          return;
        }

        // Set layout transition states
        if (targetNode === '2') {
          setTransitionState('zooming-in');
        } else if (targetNode === '8') {
          setTransitionState('zooming-out');
        } else {
          setTransitionState('sliding');
        }

        // Append target node to path (fractal navigation)
        const newPath = [...path, targetNode];
        setPath(newPath);
        addLog(`[NAV] VECTOR TRANSLATION: Moved to sector [${newPath.join(' ➔ ')}]`);

        setTimeout(() => setTransitionState('idle'), 500);

        // Process key history for Macro engine check
        if (keyDirection) {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          const currentBuffer = [...keyHistoryRef.current, keyDirection].slice(-3);
          keyHistoryRef.current = currentBuffer;

          const sequence = currentBuffer.join(',');
          if (MACRO_APPS[sequence]) {
            const app = MACRO_APPS[sequence];
            setTracePath(currentBuffer);
            addLog(`[SYSTEM] LOCKING INTERCEPT: Pattern Match found [${currentBuffer.join(' ➔ ')}]. Building signal trace...`);
            
            setTimeout(() => {
              setActiveApp(app);
              addLog(`[STATE RESUMED] Suspended session loaded for app: ${app}`);
              setTracePath([]);
              keyHistoryRef.current = [];
            }, 800);
          }

          // Debounce clean pattern buffer
          debounceTimerRef.current = setTimeout(() => {
            keyHistoryRef.current = [];
          }, 1200);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [path, activeApp]);

  // Click handler to simulate key inputs
  const handleNodeClick = (nodeIndex) => {
    if (activeApp) return;
    
    if (nodeIndex === 5) {
      // Escape back to center
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    } else {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: nodeIndex.toString() }));
    }
  };

  return (
    <div className="spatial-os-container relative flex flex-col h-screen w-screen overflow-hidden select-none p-4 pb-safe border border-zinc-900">
      
      {/* Background Laser overlays */}
      <div className="absolute inset-0 scanline pointer-events-none z-10 opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-950/20 via-zinc-950/85 to-black pointer-events-none z-0" />

      {/* Top Header HUD Display */}
      <header className="flex justify-between items-start z-20 text-[11px] text-emerald-400 font-medium tracking-widest pt-2">
        <div className="flex flex-col gap-1.5 bg-zinc-950/80 p-3 rounded border border-emerald-950/30 backdrop-blur-sm">
          <div className="hud-title text-zinc-500 font-bold uppercase text-[9px]">Spatial Coordinate Telemetry</div>
          <div>[ELEVATION: {zElevation >= 0 ? `+${zElevation}` : zElevation}]</div>
          <div>[DEPTH: {depth}/4]</div>
          <div className={depth === 0 ? 'text-cyan-400' : 'text-zinc-500'}>
            [ANCHOR: {depth === 0 ? 'ACTIVE' : 'OFFLINE'}]
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 bg-zinc-950/80 p-3 rounded border border-emerald-950/30 backdrop-blur-sm">
          <div className="hud-title text-zinc-500 font-bold uppercase text-[9px] text-right">System Diagnostics</div>
          <div className="text-cyan-400 font-bold">DAXINI.SPACE OPERATOR</div>
          <div>CPU CORRIDOR: LOCKED</div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            SECURE LINK ACTIVE
          </div>
        </div>
      </header>

      {/* Main Grid Viewport workspace */}
      <main className="flex-1 flex items-center justify-center relative z-10 my-4">
        
        {/* Limit boundary Alert popup */}
        {limitWarning && (
          <div className="absolute inset-0 bg-red-950/50 border border-red-500/80 flex flex-col items-center justify-center z-40 animate-pulse rounded-lg pointer-events-none">
            <div className="text-red-500 font-bold tracking-widest text-lg mb-2">4-STEP PATH LIMIT REACHED</div>
            <div className="text-red-400 text-xs max-w-sm text-center font-mono px-4 leading-relaxed">
              [WARNING: MAXIMUM HIERARCHICAL RESOLUTION CAP REACHED. ESCAPE OR TAP CENTER NODE TO RETURN HOME.]
            </div>
          </div>
        )}

        {/* 3x3 Outer matrix wrapper */}
        <div className="w-[320px] h-[320px] md:w-[480px] md:h-[480px] aspect-square relative rounded-lg border border-zinc-850 bg-zinc-950/40 backdrop-blur-md overflow-hidden p-2">
          
          {/* Signal connection overlay trace */}
          {tracePath.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
              <polyline
                fill="none"
                stroke="#ffcc00"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="svg-trace-line"
                points={tracePath.map(node => {
                  const coords = getSvgCoordinates(node);
                  return `${coords.cx} ${coords.cy}`;
                }).join(', ')}
              />
            </svg>
          )}

          {/* Core recursive Grid cells */}
          <div className={`w-full h-full grid grid-cols-3 grid-rows-3 gap-2 transition-all duration-500 ${
            transitionState === 'zooming-in' ? 'matrix-zoom-in' : 
            transitionState === 'zooming-out' ? 'matrix-zoom-out' : 
            transitionState === 'sliding' ? 'translate-x-0' : ''
          }`}>
            
            {/* Renders cells in telephone layout format: 1-2-3, 4-5-6, 7-8-9 */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((nodeIdx) => {
              const room = getRoomData(nodeIdx);
              const isCenter = nodeIdx === 5;
              const isUpArrow = nodeIdx === 2;
              const isDownArrow = nodeIdx === 8;

              return (
                <div
                  key={nodeIdx}
                  onClick={() => handleNodeClick(nodeIdx)}
                  className={`relative flex flex-col justify-between p-2 md:p-3 border rounded transition-all duration-300 cursor-pointer ${
                    isCenter 
                      ? 'border-cyan-500/35 bg-cyan-950/5 hover:bg-cyan-950/15' 
                      : 'border-zinc-850 bg-zinc-900/10 hover:border-zinc-700 hover:bg-zinc-900/20'
                  }`}
                >
                  {/* Grid numeric key sigil */}
                  <div className="absolute top-1 right-2 text-[9px] text-zinc-600 font-bold">
                    [{nodeIdx}]
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className={`text-[10px] font-bold tracking-wider truncate ${isCenter ? 'text-cyan-400' : 'text-zinc-400'}`}>
                      {room.title.toUpperCase()}
                    </div>
                    {/* Visual directional markers for UP/DOWN lifts */}
                    {isUpArrow && <div className="text-[10px] text-cyan-400 font-bold">▲ [LIFT UP]</div>}
                    {isDownArrow && <div className="text-[10px] text-amber-500 font-bold">▼ [LIFT DOWN]</div>}
                    <div className="text-[8px] text-zinc-500 leading-tight hidden md:line-clamp-2">
                      {room.desc}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-900/40">
                    <span className="text-[7px] text-zinc-600">ID: {room.id}</span>
                    <span className={`text-[8px] font-semibold tracking-widest ${isCenter ? 'text-cyan-400' : 'text-amber-600'}`}>
                      {room.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Suspended Application View Overlay */}
          {activeApp && (
            <div className="absolute inset-0 bg-black/95 z-40 border border-cyan-400 p-4 md:p-6 flex flex-col justify-between animate-fade-in animate-duration-300">
              <header className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <div className="flex flex-col">
                  <div className="text-cyan-400 text-xs font-bold tracking-widest uppercase">
                    [ACTIVE SHARD CONTAINER]
                  </div>
                  <div className="text-white text-base md:text-lg font-bold font-sans">
                    {activeApp}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveApp(null);
                    addLog('[SYSTEM] APPLICATION DISMISSED. Returning back to Spatial grid view.');
                  }}
                  className="text-zinc-500 hover:text-cyan-400 border border-zinc-800 hover:border-cyan-400 px-3 py-1 text-xs rounded transition-all"
                >
                  DISMISS [ESC]
                </button>
              </header>

              <main className="flex-1 flex flex-col justify-center gap-4 my-4 font-mono">
                {/* Active Application Wireframe Simulation */}
                <div className="border border-zinc-850 rounded p-4 bg-zinc-950 flex-1 flex flex-col justify-between text-xs relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 text-[10px] text-emerald-500/30">
                    [SECURE RUNTIME ENVIRONMENT]
                  </div>
                  
                  <div className="flex flex-col gap-2 text-zinc-400">
                    <p className="text-white font-bold">[STATE RESUMED]</p>
                    <p>• Loading suspended reasoning loop...</p>
                    <p>• Memory state verified: SHA-256 integrity OK</p>
                    <p>• Syncing credit balance ledger...</p>
                  </div>

                  {activeApp === 'Zayvora Engine' && (
                    <div className="border border-cyan-950 bg-cyan-950/10 p-3 rounded text-[10px] text-cyan-400 flex flex-col gap-1.5">
                      <div className="font-bold">ZAYVORA REASONING ENGINE V3</div>
                      <div>Input Query: [WAITING ON OPERATOR COMMAND]</div>
                      <div className="w-full bg-cyan-950/30 h-1.5 rounded overflow-hidden relative">
                        <div className="bg-cyan-400 h-full w-2/3 rounded animate-pulse" />
                      </div>
                    </div>
                  )}

                  {activeApp === 'Decision Core' && (
                    <div className="border border-amber-950 bg-amber-950/10 p-3 rounded text-[10px] text-amber-500 flex flex-col gap-1.5">
                      <div className="font-bold">VIA DECISION CORE MATRIX</div>
                      <div>Calculated Decision Branches: [STANDBY]</div>
                      <div className="grid grid-cols-5 gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="bg-amber-500/20 h-4 border border-amber-500/40 rounded flex items-center justify-center text-[8px] font-bold">
                            #{i}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeApp === 'Code Nexus' && (
                    <div className="border border-zinc-850 bg-zinc-900/10 p-3 rounded text-[10px] text-zinc-400 flex flex-col gap-1">
                      <div className="font-bold text-white">CODE NEXUS REPOSITORY FEED</div>
                      <div className="font-mono text-zinc-500 truncate">src/core/system/deploymentEngine.js - L128</div>
                      <div className="text-[9px] text-emerald-400">Commit: [SOVEREIGN CODEBASE DIRECT INJECTION OK]</div>
                    </div>
                  )}
                </div>
              </main>

              <footer className="text-[10px] text-zinc-500 flex justify-between border-t border-zinc-900 pt-3">
                <span>NAMESPACE: via-decide/daxini.space</span>
                <span>STATUS: STANDBY</span>
              </footer>
            </div>
          )}

        </div>
      </main>

      {/* Console log outputs terminal */}
      <footer className="h-1/5 md:h-1/4 min-h-[110px] bg-black border border-zinc-900 rounded p-3 flex flex-col justify-between font-mono z-20">
        <div className="flex justify-between items-center text-[9px] text-zinc-500 border-b border-zinc-950 pb-1.5 mb-1.5">
          <span className="tracking-widest font-bold text-cyan-500 uppercase">SYS_LOG FEED_STDOUT</span>
          <span>CURRENT PATH: {path.length > 0 ? `[${path.join(' ➔ ')}]` : '[EMPTY]'}</span>
        </div>

        {/* Stdout scrolling screen */}
        <div className="flex-1 overflow-y-auto text-[10px] leading-relaxed text-zinc-400 pr-1 flex flex-col gap-0.5">
          {logs.map((log, index) => (
            <div key={index} className="truncate">
              {log}
            </div>
          ))}
          <div ref={logTerminalEndRef} className="cursor-blink text-emerald-400 text-[10px]" />
        </div>
      </footer>
    </div>
  );
};
