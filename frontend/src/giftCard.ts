type GiftCardOptions = {
  plan: "plus" | "family";
  language: "ru" | "uz" | "en";
  recipient: string;
  greeting: string;
};

export async function createGiftCard(options: GiftCardOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const family = options.plan === "family";
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, family ? "#164e63" : "#4c1d95");
  gradient.addColorStop(1, family ? "#0f766e" : "#be185d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = "#f8dfa5";
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, 984, 1254);
  for (let i = 0; i < 32; i++) {
    const x = 85 + ((i * 173) % 910);
    const y = 90 + ((i * 257) % 1170);
    ctx.fillStyle = "rgba(255,235,180,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, 2 + i % 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff4d6";
  ctx.font = "bold 48px sans-serif";
  ctx.fillText("Ertakcha", 540, 180);
  ctx.fillStyle = "#f8dfa5";
  ctx.fillRect(410, 285, 260, 180);
  ctx.fillStyle = family ? "#0e7490" : "#9333ea";
  ctx.fillRect(522, 285, 36, 180);
  ctx.fillRect(410, 330, 260, 30);
  ctx.strokeStyle = "#f8dfa5";
  ctx.lineWidth = 16;
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(540, 285);
    ctx.bezierCurveTo(540 + sign * 150, 155, 540 + sign * 155, 280, 540, 285);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px sans-serif";
  ctx.fillText(family ? "Family" : "Plus", 540, 580);
  const labels = {
    ru: ["Месяц волшебных сказок", "Подарок для тебя"],
    uz: ["Bir oy sehrli ertaklar", "Sen uçun sovğa"],
    en: ["A month of magical stories", "A gift for you"]
  }[options.language];
  ctx.font = "38px sans-serif";
  ctx.fillText(labels[0], 540, 655, 880);
  ctx.font = "bold 52px sans-serif";
  ctx.fillText(options.recipient.trim().slice(0, 60) || labels[1], 540, 800, 880);
  ctx.font = "36px sans-serif";
  const words = options.greeting.trim().slice(0, 240).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > 850) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 7).forEach((value, index) => ctx.fillText(value, 540, 900 + index * 48, 850));
  ctx.font = "28px sans-serif";
  ctx.fillText("Ertakcha · WonderTale", 540, 1240);
  // Greeting artwork deliberately excludes redemption codes and payment claims.
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG unavailable")), "image/png"));
}
