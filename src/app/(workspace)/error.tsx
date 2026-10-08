"use client";
import { AlertTriangle } from "lucide-react";
export default function ErrorView({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel error-panel">
      <AlertTriangle size={28} />
      <h2>We couldn’t load this view.</h2>
      <p>
        {error.message.startsWith("Unable")
          ? error.message
          : "Check your connection and try again. Your saved records are safe."}
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
