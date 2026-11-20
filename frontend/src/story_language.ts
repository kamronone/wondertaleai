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
