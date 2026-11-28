/** Match the local-book page validator, including the space before a new ending. */
export const canAppendStoryEnding = (
  originalText: string,
  addition: string,
  maxLength = 2200
): boolean => originalText.length + 1 + addition.length <= maxLength;
