import type { Lang } from "./i18n";
import { storyPresets } from "./story_interactions";

/**
 * Translate an untouched built-in prompt when changing story language.
 * Never overwrite ideas that a parent has written or edited themselves.
 */
export const translateSelectedStoryPrompt = (
  prompt: string,
  from: Lang,
  to: Lang,
  classicPrompts?: Record<Lang, string>
): string => {
  if (from === to) return prompt;
  if (classicPrompts) {
    return prompt === classicPrompts[from] ? classicPrompts[to] : prompt;
  }
  const selectedPreset = storyPresets[from].find(preset => preset.idea === prompt);
  if (!selectedPreset) return prompt;
  return storyPresets[to].find(preset => preset.id === selectedPreset.id)?.idea ?? prompt;
};

/**
 * Leave a classic template without discarding edits made by the parent.
 * An untouched stock prompt is cleared to start an original story.
 */
export const leaveClassicStoryPrompt = (
  prompt: string,
  language: Lang,
  classicPrompts?: Record<Lang, string>
): string => {
  if (!classicPrompts) return prompt;
  return prompt === classicPrompts[language] ? "" : prompt;
};


/** Editing a classic's stock prompt opts out of its fixed demo narrative. */
export const shouldDetachClassicOnEdit = (
  nextPrompt: string,
  language: Lang,
  classicPrompts?: Record<Lang, string>
): boolean => Boolean(classicPrompts && nextPrompt !== classicPrompts[language]);
