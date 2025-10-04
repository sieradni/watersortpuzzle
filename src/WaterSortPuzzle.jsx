import React, { useEffect, useMemo, useState, useRef } from "react";

// Water Sort Puzzle - single-file React component
// Tailwind CSS assumed available in the host project

const COLORS = [
	"lime",
	"cyan",
	"yellow",
	"red",
	"orange",
	"blue",
	"magenta",
];

// Utility: deep clone vial state
function cloneVials(vials) {
	return vials.map((v) => ({ ...v, layers: [...v.layers] }));
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
function fisherYatesShuffle(array) {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

// Convert vials to a compact string for hashing/visited
function stateToString(vials) {
	// each vial: color1,color2,...  (bottom -> top)
	return vials.map((v) => v.layers.join(",")).join("|");
}
function stringToVials(s) {
	if (!s) return [];
	return s.split("|").map((part) => ({
		layers: part === "" ? [] : part.split(","),
	}));
}

// Check goal: all vials empty OR full of same color (length === 4)
function isGoal(vials) {
	return vials.every((v) => {
		if (v.layers.length === 0) return true;
		if (v.layers.length !== 4) return false;
		const first = v.layers[0];
		return v.layers.every((l) => l === first);
	});
}

// simulate canPour for an arbitrary vials state
function canPourState(vials, fromIdx, toIdx) {
	if (fromIdx === toIdx) return false;
	const src = vials[fromIdx];
	const dst = vials[toIdx];
	if (!src || !dst) return false;
	if (src.layers.length === 0) return false;
	if (dst.layers.length === 4) return false;
	const topSrc = src.layers[src.layers.length - 1];
	if (dst.layers.length === 0) return true;
	const topDst = dst.layers[dst.layers.length - 1];
	return topDst === topSrc;
}

// perform pour on a copy of vials and return new vials
function doPourState(vials, fromIdx, toIdx) {
	const next = cloneVials(vials);
	const src = next[fromIdx];
	const dst = next[toIdx];
	const color = src.layers[src.layers.length - 1];

	// count contiguous top of same color in src
	let moveCount = 0;
	for (let i = src.layers.length - 1; i >= 0; i--) {
		if (src.layers[i] === color) moveCount++;
		else break;
	}
	const space = 4 - dst.layers.length;
	const actualMove = Math.min(moveCount, space);
	for (let k = 0; k < actualMove; k++) {
		dst.layers.push(src.layers.pop());
	}
	return next;
}

export default function WaterSortPuzzle() {
	const [numVials, setNumVials] = useState(7);
	const [vials, setVials] = useState([]);
	const [selected, setSelected] = useState(null);
	const [history, setHistory] = useState([]);
	const [timeLeft, setTimeLeft] = useState(180);
	const timerRef = useRef(null);
	const [running, setRunning] = useState(false);
	const [message, setMessage] = useState("");

	// Solver state:
	const [solverInfo, setSolverInfo] = useState({
		computing: false,
		found: false,
		minMoves: null,
		firstMove: null, // { from, to } or null
		reason: "",
	});

	// initialize a new game
	function newGame(n = null) {
		const nV = n ?? randomInt(5, 9);
		setNumVials(nV);

		const colorSet = fisherYatesShuffle(COLORS).slice(0, nV - 2);
		const useColors = fisherYatesShuffle(
			colorSet.flatMap((color) => Array(4).fill(color))
		);

		const built = [];
		const extra = ((nV - 2) * 4) % 3;
		for (let i = 0; i < nV; i++) {
			const layers = [];
			if (i < extra && 4 * (nV - 2) > 3 * nV) {
				layers.push(useColors.pop());
			}
			const colorsLeft = useColors.length;
			for (let j = 0; j < Math.min(3, colorsLeft); j++) {
				layers.push(useColors.pop());
			}
			built.push({ layers });
		}

		setVials(built);
		setSelected(null);
		setHistory([]);
		setTimeLeft(180);
		setRunning(true);
		setMessage("");
	}

	// compute score
	const score = useMemo(() => {
		return 100 * numVials + Math.max(0, Math.floor(timeLeft));
	}, [numVials, timeLeft]);

	// Timer effect
	useEffect(() => {
		if (!running) return;
		if (timerRef.current) clearInterval(timerRef.current);
		timerRef.current = setInterval(() => {
			setTimeLeft((t) => {
				if (t <= 1) {
					clearInterval(timerRef.current);
					setRunning(false);
					setMessage("Time's up!");
					return 0;
				}
				return t - 1;
			});
		}, 1000);
		return () => clearInterval(timerRef.current);
	}, [running]);

	// Check win
	useEffect(() => {
		if (vials.length === 0) return;
		if (isGoal(vials)) {
			setRunning(false);
			setMessage("You solved it!");
		}
	}, [vials]);

	// helper: canPour/on-component state
	function canPour(fromIdx, toIdx) {
		return canPourState(vials, fromIdx, toIdx);
	}

	// pour on the component state
	function pour(fromIdx, toIdx) {
		if (!canPour(fromIdx, toIdx)) return false;
		const prev = cloneVials(vials);
		const next = doPourState(prev, fromIdx, toIdx);
		setHistory((h) => [...h, cloneVials(vials)]);
		setVials(next);
		setSelected(null);
		return true;
	}

	function handleClick(idx) {
		if (!running) return;
		if (selected === null) {
			// select if vial has liquid
			if (vials[idx].layers.length === 0) return;
			setSelected(idx);
		} else {
			// attempt pour
			if (selected === idx) {
				setSelected(null);
				return;
			}
			const did = pour(selected, idx);
			if (!did) {
				setMessage("Can't pour there");
				setTimeout(() => setMessage(""), 1000);
			} else {
				setMessage("");
			}
		}
	}

	function undo() {
		if (history.length === 0) return;
		const last = history[history.length - 1];
		setVials(last);
		setHistory((h) => h.slice(0, -1));
		setMessage("Undid move");
		setTimeout(() => setMessage(""), 800);
	}

	// --------------------------
	// Solver (BFS) - find a single canonical shortest path
	// --------------------------
	useEffect(() => {
		if (vials.length === 0) {
			setSolverInfo({
				computing: false,
				found: false,
				minMoves: null,
				firstMove: null,
				reason: "No board",
			});
			return;
		}

		let cancelled = false;
		setSolverInfo((s) => ({ ...s, computing: true, reason: "" }));

		// Run solver async-ish to keep UI responsive
		setTimeout(() => {
			if (cancelled) return;

			const maxDepth = 14; // increase at cost of performance
			const nodeLimit = 200000;
			const startStr = stateToString(vials);

			if (isGoal(vials)) {
				setSolverInfo({
					computing: false,
					found: true,
					minMoves: 0,
					firstMove: null,
					reason: "Already solved",
				});
				return;
			}

			// BFS
			const q = [];
			const depth = new Map(); // state -> distance
			const parent = new Map(); // state -> { parentState, move: [from,to] }
			q.push(startStr);
			depth.set(startStr, 0);
			parent.set(startStr, null);

			let nodesVisited = 0;
			let goalState = null;
			while (q.length > 0) {
				const cur = q.shift();
				nodesVisited++;
				if (nodesVisited > nodeLimit) break;
				const d = depth.get(cur);
				if (d >= maxDepth) continue;

				const curVials = stringToVials(cur);

				// deterministic neighbor order: iterate i then j
				for (let i = 0; i < curVials.length; i++) {
					for (let j = 0; j < curVials.length; j++) {
						if (!canPourState(curVials, i, j)) continue;
						const nxt = doPourState(curVials, i, j);
						const nxtStr = stateToString(nxt);
						if (!depth.has(nxtStr)) {
							depth.set(nxtStr, d + 1);
							parent.set(nxtStr, { parentState: cur, move: [i, j] });
							// If we found a goal, immediately stop: this is a shortest path
							if (isGoal(nxt)) {
								goalState = nxtStr;
								break;
							}
							q.push(nxtStr);
						}
					}
					if (goalState) break;
				}
				if (goalState) break;
			}

			if (nodesVisited > nodeLimit) {
				setSolverInfo({
					computing: false,
					found: false,
					minMoves: null,
					firstMove: null,
					reason: "Search aborted (node limit)",
				});
				return;
			}

			if (!goalState) {
				setSolverInfo({
					computing: false,
					found: false,
					minMoves: null,
					firstMove: null,
					reason: "No solution found within depth limit",
				});
				return;
			}

			// reconstruct path from start -> goal using parent map
			const movesReversed = [];
			let cur = goalState;
			while (cur !== startStr) {
				const entry = parent.get(cur);
				if (!entry) break; // defensive
				movesReversed.push(entry.move); // move that led from parent -> cur
				cur = entry.parentState;
			}
			const pathMoves = movesReversed.reverse(); // now pathMoves[0] is first move
			const minMoves = pathMoves.length;
			const firstMove = pathMoves.length > 0 ? { from: pathMoves[0][0], to: pathMoves[0][1] } : null;

			setSolverInfo({
				computing: false,
				found: true,
				minMoves,
				firstMove,
				reason: "Fastest path found",
			});
		}, 10);

		return () => {
			cancelled = true;
		};
	}, [vials]);

	// small helper to render a vial as colored stacked divs
	function Vial({ vial, idx }) {
		const isSelected = selected === idx;
		const hint = solverInfo.firstMove;
		const isHintFrom = hint && hint.from === idx;
		const isHintTo = hint && hint.to === idx;

		const ringClass = isSelected
			? "scale-105 ring-4 ring-indigo-500"
			: isHintFrom
			? "ring-4 ring-green-400"
			: isHintTo
			? "ring-4 ring-red-400"
			: "";

		return (
			<div
				onPointerDown={() => handleClick(idx)}
				className={`aspect-[1/3] h-48 bg-gray-800 rounded-xl border-2 border-gray-600 flex flex-col overflow-hidden cursor-pointer relative ${ringClass}`}
				title={`Vial ${idx + 1} — ${vial.layers.length}/4`}
			>
				{/* render top -> bottom so visual is upright */}
				{Array.from({ length: 4 }).map((_, i) => {
					const layerIndex = 3 - i;
					const color = vial.layers[layerIndex];
					return (
						<div
							key={i}
							className={`flex-1 border-t border-gray-900 ${color ? "" : "bg-white"}`}
							style={{ background: color || "transparent" }}
						/>
					);
				})}
				<div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-700 rounded-b-xl" />
			</div>
		);
	}

	// Start game on mount initially
	useEffect(() => {
		newGame();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-6">
			<h1 className="text-2xl md:text-4xl font-bold mb-4">Water Sort Puzzle</h1>

			<div className="w-full max-w-6xl bg-gray-900 shadow-lg rounded-xl p-4 md:p-6">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="text-sm md:text-base">Vials:</div>
						<div className="text-lg font-semibold">{numVials}</div>
						<button
							className="ml-3 px-3 py-1 bg-black rounded hover:bg-gray-700 border border-gray-700"
							onClick={() => newGame()}
						>
							New Random Game
						</button>
						<button
							className="ml-2 px-3 py-1 bg-black rounded hover:bg-gray-700 border border-gray-700"
							onClick={() => newGame(numVials)}
						>
							Restart Same Count
						</button>
					</div>

					<div className="flex items-center gap-4">
						<div className="text-sm md:text-base">Timer:</div>
						<div className="text-lg font-mono font-semibold">{Math.floor(timeLeft)}s</div>
						<div className="text-sm md:text-base">Score:</div>
						<div className="text-lg font-semibold">{score}</div>

						<button
							className="px-3 py-1 bg-red-500 text-white rounded"
							onClick={() => {
								setRunning(false);
								setTimeout(() => newGame(numVials), 150);
							}}
						>
							Restart
						</button>
					</div>
				</div>

				<div className="mt-6">
					<div className="grid grid-cols-3 gap-6 justify-items-center">
						{vials.map((v, i) => (
							<Vial key={i} vial={v} idx={i} />
						))}
					</div>

					{/* centered controls below vials */}
					<div className="mt-4 flex flex-col items-center gap-2">
						<div className="flex items-center gap-3">
							<button
								className={`px-3 py-1 rounded ${history.length ? "bg-indigo-500 text-white" : "bg-gray-700 text-gray-400"}`}
								onClick={undo}
								disabled={history.length === 0}
								title="Undo last move"
							>
								Undo
							</button>

							<div className="text-sm text-gray-300">
								Moves made: <span className="font-semibold">{history.length}</span>
							</div>

							<div className="text-sm text-gray-300 ml-4">
								Solver:{" "}
								{solverInfo.computing ? (
									<span>computing…</span>
								) : solverInfo.found ? (
									<span>
										{solverInfo.minMoves} move{solverInfo.minMoves === 1 ? "" : "s"} (fastest)
									</span>
								) : (
									<span className="text-gray-500">{solverInfo.reason}</span>
								)}
							</div>
						</div>

						{solverInfo.firstMove && (
							<div className="text-sm text-gray-200">
								Hint: Move from vial <span className="font-semibold">{solverInfo.firstMove.from + 1}</span>{" "}
								to vial <span className="font-semibold">{solverInfo.firstMove.to + 1}</span> to follow a fastest path.
							</div>
						)}
					</div>
				</div>

				<div className="mt-4 flex items-center justify-between">
					<div className="text-sm text-gray-400">
						Click a filled vial to select, then click another to pour. Top contiguous same-color layers pour.
					</div>
					<div className="text-sm text-gray-300">{message}</div>
				</div>
			</div>

			<footer className="mt-6 text-sm text-gray-500">Built for quick play — 3 minute timer. Score = 100 * vials + seconds left.</footer>
		</div>
	);
}
