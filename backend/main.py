"""WonderTale AI MVP: single-user LOCAL demo. Do not expose publicly without auth."""
import base64
import io
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from PIL import Image, ImageDraw, UnidentifiedImageError
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

load_dotenv()
DATA = Path(os.getenv("DATA_DIR", str(Path(__file__).resolve().parent / "data"))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
DB = DATA / "wondertale.sqlite3"
MODE = os.getenv("GENERATION_MODE", "demo").lower()
app = FastAPI(title="WonderTale AI", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","), allow_methods=["GET", "POST", "DELETE"], allow_headers=["*"])
FONT = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
if FONT.exists():
    pdfmetrics.registerFont(TTFont("DejaVu", str(FONT)))
PDF_FONT = "DejaVu" if FONT.exists() else "Helvetica"

def db():
    connection = sqlite3.connect(DB)
    connection.row_factory = sqlite3.Row
    return connection

with db() as c:
    c.execute("CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, created_at TEXT, name TEXT, age INTEGER, theme TEXT, prompt TEXT, style TEXT, title TEXT, pages TEXT, mode TEXT)")
    c.commit()

class Page(BaseModel):
    number: int
    text: str
    image_url: str

class Book(BaseModel):
    id: str
    created_at: str
    name: str
    age: int
    theme: str
    prompt: str
    style: str
    title: str
    pages: list[Page]
    mode: str

def decode(row):
    obj = dict(row)
    obj["pages"] = json.loads(obj["pages"])
    return Book(**obj)

def validate_photo(raw):
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(413, "Фото не должно превышать 8 МБ")
    try:
        im = Image.open(io.BytesIO(raw))
        im.verify()
        im = Image.open(io.BytesIO(raw))
        if im.format not in ("JPEG", "PNG", "WEBP") or im.width * im.height > 20_000_000:
            raise ValueError("unsupported")
        im = im.convert("RGB")
        im.thumbnail((1024, 1024))
        output = io.BytesIO()
        im.save(output, format="JPEG")
        return output.getvalue()
    except (UnidentifiedImageError, ValueError, OSError):
        raise HTTPException(400, "Загрузите корректное фото JPG, PNG или WebP")

def story_demo(name, prompt, theme):
    title = f"{name} и секрет волшебной звезды"
    return title, [
        f"Однажды {name} заметил яркую звёздочку, которая осторожно постучала в окно.",
        f"Звёздочка рассказала: в мире {theme.lower()} потерялся волшебный ключ от радуги.",
        f"{name} отправился в путешествие по дорожке из светлячков и добрых пожеланий.",
        "Навстречу вышел весёлый лисёнок. Он предложил найти ключ вместе.",
        f"Герой вспомнил свою мечту: {prompt.rstrip('.!?')}. Это придало смелости.",
        "Друзья прошли через сад поющих цветов и нашли ключ у старого дуба.",
        f"Ключ открыл радугу! Все поздравили {name}, ведь помощь друзьям важнее волшебства.",
        f"Вечером {name} вернулся домой, улыбнулся и заснул с тёплой мыслью о дружбе.",
    ]

def story_ai(name, age, prompt, theme, style):
    from openai import OpenAI
    client = OpenAI()
    result = client.responses.create(
        model=os.getenv("TEXT_MODEL", "gpt-5.5"),
        instructions='Write a gentle, safe Russian-language children story with 8 pages. Return only a JSON object with "title" and "pages" (array of exactly 8 strings). Avoid violence, threats, advertisements and personal information beyond first name.',
        input=f"Имя героя: {name}; возраст: {age}; тема: {theme}; стиль: {style}; идея: {prompt}"
    )
    output = result.output_text.strip()
    if output.startswith("```"):
        output = output.split("\n", 1)[1].rsplit("```", 1)[0]
    parsed = json.loads(output)
    pages = parsed.get("pages")
    if not isinstance(pages, list) or len(pages) != 8 or any(not isinstance(x, str) or not (15 <= len(x) <= 900) for x in pages):
        raise ValueError("Invalid AI story format")
    return str(parsed["title"])[:120], pages

def demo_image(path, index):
    # Decorative image, NOT a likeness of the uploaded child.
    palette = [("#2e245b", "#9270cf"), ("#194c69", "#79c1c7"), ("#703a69", "#ed9cae"), ("#3b4778", "#a0b1f4")]
    a, b = palette[index % len(palette)]
    im = Image.new("RGB", (768, 1024), a)
    d = ImageDraw.Draw(im)
    for y in range(1024):
        p = y / 1024
        u = tuple(int(a[i:i+2], 16) for i in (1,3,5))
        v = tuple(int(b[i:i+2], 16) for i in (1,3,5))
        d.line((0,y,768,y), fill=tuple(int(u[k]*(1-p)+v[k]*p) for k in range(3)))
    for j in range(48):
        x = (j*197+index*53)%768
        y = (j*123+index*43)%800
        r = 2+j%5
        d.ellipse((x-r,y-r,x+r,y+r),fill="#fff5ce")
    d.ellipse((139,260,625,780),fill="#fff0c5")
    d.polygon([(384,345),(420,447),(535,448),(444,515),(482,620),(384,556),(286,620),(324,515),(233,448),(348,447)], fill="#ffd068")
    d.ellipse((315,516,332,533),fill="#493966")
    d.ellipse((440,516,457,533),fill="#493966")
    d.arc((335,510,435,581),0,180,fill="#b25c79",width=6)
    im.save(path)

