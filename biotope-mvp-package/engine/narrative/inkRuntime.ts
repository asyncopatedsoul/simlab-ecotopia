import { Story } from 'inkjs';
import type {
  CreateInkRuntimeOptions,
  InkChoice,
  InkExternalFn,
  InkLine,
  InkRuntime,
} from './types';

type TagSubscription = {
  prefix: string;
  handler: (rest: string, fullTag: string) => void;
};

export function createInkRuntime(options: CreateInkRuntimeOptions): InkRuntime {
  const json =
    typeof options.storyJson === 'string' ? options.storyJson : JSON.stringify(options.storyJson);
  const story = new Story(json);

  for (const [name, fn] of Object.entries(options.external ?? {})) {
    bindExternalSafe(story, name, fn);
  }

  const lineListeners = new Set<(line: InkLine) => void>();
  const tagSubs: TagSubscription[] = [];

  function buildLine(): InkLine {
    const text = story.currentText ?? '';
    const tags = (story.currentTags ?? []).slice();
    return { text, tags };
  }

  function emit(line: InkLine) {
    for (const l of lineListeners) {
      try {
        l(line);
      } catch {
        /* listener errors must not break flow */
      }
    }
    for (const tag of line.tags) {
      for (const sub of tagSubs) {
        if (tag.startsWith(sub.prefix)) {
          const rest = tag.slice(sub.prefix.length).trimStart();
          try {
            sub.handler(rest, tag);
          } catch {
            /* listener errors must not break flow */
          }
        }
      }
    }
  }

  return {
    canContinue: () => story.canContinue,

    continue() {
      if (!story.canContinue) return null;
      story.Continue();
      const line: InkLine = buildLine();
      emit(line);
      return line;
    },

    continueMaximally() {
      const out: InkLine[] = [];
      while (story.canContinue) {
        story.Continue();
        const line = buildLine();
        emit(line);
        out.push(line);
      }
      return out;
    },

    choices(): InkChoice[] {
      return story.currentChoices.map((c) => ({ index: c.index, text: c.text }));
    },

    choose(index) {
      story.ChooseChoiceIndex(index);
    },

    isEnded: () => !story.canContinue && story.currentChoices.length === 0,

    onLine(listener) {
      lineListeners.add(listener);
      return () => lineListeners.delete(listener);
    },

    onTag(prefix, handler) {
      const sub: TagSubscription = { prefix, handler };
      tagSubs.push(sub);
      return () => {
        const i = tagSubs.indexOf(sub);
        if (i >= 0) tagSubs.splice(i, 1);
      };
    },

    bindExternal(name, fn) {
      bindExternalSafe(story, name, fn);
    },

    goTo(path) {
      story.ChoosePathString(path);
    },

    save() {
      return story.state.ToJson();
    },

    restore(state) {
      story.state.LoadJson(state);
    },
  };
}

function bindExternalSafe(story: Story, name: string, fn: InkExternalFn) {
  // BindExternalFunction throws if a function with that name was already
  // bound and the story has been advanced past that point. For the runtime
  // we always bind before the first Continue and never re-bind, so this is
  // a straight pass-through with a typed wrapper.
  story.BindExternalFunction(name, (...args: unknown[]) => fn(...args));
}
