/** Wait for off-screen book illustrations before opening browser Print / Save as PDF. */
export const printFullBook=async()=>{
    // Safari can open print preview before off-screen book images finish loading.
    // Wait briefly for every printable illustration, then always allow printing.
    const images=Array.from(document.querySelectorAll<HTMLImageElement>(".print-book img"));
    const unfinished=images.filter(image=>!image.complete);
    if(unfinished.length){
      await new Promise<void>(resolve=>{
        let pending=unfinished.length;
        let completed=false;
        const cleanups:Array<()=>void>=[];
        const finish=()=>{
          if(completed)return;
          completed=true;
          window.clearTimeout(timeout);
          cleanups.forEach(cleanup=>cleanup());
          resolve();
        };
        const timeout=window.setTimeout(finish,2500);
        for(const image of unfinished){
          let counted=false;
          const settled=()=>{
            if(counted)return;
            counted=true;
            image.removeEventListener("load",settled);
            image.removeEventListener("error",settled);
            pending--;
            if(pending===0)finish();
          };
          image.addEventListener("load",settled,{once:true});
          image.addEventListener("error",settled,{once:true});
          cleanups.push(()=>{image.removeEventListener("load",settled);image.removeEventListener("error",settled);});
          // Image may have loaded between filtering and installing listeners.
          if(image.complete)settled();
        }
      });
    }
    window.print();
  };