def ai_image(path, index, scene, name, style, reference):
    from openai import OpenAI, to_file
    client = OpenAI()
    prompt = f"Portrait illustrated children's storybook. Page {index+1} of 8. Hero: {name}. Scene: {scene}. Style: {style}. Keep character consistent. Child-friendly, no words. If a child photo is provided, use it to guide a stylized, non-photorealistic drawing."
    options = dict(model=os.getenv("IMAGE_MODEL", "gpt-image-2"), prompt=prompt, size="1024x1536")
    if reference:
        result = client.images.edit(image=to_file(reference, filename="reference.jpg"), **options)
    else:
        result = client.images.generate(**options)
    path.write_bytes(base64.b64decode(result.data[0].b64_json))

@app.get("/api/health")
def health():
    return {"ok": True, "mode": MODE}

@app.get("/api/books", response_model=list[Book])
def list_books():
    with db() as c:
        rows = c.execute("SELECT * FROM books ORDER BY created_at DESC LIMIT 100").fetchall()
    return [decode(r) for r in rows]

@app.get("/api/books/{book_id}", response_model=Book)
def get_book(book_id: str):
    with db() as c:
        row = c.execute("SELECT * FROM books WHERE id=?", (book_id,)).fetchone()
    if not row: raise HTTPException(404, "Книга не найдена")
    return decode(row)

@app.post("/api/books", response_model=Book, status_code=201)
def create_book(name: str = Form(...), age: int = Form(...), prompt: str = Form(...), theme: str = Form("Волшебство"), style: str = Form("Акварель"), parental_consent: bool = Form(False), photo: UploadFile | None = File(None)):
    if not parental_consent: raise HTTPException(400, "Требуется согласие родителя или законного представителя")
    name = name.strip()
    if not (1 <= len(name) <= 60 and 2 <= age <= 14 and 8 <= len(prompt) <= 1200 and len(theme) <= 50 and len(style) <= 50):
        raise HTTPException(422, "Проверьте имя, возраст и описание")
    if MODE == "ai" and not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503, "OPENAI_API_KEY не настроен")
    reference = validate_photo(photo.file.read()) if photo else None
    if photo: photo.file.close()
    book_id = str(uuid.uuid4())
    folder = DATA / book_id
    folder.mkdir()
    try:
        title, scenes = story_ai(name, age, prompt, theme, style) if MODE == "ai" else story_demo(name, prompt, theme)
        pages = []
        for index, text in enumerate(scenes):
            dest = folder / f"{index+1}.png"
            if MODE == "ai": ai_image(dest, index, text, name, style, reference)
            else: demo_image(dest, index)
            pages.append({"number": index+1, "text": text, "image_url": f"/api/books/{book_id}/images/{index+1}"})
        book = Book(id=book_id, created_at=datetime.now(timezone.utc).isoformat(), name=name, age=age, prompt=prompt, theme=theme, style=style, title=title, pages=[Page(**p) for p in pages], mode=MODE)
        with db() as c:
            c.execute("INSERT INTO books VALUES (?,?,?,?,?,?,?,?,?,?)", (book.id, book.created_at, name, age, theme, prompt, style, title, json.dumps(pages, ensure_ascii=False), MODE))
            c.commit()
        return book
    except Exception:
        import shutil
        shutil.rmtree(folder, ignore_errors=True)
        raise

@app.get("/api/books/{book_id}/images/{number}")
def book_image(book_id: str, number: int):
    get_book(book_id)
    if not 1 <= number <= 8: raise HTTPException(404)
    path = DATA / book_id / f"{number}.png"
    if not path.exists(): raise HTTPException(404)
    return FileResponse(path, media_type="image/png", headers={"Cache-Control":"private, max-age=60"})

@app.get("/api/books/{book_id}/pdf")
def book_pdf(book_id: str):
    item = get_book(book_id)
    target = DATA / book_id / "book.pdf"
    canvas = Canvas(str(target), pagesize=(595,842))
    for page in item.pages:
        canvas.setFillColor(colors.HexColor("#fff9f1"))
        canvas.rect(0,0,595,842,stroke=0,fill=1)
        canvas.setFillColor(colors.HexColor("#44365a"))
        canvas.setFont(PDF_FONT, 17)
        canvas.drawCentredString(297,800,item.title[:45])
        image = Image.open(DATA / book_id / f"{page.number}.png")
        canvas.drawImage(ImageReader(image),120,277,width=355,height=474)
        canvas.setFont(PDF_FONT,12)
        lines=[]
        words=page.text.split()
        line=""
        for word in words:
            trial=(line+" "+word).strip()
            if pdfmetrics.stringWidth(trial,PDF_FONT,12)>475 and line:
                lines.append(line);line=word
            else: line=trial
        if line: lines.append(line)
        for i,s in enumerate(lines[:11]): canvas.drawCentredString(297,245-i*19,s)
        canvas.showPage()
    canvas.save()
    return FileResponse(target, filename="wondertale-book.pdf", media_type="application/pdf", headers={"Cache-Control":"private, no-store"})

@app.delete("/api/books/{book_id}", status_code=204)
def delete_book(book_id: str):
    get_book(book_id)
    with db() as c:
        c.execute("DELETE FROM books WHERE id=?", (book_id,))
        c.commit()
    import shutil
    shutil.rmtree(DATA/book_id, ignore_errors=True)
    return Response(status_code=204)
