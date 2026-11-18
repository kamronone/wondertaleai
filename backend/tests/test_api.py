import os
import tempfile
from pathlib import Path

# Import after DATA_DIR is configured so tests never touch development data.
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="wondertale-test-")
os.environ["GENERATION_MODE"] = "demo"

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["mode"] == "demo"

def test_parental_consent_required():
    response = client.post("/api/books", data={"name":"Амир","age":"5","prompt":"Путешествие в космос с другом"})
    assert response.status_code == 400

def test_create_read_pdf_delete():
    response = client.post("/api/books", data={"name":"Амир","age":"5","prompt":"Помочь доброй звезде вернуться домой","theme":"Космос","style":"Акварель","parental_consent":"true"})
    assert response.status_code == 201, response.text
    book = response.json()
    assert len(book["pages"]) == 8
    book_id = book["id"]
    assert client.get(f"/api/books/{book_id}").status_code == 200
    assert client.get(f"/api/books/{book_id}/images/1").headers["content-type"] == "image/png"
    pdf = client.get(f"/api/books/{book_id}/pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert client.delete(f"/api/books/{book_id}").status_code == 204
    assert client.get(f"/api/books/{book_id}").status_code == 404
