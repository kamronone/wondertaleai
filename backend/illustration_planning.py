"""Privacy-first storybook illustration brief construction.

This module NEVER calls an image model. Briefs use a stable fictional mascot
and a curated scene list; no child name, private story text, email, photo,
or other parent content is sent to any provider by this module.
"""
from dataclasses import dataclass
import hashlib
import re
import unicodedata
from typing import Literal

IllustrationStyle=Literal["watercolor","storybook","pencil"]
STYLES:dict[str,str]={
    "watercolor":"delicate hand-painted watercolor with warm paper texture",
    "storybook":"soft original 2D storybook painting with rounded forms",
    "pencil":"gentle colored-pencil drawing on ivory paper",
}
MASCOTS=(
    "a little russet fox with a cream scarf and amber eyes",
    "a small teal-blue dragon with golden horns and round glasses",
    "a white rabbit with a lavender vest and long ears",
    "a curious brown bear cub wearing a blue satchel",
)
SCENES=(
    "walking beside a flowering path in the morning",
    "discovering a glowing paper lantern in a quiet garden",
    "meeting friendly birds beside a river",
    "finding a colorful bridge above a gentle stream",
    "exploring an enchanted library full of bright windows",
    "sharing a picnic with kind woodland friends",
    "helping a lost butterfly find a safe meadow",
    "watching the first stars appear in the sky",
    "following a trail of gentle lanterns into a moonlit orchard",
    "finding an old map hidden inside a hollow tree",
    "carefully crossing a mossy stone staircase beside a waterfall",
    "meeting a friendly tortoise who points toward the mountain village",
    "discovering a locked wooden gate surrounded by blue flowers",
    "solving a picture puzzle on an ancient stone fountain",
    "guiding woodland friends across a newly built little bridge",
    "returning a lost silver bell to the village clock tower",
    "gathering friends to restore the colors of a faded garden mural",
    "opening a sunlit gate as colorful butterflies rise around it",
    "celebrating a shared success with kind friends in the village square",
    "walking home beneath warm sunrise light with a cherished keepsake",
)
SAFETY=(
    "Original child-safe artwork, not based on any existing franchise. "
    "No realistic child likeness, no text or logos, no violent or frightening "
    "imagery, no identifying information. Maintain the identical fictional "
    "character appearance, outfit, and proportions in every page."
)


@dataclass(frozen=True)
class IllustrationBrief:
    book_id: str
    page_number: int
    style: IllustrationStyle
    character_guide: str
    scene: str
    prompt: str


def illustration_brief(book_id:str,page_number:int,style:IllustrationStyle,*,scene_number:int|None=None)->IllustrationBrief:
    """Return a consistent, generic draft illustration prompt.

    This is not a substitute for human-reviewed scene planning from story
    text. No API is called and no page data leaves the private database.
    """
    import uuid
    try:
        normalized=str(uuid.UUID(book_id))
    except (ValueError,AttributeError,TypeError) as exc:
        raise ValueError("Invalid book ID") from exc
    if style not in STYLES:
        raise ValueError("Unsupported illustration style")
    if isinstance(page_number,bool) or not isinstance(page_number,int) or not 1<=page_number<=20:
        raise ValueError("Page outside permitted range")
    seed=int.from_bytes(hashlib.sha256(normalized.encode()).digest()[:4],"big")
    character=MASCOTS[seed%len(MASCOTS)]
    # All twenty possible pages have distinct, curated images. Previously
    # pages 9-20 recycled the first eight images, regardless of story length.
    if scene_number is not None and (
        isinstance(scene_number,bool) or not isinstance(scene_number,int)
        or not 1<=scene_number<=len(SCENES)
    ):
        raise ValueError("Invalid curated scene number")
    scene=SCENES[(scene_number or page_number)-1]
    prompt=f"{STYLES[style]}. Depict {character} {scene}. {SAFETY}"
    return IllustrationBrief(normalized,page_number,style,character,scene,prompt)


# Local, explicitly curated multilingual signals. Never put page text, child
# names, locations, or family information in an image prompt. Matching merely
# chooses among the safe and pre-reviewed SCENES above.
SCENE_SIGNALS:tuple[tuple[str,...],...]=(
    ("walk","travel","path","road","journey","пут","дорог","троп","гуля","yo‘l","yöl","sayohat","yur"),
    ("light","lantern","lamp","огон","фонар","свет","чироқ","chiroq","nur","yorug"),
    ("bird","friend","meet","встрет","птиц","друг","qush","do‘st","döst","uchra"),
    ("bridge","river","stream","мост","рек","ручей","ko‘pr","köpr","daryo","soy"),
    ("library","book","read","книг","библиот","kitob","o‘qi","öqi","kutub"),
    ("picnic","food","meal","share","пикник","обед","ед","овqat","taom","nonushta"),
    ("help","rescu","lost","butterfly","помог","спас","потер","капалак","yordam","qutqar"),
    ("night","stars","moon","ноч","звёзд","лун","tun","yulduz","oy"),
    ("orchard","lantern","moonlit","сад","фонар","бог","bog‘","boğ","chiroq"),
    ("map","secret","clue","карт","тайн","подсказ","xarita","sir","belgi"),
    ("climb","stairs","mountain","waterfall","лестниц","водопад","гор","zin","tog‘","toğ","sharshara"),
    ("tortoise","guide","village","черепах","деревн","qishloq","toshbaqa"),
    ("gate","locked","key","door","ворот","двер","ключ","darvoza","eshik","kalit"),
    ("puzzle","riddle","solve","загад","ребус","topishmoq","jumboq","yech"),
    ("help","cross","bridge","together","помог","переправ","birga","yordam","ko‘pr"),
    ("return","bell","clock","вернул","колокол","час","qayt","qo‘ng‘iroq","soat"),
    ("repair","restore","paint","colors","почин","крас","восстанов","ta’mir","rang","tikla"),
    ("open","free","sunlight","gate","открыл","свобод","солнц","och","erkin","quyosh"),
    ("celebrat","victory","success","party","празд","побед","успех","bayram","g‘alaba","ğalaba"),
    ("home","ending","finally","morning","returned","домой","наконец","рассвет","uyga","nihoyat","tong"),
)


