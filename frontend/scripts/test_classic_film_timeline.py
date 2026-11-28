"""Offline tests of the common classic film timeline."""
import importlib.util
import math
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("film_builder", Path(__file__).with_name("build-cinderella-film.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class TimelineTests(unittest.TestCase):
    def test_longest_voice_sets_each_scene(self):
        durations = {"ru": [2.1]*8, "uz": [3.0]*8, "en": [1.0]*8}
        durations["en"][3] = 4.13
        frames = builder.shared_scene_timeline(durations)
        self.assertEqual(frames, [95,95,95,124,95,95,95,95])
        for i, count in enumerate(frames):
            self.assertGreaterEqual(count / builder.FPS, max(v[i] for v in durations.values()) + 0.8 - 1e-9)

    def test_missing_or_invalid_voice_fails(self):
        valid = {lang: [1.0]*8 for lang in builder.VOICES}
        for broken in ({k:v for k,v in valid.items() if k!="uz"},
                       {**valid,"uz":[1.0]*7}, {**valid,"uz":[math.nan]*8},
                       {**valid,"uz":[121.0]*8}, {**valid,"uz":[0.1]*8}):
            with self.assertRaises(ValueError):
                builder.shared_scene_timeline(broken)


if __name__ == "__main__":
    unittest.main()
