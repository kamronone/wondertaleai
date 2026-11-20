/** Keep the continuation suffix visible within the local-library title limit. */
export const fitSequelTitle = (previousTitle:string,suffix:string,maxLength=260):string => {
  if(previousTitle.length+suffix.length<=maxLength)return previousTitle+suffix;
  const available=Math.max(0,maxLength-suffix.length-1);
  return previousTitle.slice(0,available).trimEnd()+"…"+suffix;
};
