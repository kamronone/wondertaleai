"""Internal-only validation and normalization for private storybook illustration bytes.

No public upload handler or provider call is defined here. A trusted worker may
call normalize_private_illustration only *after* separate content moderation.
This strips metadata and converts to PNG. Limits prevent oversized payloads.
"""
from io import BytesIO
from PIL import Image, UnidentifiedImageError

MAX_INPUT_BYTES=3_000_000
MAX_OUTPUT_BYTES=3_000_000
MAX_DIMENSION=2048
MAX_PIXELS=4_000_000


def normalize_private_illustration(source:bytes)->bytes:
    if not isinstance(source,bytes) or not 0<len(source)<=MAX_INPUT_BYTES:
        raise ValueError("Invalid illustration size")
    try:
        with Image.open(BytesIO(source)) as opened:
            if opened.format not in ("PNG","JPEG","WEBP"):
                raise ValueError("Unsupported illustration file")
            if getattr(opened,"n_frames",1)!=1:
                raise ValueError("Animated illustrations are not supported")
            width,height=opened.size
            if not 64<=width<=MAX_DIMENSION or not 64<=height<=MAX_DIMENSION or width*height>MAX_PIXELS:
                raise ValueError("Illustration dimensions are out of bounds")
            opened.load()
            if opened.mode in ("RGBA","LA"):
                image=opened.convert("RGBA")
            else:
                image=opened.convert("RGB")
            # Copy decoded pixels only; discard EXIF, ICC, comments and GPS.
            clean=Image.new(image.mode,image.size)
            clean.paste(image)
            out=BytesIO()
            clean.save(out,format="PNG",optimize=True)
            encoded=out.getvalue()
            if len(encoded)>MAX_OUTPUT_BYTES:
                raise ValueError("Normalized illustration is too large")
            return encoded
    except (UnidentifiedImageError,Image.DecompressionBombError,OSError) as exc:
        raise ValueError("Invalid illustration image") from exc
