"use client";

/**
 * Subtle floating cloud-like orbs background.
 * Uses CSS animations only — no JS animation loop.
 */
export function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
      <div
        className="absolute rounded-full blur-3xl opacity-[0.25] dark:opacity-[0.12] bg-black dark:bg-white"
        style={{
          width: "40vw",
          height: "40vw",
          maxWidth: 600,
          maxHeight: 600,
          top: "10%",
          left: "15%",
          animation: "floatOrb1 25s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full blur-3xl opacity-[0.20] dark:opacity-[0.09] bg-black dark:bg-white"
        style={{
          width: "35vw",
          height: "35vw",
          maxWidth: 500,
          maxHeight: 500,
          top: "50%",
          right: "10%",
          animation: "floatOrb2 30s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full blur-3xl opacity-[0.18] dark:opacity-[0.08] bg-black dark:bg-white"
        style={{
          width: "30vw",
          height: "30vw",
          maxWidth: 450,
          maxHeight: 450,
          bottom: "5%",
          left: "40%",
          animation: "floatOrb3 20s ease-in-out infinite",
        }}
      />
    </div>
  );
}