def _scene_tokens(text: str) -> set[str]:
    # Normalize common Uzbek apostrophe variants and the alternate spelling
    # used in the UI. No original text is ever copied into an image prompt.
    text = unicodedata.normalize("NFKC", text).casefold()
    text = re.sub(r"[‘’ʻʼ`']", "'", text)
    text = text.replace("o'", "ö").replace("g'", "ğ")
    text = text.replace("sh", "ş").replace("ch", "ç").replace("ё", "е")
    return set(re.findall(r"[^\W\d_]+", text, flags=re.UNICODE))


def _scene_hits(tokens: set[str], keywords: tuple[str, ...]) -> int:
    # Group spelling variants by normalization, not by the number of repeated
    # occurrences. Short terms match complete words; longer stems may match
    # inflections at the beginning of a word, never inside unrelated words.
    normalized = set().union(*(_scene_tokens(term) for term in keywords))
    return sum(any(word == term or (len(term) >= 4 and word.startswith(term))
                   for word in tokens) for term in normalized)


def _maximum_scene_assignment(scores: list[list[int]]) -> list[int]:
    """Rectangular Hungarian assignment. Maximize total relevance, with
    deterministic column-order tie breaking. O(pages² * scenes), no packages."""
    n, m = len(scores), len(scores[0])
    if n > m or any(len(row) != m for row in scores):
        raise ValueError("Invalid scene score matrix")
    u, v, p, way = [0]*(n+1), [0]*(m+1), [0]*(m+1), [0]*(m+1)
    for i in range(1, n+1):
        p[0] = i
        j0 = 0
        best = [float("inf")]*(m+1)
        used = [False]*(m+1)
        while True:
            used[j0] = True
            i0 = p[j0]
            delta, j1 = float("inf"), 0
            for j in range(1, m+1):
                if used[j]:
                    continue
                cost = -scores[i0-1][j-1] - u[i0] - v[j]
                if cost < best[j]:
                    best[j], way[j] = cost, j0
                if best[j] < delta:
                    delta, j1 = best[j], j
            for j in range(m+1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    best[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while j0:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
    assigned = [-1]*n
    for j in range(1, m+1):
        if p[j]:
            assigned[p[j]-1] = j-1
    return assigned


def plan_story_illustrations(
    book_id:str,chapters:list[str],style:IllustrationStyle,*,legacy:bool=False
)->list[IllustrationBrief]:
    """Select distinct curated scenes using local-only chapter signals.

    This is a safe approximation, not semantic understanding or image
    generation. Private chapter text is used ephemerally for matching and is
    never returned in a prompt, logged, persisted, or sent to a provider.
    """
    if not isinstance(chapters,list) or len(chapters) not in (8,12,20):
        raise ValueError("Expected 8, 12 or 20 story chapters")
    if any(not isinstance(chapter,str) or not chapter.strip() or len(chapter)>1200 for chapter in chapters):
        raise ValueError("Invalid chapter content")
    # Validate book, page and style through the standard public interface.
    illustration_brief(book_id,1,style)
    scores=[]
    for page,chapter in enumerate(chapters):
        normalized=chapter.casefold()
        tokens=_scene_tokens(chapter)
        row=[]
        for scene_index,keywords in enumerate(SCENE_SIGNALS):
            hits=(sum(1 for term in keywords if term in normalized) if legacy
                  else _scene_hits(tokens,keywords))
            # Prefer the original index when no relevant scene is found.
            # Strong matches overrule the positional fallback.
            row.append(hits*20 - abs(scene_index-page))
        scores.append(row)

    if not legacy:
        assignment = _maximum_scene_assignment(scores)
        return [illustration_brief(book_id,page+1,style,scene_number=scene+1)
                for page,scene in enumerate(assignment)]

    # Legacy assignment is retained for existing personal plan fingerprints.
    # Assign the strongest chapter-to-scene matches first so that an early
    # generic chapter cannot take the sole relevant scene for a later chapter.
    choices=sorted(
        ((scores[p][idx],p,idx) for p in range(len(chapters)) for idx in range(len(SCENES))),
        key=lambda item:(-item[0],abs(item[1]-item[2]),item[1],item[2]),
    )
    selected:dict[int,int]={}
    used:set[int]=set()
    for _,page,scene_index in choices:
        if page not in selected and scene_index not in used:
            selected[page]=scene_index
            used.add(scene_index)
        if len(selected)==len(chapters):
            break
    return [
        illustration_brief(book_id,page+1,style,scene_number=selected[page]+1)
        for page in range(len(chapters))
    ]
