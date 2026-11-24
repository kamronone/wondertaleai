"""Tests for future private portrait preprocessing. Never upload real people."""
from io import BytesIO

import pytest
from PIL import Image, PngImagePlugin

from private_photo_reference import (
    MAX_UPLOAD_BYTES,
    normalize_private_reference_photo,
)


def encode_png(size=(128, 96), alpha=False):
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("Comment", "SECRET_CHILD_PHOTO_METADATA")
    image = Image.new("RGBA" if alpha else "RGB", size, (0, 140, 220, 128) if alpha else (12, 130, 210))
    out = BytesIO()
    image.save(out, format="PNG", pnginfo=metadata)
    return out.getvalue()


def test_png_strips_sensitive_metadata_and_never_returns_input_bytes():
    original = encode_png(alpha=True)
    cleaned = normalize_private_reference_photo(original)
    assert cleaned.startswith(b"\\xff\\xd8\\xff")
    assert cleaned != original
    assert b"SECRET_CHILD_PHOTO_METADATA" not in cleaned
    with Image.open(BytesIO(cleaned)) as output:
        assert output.format == "JPEG"
        assert output.mode == "RGB"
        assert output.size == (128, 96)
        assert output.getexif() == {}


def test_photo_exif_orientation_applied_without_copying_exif():
    image = Image.new("RGB", (96, 144), (20, 110, 200))
    exif = Image.Exif()
    exif[274] = 6
    exif[270] = "SECRET_CHILD_PHOTO_METADATA"
    stream = BytesIO()
    image.save(stream, format="JPEG", exif=exif)
    cleaned = normalize_private_reference_photo(stream.getvalue())
    with Image.open(BytesIO(cleaned)) as output:
        assert output.size == (144, 96)
        assert output.getexif() == {}
        assert b"SECRET_CHILD_PHOTO_METADATA" not in cleaned


def test_large_reference_resized_preserving_aspect_ratio():
    source = encode_png((2048, 1536))
    cleaned = normalize_private_reference_photo(source)
    with Image.open(BytesIO(cleaned)) as output:
        assert output.size == (1024, 768)


@pytest.mark.parametrize("input_bytes", [
    b"",
    b"not an image",
    b"x" * (MAX_UPLOAD_BYTES + 1),
    bytearray(b"1234"),
])
def test_invalid_source_rejected(input_bytes):
    with pytest.raises(ValueError):
        normalize_private_reference_photo(input_bytes)


@pytest.mark.parametrize("dimensions", [
    (63, 128),
    (128, 63),
    (4097, 64),
    (3500, 3500),
])
def test_invalid_dimensions_rejected(dimensions):
    source = encode_png(dimensions)
    with pytest.raises(ValueError):
        normalize_private_reference_photo(source)


def test_animated_gif_not_accepted_as_portrait():
    first = Image.new("RGB", (96, 96), (255, 0, 0))
    second = Image.new("RGB", (96, 96), (0, 0, 255))
    out = BytesIO()
    first.save(out, format="GIF", save_all=True, append_images=[second], duration=100, loop=0)
    with pytest.raises(ValueError):
        normalize_private_reference_photo(out.getvalue())


def test_reference_photo_module_contains_no_provider_or_disk_side_effects():
    from pathlib import Path
    code = Path(__file__).with_name("private_photo_reference.py").read_text()
    assert "openai" not in code.lower()
    assert "requests" not in code.lower()
    assert "write_bytes" not in code
    assert "FastAPI(" not in code
    assert "@app." not in code
