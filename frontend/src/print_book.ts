/** Preload hidden printable artwork before opening Safari Print / Save as PDF. */
export const printFullBook = async (): Promise<void> => {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>(".print-book img"));
  // The print-only article is display:none until @media print. Safari can
  // defer these network requests forever, so load each distinct URL into an
  // independent image before opening the native print dialog.
  const sources = [...new Set(images.map(image => image.currentSrc || image.src).filter(Boolean))];
  if (sources.length) {
    await new Promise<void>(resolve => {
      let remaining = sources.length;
      let finished = false;
      const pending: HTMLImageElement[] = [];
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        for (const image of pending) {
          image.onload = null;
          image.onerror = null;
        }
        resolve();
      };
      const settled = () => {
        remaining--;
        if (remaining === 0) finish();
      };
      // Always open print preview, even on a disconnected iPhone.
      const timeout = window.setTimeout(finish, 2500);
      for (const src of sources) {
        const preload = new Image();
        pending.push(preload);
        let counted = false;
        const once = () => {
          if (counted) return;
          counted = true;
          preload.onload = null;
          preload.onerror = null;
          settled();
        };
        preload.onload = once;
        preload.onerror = once;
        preload.src = src;
        // Covers images already present in the browser's memory cache.
        if (preload.complete) once();
      }
    });
  }
  window.print();
};
