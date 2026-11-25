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


def render_local_story_page(reference_jpeg:bytes,page_number:int,page_count:int=8)->bytes:
    """Local storyboard prototype: consistent portrait, different illustrated scenes.

    This is a mock-up, NOT a generated likeness or an AI-painted character.
    It intentionally reuses the same photo crop on every page, while the
    curated background changes with page number. Nothing is persisted.
    """
    if type(page_count) is not int or page_count not in (8,12,20):
        raise ValueError("Unsupported page count")
    if type(page_number) is not int or not 1<=page_number<=page_count:
        raise ValueError("Invalid storyboard page")
    from PIL import ImageDraw
    import math

    # Fixed source crop yields an identical, non-biometric portrait every time.
    clean=normalize_private_reference_photo(reference_jpeg)
    with Image.open(BytesIO(clean)) as original:
        portrait=ImageOps.fit(original.convert("RGB"),(280,280),
                              method=Image.Resampling.LANCZOS,centering=(0.5,0.42))
    palette=(
        ((194,218,235),(247,229,203),(80,141,124)),
        ((211,199,236),(252,226,207),(127,102,163)),
        ((181,219,213),(251,238,197),(81,140,122)),
        ((244,209,191),(252,235,209),(161,121,86)),
        ((184,211,239),(233,229,246),(101,132,173)),
        ((236,215,229),(255,240,209),(163,114,144)),
        ((213,231,200),(248,230,204),(103,148,95)),
        ((184,190,229),(240,209,233),(112,117,171)),
    )
    sky,ground,accent=palette[(page_number-1)%len(palette)]
    canvas=Image.new("RGB",PREVIEW_SIZE,sky)
    draw=ImageDraw.Draw(canvas)
    # Original decorative scene geometry varies by page but never uses
    # chapter text, child names, photo data, or external artwork.
    draw.ellipse((340,35,464,159),fill=(255,242,205))
    draw.ellipse((-100,275,355,640),fill=ground)
    draw.ellipse((245,294,670,665),fill=tuple(max(0,c-24) for c in ground))
    for i in range(6):
        x=(i*97+page_number*29)%540-15
        y=235+(i%3)*56
        draw.line((x,y+85,x,y+25),fill=accent,width=7)
        draw.ellipse((x-25,y-5,x+25,y+43),fill=accent)
    for i in range(9):
        a=i*2*math.pi/9+page_number/7
        x=int(260+217*math.cos(a))
        y=int(250+208*math.sin(a))
        draw.ellipse((x-3,y-3,x+3,y+3),fill=(255,250,229))

    # This frame is a photo-based mock-up rather than a synthesized character.
    shadow=(104,112,129)
    draw.rounded_rectangle((91,91,421,426),radius=36,fill=shadow)
    draw.rounded_rectangle((86,82,416,418),radius=36,fill=(255,247,233))
    mask=Image.new("L",(280,280),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,279,279),radius=25,fill=255)
    canvas.paste(portrait,(111,107),mask)
    draw.rounded_rectangle((102,98,401,399),radius=29,outline=accent,width=6)

    out=BytesIO()
    canvas.save(out,format="PNG",optimize=True)
    encoded=out.getvalue()
    if not 0<len(encoded)<=3_000_000:
        raise ValueError("Storyboard preview exceeds size limit")
    return encoded
