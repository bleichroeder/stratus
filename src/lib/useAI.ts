"use client";

import { useState, useCallback } from "react";
import type { AIAction } from "@/lib/ai";

interface AIParams {
  action: AIAction;
  templateId?: string;
  prompt?: string;
  context?: string;
  noteTitle?: string;
}

export type AIResult = { ok: true; text: string } | { ok: false; error: string };

export function useAI() {
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (params: AIParams): Promise<AIResult> => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || "AI generation failed" };
      }

      return { ok: true, text: data.text };
    } catch {
      return { ok: false, error: "Failed to reach AI service" };
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading };
}
