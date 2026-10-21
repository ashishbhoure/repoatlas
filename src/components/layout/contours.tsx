/** Decorative topographic contour lines for the home hero. Purely visual. */
export function Contours({ className }: { className?: string }) {
  const rings = [
    "M310 40c70 4 130 52 140 118s-40 132-112 146-150-14-178-78 4-142 64-170c26-12 56-18 86-16Z",
    "M312 70c52 3 96 40 104 90s-30 100-84 110-112-10-134-58 4-106 48-128c20-10 42-15 66-14Z",
    "M314 100c36 2 66 28 72 62s-20 70-58 77-78-8-93-41 2-74 33-89c14-7 29-10 46-9Z",
    "M316 128c22 1 40 17 44 38s-12 43-36 47-48-5-57-25 1-45 20-54c9-5 18-6 29-6Z",
    "M318 152c10 1 18 8 20 17s-6 19-16 21-21-2-25-11 0-20 9-24c4-2 8-3 12-3Z",
    "M120 250c50-6 96 18 108 58s-14 80-64 92-108-6-128-46 6-86 50-100c11-3 22-4 34-4Z",
    "M126 280c34-4 64 12 72 38s-10 52-42 60-70-4-82-30 4-56 32-64c7-2 13-3 20-4Z",
    "M560 210c40 8 70 44 66 84s-44 70-90 64-78-42-72-84 40-70 82-66c5 0 10 1 14 2Z",
    "M556 240c26 5 44 28 42 54s-28 46-58 42-50-28-46-54 26-46 54-44c3 0 5 1 8 2Z",
  ];
  return (
    <svg viewBox="0 0 680 420" className={className} aria-hidden="true" fill="none" preserveAspectRatio="xMidYMid slice">
      {rings.map((d, i) => (
        <path key={i} d={d} stroke="currentColor" strokeWidth={1.1} strokeOpacity={0.18 + (i % 5) * 0.06} />
      ))}
      <circle cx="318" cy="170" r="2.5" fill="currentColor" fillOpacity="0.6" />
    </svg>
  );
}
