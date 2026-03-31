"use client";

import { CSSProperties } from "react";

/**
 * Subtle floating cloud-like background.
 * Each "cloud" is a cluster of overlapping blurred blobs rendered into an
 * SVG with an feTurbulence noise layer to eliminate gradient banding.
 * Uses CSS animations only — no JS animation loop.
 */

interface BlobDef {
  cx: string;
  cy: string;
  rx: string;
  ry: string;
  blur: number;
  opacity: number;
}

function CloudCluster({
  style,
  blobs,
  darkFactor = 0.5,
  id,
}: {
  style: CSSProperties;
  blobs: BlobDef[];
  darkFactor?: number;
  id: string;
}) {
  return (
    <svg
      className="absolute cloud-cluster"
      style={{ ...style, overflow: "visible" }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        {blobs.map((b, i) => (
          <filter key={i} id={`${id}-blur-${i}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation={b.blur} />
          </filter>
        ))}
        {/* Noise filter to dither away banding */}
        <filter id={`${id}-noise`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves={4}
            seed={Math.round(Math.random() * 1000)}
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="saturate"
            values="0"
            result="monoNoise"
          />
          <feBlend in="SourceGraphic" in2="monoNoise" mode="soft-light" />
        </filter>
      </defs>
      <g filter={`url(#${id}-noise)`}>
        {blobs.map((b, i) => (
          <ellipse
            key={i}
            cx={b.cx}
            cy={b.cy}
            rx={b.rx}
            ry={b.ry}
            filter={`url(#${id}-blur-${i})`}
            className="fill-black dark:fill-white"
            style={{
              ["--blob-opacity" as string]: b.opacity,
              ["--blob-opacity-dark" as string]: b.opacity * darkFactor,
            }}
          />
        ))}
      </g>
    </svg>
  );
}

export function FloatingOrbs() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden z-0"
      aria-hidden="true"
    >
      <style>{`
        .cloud-cluster ellipse {
          opacity: var(--blob-opacity);
        }
        :is(.dark, [data-theme="dark"]) .cloud-cluster ellipse {
          opacity: var(--blob-opacity-dark);
        }
      `}</style>

      {/* Cloud 1 — upper left */}
      <CloudCluster
        id="cloud1"
        style={{
          top: "5%",
          left: "10%",
          width: "45vw",
          height: "40vw",
          maxWidth: 680,
          maxHeight: 600,
          animation: "floatOrb1 25s ease-in-out infinite",
        }}
        blobs={[
          { cx: "40", cy: "45", rx: "35", ry: "30", blur: 12, opacity: 0.18 },
          { cx: "55", cy: "35", rx: "28", ry: "24", blur: 16, opacity: 0.14 },
          { cx: "35", cy: "60", rx: "25", ry: "22", blur: 14, opacity: 0.12 },
          { cx: "60", cy: "55", rx: "18", ry: "16", blur: 10, opacity: 0.10 },
        ]}
      />

      {/* Cloud 2 — right side */}
      <CloudCluster
        id="cloud2"
        style={{
          top: "40%",
          right: "5%",
          width: "40vw",
          height: "38vw",
          maxWidth: 600,
          maxHeight: 560,
          animation: "floatOrb2 30s ease-in-out infinite",
        }}
        blobs={[
          { cx: "45", cy: "50", rx: "32", ry: "28", blur: 13, opacity: 0.15 },
          { cx: "60", cy: "40", rx: "26", ry: "22", blur: 15, opacity: 0.12 },
          { cx: "40", cy: "60", rx: "22", ry: "20", blur: 11, opacity: 0.10 },
          { cx: "55", cy: "50", rx: "16", ry: "14", blur: 9, opacity: 0.08 },
        ]}
      />

      {/* Cloud 3 — bottom center */}
      <CloudCluster
        id="cloud3"
        style={{
          bottom: "0%",
          left: "30%",
          width: "38vw",
          height: "35vw",
          maxWidth: 560,
          maxHeight: 520,
          animation: "floatOrb3 20s ease-in-out infinite",
        }}
        blobs={[
          { cx: "45", cy: "50", rx: "30", ry: "26", blur: 12, opacity: 0.14 },
          { cx: "55", cy: "38", rx: "24", ry: "20", blur: 14, opacity: 0.11 },
          { cx: "38", cy: "58", rx: "22", ry: "18", blur: 11, opacity: 0.09 },
        ]}
      />
    </div>
  );
}
