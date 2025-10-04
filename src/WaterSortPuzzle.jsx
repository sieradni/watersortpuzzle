import React, { useEffect, useMemo, useState, useRef, use } from "react";

// Water Sort Puzzle - single-file React component
// Tailwind CSS assumed available in the host project
// Default export a React component that renders the full game

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

export default function WaterSortPuzzle() {
	const [numVials, setNumVials] = useState(7); // default, can be randomized
	const [vials, setVials] = useState([]);
	const [selected, setSelected] = useState(null); // index of selected vial
	const [history, setHistory] = useState([]);
	const [timeLeft, setTimeLeft] = useState(180);
	const timerRef = useRef(null);
	const [running, setRunning] = useState(false);
	const [message, setMessage] = useState("");

	// initialize a new game
	function newGame(n = null) {
		const nV = n ?? randomInt(5, 9);
		setNumVials(nV);

		const colorSet = fisherYatesShuffle(COLORS).slice(0, nV - 2);
		const useColors = fisherYatesShuffle(
			colorSet.flatMap(color => Array(4).fill(color))
		);
		// useColors.forEach(color => console.log(`%c${color}`, `color: ${color}`));

		// Build vials: each vial has capacity 4 layers. Fill each vial with a random amount 1..4
		const built = [];
		const extra = ((nV-2) * 4 )% 3
		for (let i = 0; i < nV; i++) {
			const layers = [];
			if (i < extra && 4*(nV-2) > 3 * nV) {
				layers.push(useColors.pop());
			}
			const colorsLeft = useColors.length;
			for (let j = 0; j < Math.min(3, colorsLeft); j++) {
				layers.push(useColors.pop());
			}
			built.push({ layers });
		}
		// There may be empty space; some vials could be empty if fill==0 but spec said 1..4 so none empty initially

		setVials(built);
		setSelected(null);
		setHistory([]);
		setTimeLeft(180);
		setRunning(true);
		setMessage("");
	}

	// compute score
	const score = useMemo(() => {
		// Score = 100 * vials + seconds left
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

	// Check win: all vials either empty or full of one color (all layers same) and either full (4) or empty
	useEffect(() => {
		if (vials.length === 0) return;
		const allGood = vials.every((v) => {
			if (v.layers.length === 0) return true;
			if (v.layers.length !== 4) return false;
			const first = v.layers[0];
			return v.layers.every((l) => l === first);
		});
		if (allGood) {
			setRunning(false);
			setMessage("You solved it!");
		}
	}, [vials]);

	// helper: canPour(fromIdx, toIdx)
	function canPour(fromIdx, toIdx) {
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

	// perform pour logic: move contiguous same-colored top layers from src to dst until can't
	function pour(fromIdx, toIdx) {
		if (!canPour(fromIdx, toIdx)) return false;
		const prev = cloneVials(vials);
		const src = prev[fromIdx];
		const dst = prev[toIdx];
		const color = src.layers[src.layers.length - 1];

		// count how many contiguous top layers in src are color
		let moveCount = 0;
		for (let i = src.layers.length - 1; i >= 0; i--) {
			if (src.layers[i] === color) moveCount++;
			else break;
		}

		// how much space in dst
		const space = 4 - dst.layers.length;
		const actualMove = Math.min(moveCount, space);

		// move
		for (let k = 0; k < actualMove; k++) {
			dst.layers.push(src.layers.pop());
		}

		// push to history for undo
		setHistory((h) => [...h, cloneVials(vials)]);
		setVials(prev);
		setSelected(null);
		return true;
	}

	function handleClick(idx) {
		if (!running) return;
		if (selected === null) {
			// select if vial has liquid
			if (vials[idx].layers.length === 0) return; // cant select empty
			setSelected(idx);
		} else {
			// attempt pour
			if (selected === idx) {
				setSelected(null);
				return;
			}
			const did = pour(selected, idx);
			if (!did) {
				// invalid move: if target matches but no space etc, do nothing
				setMessage("Can't pour there");
				// keep selection so user can try another target
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

	// small helper to render a vial as colored stacked divs
	function Vial({ vial, idx }) {
		const isSelected = selected === idx;
		return (
			<div
				onClick={() => handleClick(idx)}
				className={`aspect-[1/3] h-48 bg-gray-100 rounded-xl border-2 border-gray-300 flex flex-col overflow-hidden cursor-pointer relative transition-transform ${
					isSelected ? "scale-105 ring-4 ring-indigo-200" : ""
				}`}
				title={`Vial ${idx + 1} — ${vial.layers.length}/4`}
			>
				{/* layers: render from top (empty or liquid) to bottom */}
				{Array.from({ length: 4 }).map((_, i) => {
					const layerIndex = 3 - i; // index from top down
					const color = vial.layers[layerIndex];
					return (
						<div
							key={i}
							className={`flex-1 border-t border-gray-200 ${
								color ? "" : "bg-white"
							}`}
							style={{
								background: color || "transparent",
								transition: "background 300ms",
							}}
						/>
					);
				})}
				{/* base */}
				<div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-400 rounded-b-xl" />
			</div>
		);
	}


	// Start game on mount initially
	useEffect(() => {
		newGame();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex flex-col items-center">
			<h1 className="text-2xl md:text-4xl font-bold mb-4">Water Sort Puzzle</h1>

			<div className="w-full max-w-6xl bg-white shadow-lg rounded-xl p-4 md:p-6">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="text-sm md:text-base">Vials:</div>
						<div className="text-lg font-semibold">{numVials}</div>
						<button
							className="ml-3 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
							onClick={() => newGame()}
						>
							New Random Game
						</button>
						<button
							className="ml-2 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
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
							className={`px-3 py-1 rounded ${history.length ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-600"}`}
							onClick={undo}
							disabled={history.length === 0}
							title="Undo last move"
						>
							Undo
						</button>

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
				</div>

				<div className="mt-4 flex items-center justify-between">
					<div className="text-sm text-gray-600">Click a filled vial to select, then click another to pour. Top contiguous same-color layers pour until source/top color changes or destination fills.</div>
					<div className="text-sm text-gray-700">{message}</div>
				</div>
			</div>

			<footer className="mt-6 text-sm text-gray-500">Built for quick play — 3 minute timer. Score = 100 * vials + seconds left.</footer>
		</div>
	);
}
