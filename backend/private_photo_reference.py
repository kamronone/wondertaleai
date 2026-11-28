"""Internal-only preparation of a parent-authorized reference portrait.

No API route, upload, permanent storage, AI call or automatic consent is
provided here. A future authenticated worker may use this only after explicit
photo-specific parental consent, access checks and a deletion policy.

Decoded pixels are resized, EXIF orientation is applied and all original
metadata, including GPS, is stripped. Always return fresh JPEG bytes.
"""
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 5_000_000
MAX_SIDE = 4096
MAX_PIXELS = 12_000_000
OUTPUT_SIDE = 1024
MAX_OUTPUT_BYTES = 1_500_000


def normalize_private_reference_photo(source: bytes) -> bytes:
    if not isinstance(source, bytes) or not (0 < len(source) <= MAX_UPLOAD_BYTES):
        raise ValueError("Invalid reference photo size")

    try:
        with Image.open(BytesIO(source)) as original:
            if original.format not in ("JPEG", "PNG", "WEBP"):
                raise ValueError("Unsupported reference photo format")
            if getattr(original, "n_frames", 1) != 1 or getattr(original, "is_animated", False):
                raise ValueError("Animated reference photos are not supported")
            width, height = original.size
            if (
                min(width, height) < 64
                or max(width, height) > MAX_SIDE
                or width * height > MAX_PIXELS
            ):
                raise ValueError("Reference photo dimensions are out of bounds")
            original.load()
            oriented = ImageOps.exif_transpose(original)
            # Composite transparency onto opaque white, and discard ALL source
            # metadata; never propagate input EXIF, GPS, ICC or comments.
            rgba = oriented.convert("RGBA")
            canvas = Image.new("RGB", rgba.size, (255, 255, 255))
            canvas.paste(rgba, mask=rgba.getchannel("A"))
            canvas.thumbnail((OUTPUT_SIDE, OUTPUT_SIDE), Image.Resampling.LANCZOS)

            out = BytesIO()
            canvas.save(out, format="JPEG", quality=85, optimize=True)
            clean = out.getvalue()
            if not (0 < len(clean) <= MAX_OUTPUT_BYTES):
                raise ValueError("Normalized reference photo is too large")
            return clean
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise ValueError("Invalid reference photo") from exc
