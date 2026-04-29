import { useEffect, useState } from 'react';
import { createInkRuntime, type InkLine } from '@engine/narrative';
import type { Phase } from '@engine/runtime';
import type { ScenarioBundle } from '@engine/scenario';

export type MentorOverlayProps = {
  bundle: ScenarioBundle;
  phase: Phase | null;
};

/**
 * Parent-facing coaching overlay for mentor_apprentice mode. Reads the
 * coaching_prompts Ink node for the current phase (if the manifest declares
 * one) and renders the lines in a side panel. The child's view is unaffected.
 *
 * Each phase gets its own InkRuntime instance for the parent track so the
 * parent's narrative state is isolated from the child's. Cheap because Ink
 * runtime is JSON-string in / serializable state out.
 */
export function MentorOverlay({ bundle, phase }: MentorOverlayProps) {
  const [lines, setLines] = useState<ReadonlyArray<InkLine>>([]);

  useEffect(() => {
    setLines([]);
    if (!phase) return;
    const node = coachingNodeFor(bundle, phase);
    if (!node) return;
    try {
      const ink = createInkRuntime({ storyJson: bundle.storyJson });
      ink.goTo(node);
      setLines(ink.continueMaximally());
    } catch {
      /* missing coaching node is non-fatal — overlay just stays empty */
    }
  }, [bundle, phase]);

  if (lines.length === 0) return null;

  return (
    <aside
      className="scenario-mentor-overlay"
      aria-label="Parent coaching"
      data-phase={phase ?? 'idle'}
    >
      <h3 className="scenario-mentor-overlay__title">For the parent</h3>
      <div className="scenario-mentor-overlay__lines">
        {lines.map((l, i) => (
          <p key={i}>{l.text.trim()}</p>
        ))}
      </div>
    </aside>
  );
}

function coachingNodeFor(bundle: ScenarioBundle, phase: Phase): string | null {
  const ma = bundle.manifest.mentor_apprentice;
  if (!ma) return null;
  const prompts = ma.parent_seat.coaching_prompts as Record<string, string>;
  return prompts[phase] ?? null;
}
