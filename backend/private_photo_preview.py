"""Offline-only illustrated preview of an already sanitized reference portrait.

Not an AI model and not a replacement for storybook scene generation. The
caller must enforce parent ownership, explicit photo consent and expiration.
Produces no side effects, external requests, facial recognition or persistence.
"""
from io import BytesIO

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from private_photo_reference import normalize_private_reference_photo

PREVIEW_SIZE=(512,512)


def render_local_portrait_preview(reference_jpeg:bytes)->bytes:
    """Produce a softly painted square JPEG portrait as a metadata-free PNG.

    A local filter retains features from the source photo. It does NOT invent
    outfits, generate a character, or claim to be an AI illustration.
    """
    clean=normalize_private_reference_photo(reference_jpeg)
    with Image.open(BytesIO(clean)) as original:
        image=ImageOps.fit(original.convert("RGB"),PREVIEW_SIZE,method=Image.Resampling.LANCZOS,
                           centering=(0.5,0.42))
        image=ImageEnhance.Color(image).enhance(1.18)
        image=ImageEnhance.Contrast(image).enhance(1.08)
        smooth=image.filter(ImageFilter.MedianFilter(size=5))
        smooth=smooth.filter(ImageFilter.SMOOTH_MORE)
        # Gentle visual separation with no text, identifiers or logos.
        edges=image.convert("L").filter(ImageFilter.FIND_EDGES)
        edges=ImageOps.invert(edges).point(lambda pixel:255 if pixel>185 else 215)
        result=Image.blend(smooth,Image.new("RGB",PREVIEW_SIZE,(250,239,226)),0.07)
        result=Image.blend(result,Image.merge("RGB",(edges,edges,edges)),0.13)
        out=BytesIO()
        result.save(out,format="PNG",optimize=True)
        encoded=out.getvalue()
        if not 0<len(encoded)<=3_000_000:
            raise ValueError("Portrait preview exceeds size limit")
        return encoded
