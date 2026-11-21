/** Keep the continuation suffix visible within the local-library title limit. */
export const fitSequelTitle = (previousTitle:string,suffix:string,maxLength=260):string => {
  if(previousTitle.length+suffix.length<=maxLength)return previousTitle+suffix;
  const available=Math.max(0,maxLength-suffix.length-1);
  let prefix=previousTitle.slice(0,available).trimEnd();
  // Never leave half of a UTF-16 surrogate pair (e.g. an emoji) at the cut.
  if(/[\uD800-\uDBFF]$/.test(prefix))prefix=prefix.slice(0,-1);
  return prefix+"…"+suffix;
};
