import { Suspense } from "react";
import EvaluateView from "./evaluate-view";

export default function EvaluatePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 max-w-lg text-center text-sm text-[var(--muted-foreground)]">
          読み込み中...
        </div>
      }
    >
      <EvaluateView />
    </Suspense>
  );
}
