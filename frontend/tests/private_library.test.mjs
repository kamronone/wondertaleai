import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/private_library.ts", import.meta.url), "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { transferLocalBooks, updatePrivateReadingProgress, setPrivateFavorite, PrivateBookNotFoundError } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

const book = (id) => ({
  id, savedOnDevice: true, title: "A story", name: "Alex", age: 7,
  prompt: "A friendly adventure", theme: "forest", style: "gentle",
  language: "en", pages: [{ number: 1, text: "Once upon a time", image_url: "/images/wondertale-hero.webp" }]
});
const row = (id) => ({
  id: "remote-" + id, title: "A story", child_name: "Alex", age: 7,
  created_at: "2026-11-19T00:00:00Z",
  story: JSON.stringify({ version: 1, source_id: id, pages: [{ number: 1, text: "Once upon a time" }] })
});
const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const withFetch = async (handler, run) => {
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  try { await run(); } finally { globalThis.fetch = previous; }
};
const server = (ids) => (url) => {
  if (url.endsWith("/api/books")) return json(ids.map(row));
  if (url.endsWith("/api/books/favorites")) return json({ ids: [] });
  if (url.endsWith("/api/books/progress")) return json([]);
  throw Error("Unexpected URL " + url);
};

test("network timeout after committed POST counts as uploaded and does not duplicate on retry", async () => {
  const ids = new Set();
  let posts = 0;
  await withFetch(async (url, options) => {
    if (options?.method === "POST") {
      posts++;
      ids.add(JSON.parse(options.body).story && JSON.parse(JSON.parse(options.body).story).source_id);
      throw Error("Connection dropped after commit");
    }
    return server([...ids])(url);
  }, async () => {
    const first = await transferLocalBooks("https://api.test", "token", [book("local-one")]);
    assert.deepEqual([first.uploaded, first.existing, first.failed], [1, 0, 0]);
    const retry = await transferLocalBooks("https://api.test", "token", [book("local-one")]);
    assert.deepEqual([retry.uploaded, retry.existing, retry.failed], [0, 1, 0]);
    assert.equal(posts, 1);
  });
});

test("uncommitted POST timeout is reported as failed", async () => {
  await withFetch(async (url, options) => options?.method === "POST" ? Promise.reject(Error("offline")) : server([])(url), async () => {
    const result = await transferLocalBooks("https://api.test", "token", [book("local-two")]);
    assert.deepEqual([result.uploaded, result.existing, result.failed], [0, 0, 1]);
  });
});

test("corrupt local book does not block valid book", async () => {
  const ids = new Set();
  await withFetch(async (url, options) => {
    if (options?.method === "POST") {
      ids.add(JSON.parse(JSON.parse(options.body).story).source_id);
      return json({ id: "saved" });
    }
    return server([...ids])(url);
  }, async () => {
    const result = await transferLocalBooks("https://api.test", "token", [
      { ...book("local-broken"), pages: [] }, book("local-valid")
    ]);
    assert.deepEqual([result.uploaded, result.existing, result.failed], [1, 0, 1]);
  });
});

test("transfer handles more than twenty saved stories", async () => {
  const ids = new Set();
  await withFetch(async (url, options) => {
    if (options?.method === "POST") {
      ids.add(JSON.parse(JSON.parse(options.body).story).source_id);
      return json({ id: "saved" });
    }
    return server([...ids])(url);
  }, async () => {
    const result = await transferLocalBooks("https://api.test", "token", Array.from({ length: 21 }, (_, i) => book("local-" + i)));
    assert.deepEqual([result.uploaded, result.existing, result.failed], [21, 0, 0]);
  });
});


test("HTTP 500 after committed import is reconciled as uploaded", async () => {
  const ids = new Set();
  let posts = 0;
  await withFetch(async (url, options) => {
    if (options?.method === "POST") {
      posts++;
      ids.add(JSON.parse(JSON.parse(options.body).story).source_id);
      return json({ detail: "Server error after commit" }, 500);
    }
    return server([...ids])(url);
  }, async () => {
    const first = await transferLocalBooks("https://api.test", "token", [book("local-server-500")]);
    assert.deepEqual([first.uploaded, first.existing, first.failed], [1, 0, 0]);
    const retry = await transferLocalBooks("https://api.test", "token", [book("local-server-500")]);
    assert.deepEqual([retry.uploaded, retry.existing, retry.failed], [0, 1, 0]);
    assert.equal(posts, 1);
  });
});

test("HTTP 500 without committed import is reported as failed", async () => {
  await withFetch(async (url, options) => (
    options?.method === "POST" ? json({ detail: "Server unavailable" }, 503) : server([])(url)
  ), async () => {
    const result = await transferLocalBooks("https://api.test", "token", [book("local-server-503")]);
    assert.deepEqual([result.uploaded, result.existing, result.failed], [0, 0, 1]);
  });
});

test("HTTP 400 validation error is not treated as an uncertain commit", async () => {
  let bookGets = 0;
  await withFetch(async (url, options) => {
    if (options?.method === "POST") return json({ detail: "Invalid story" }, 422);
    if (url.endsWith("/api/books")) bookGets++;
    return server([])(url);
  }, async () => {
    const result = await transferLocalBooks("https://api.test", "token", [book("local-rejected")]);
    assert.deepEqual([result.uploaded, result.existing, result.failed], [0, 0, 1]);
    assert.equal(bookGets, 2); // initial listing and final library load, no reconciliation
  });
});


test("rejects malformed IDs and out-of-range ages before sending private data", async () => {
  let posts = 0;
  await withFetch(async (url, options) => {
    if (options?.method === "POST") {
      posts++;
      throw Error("Invalid book was sent");
    }
    return server([])(url);
  }, async () => {
    const books = [
      book("foreign-1"),
      book("local-../../invalid"),
      { ...book("local-too-young"), age: 1 },
      { ...book("local-too-old"), age: 15 },
      { ...book("local-title-too-long"), title: "T".repeat(121) },
      { ...book("local-name-too-long"), name: "N".repeat(61) },
    ];
    const result = await transferLocalBooks("https://api.test", "token", books);
    assert.deepEqual([result.uploaded, result.existing, result.failed], [0, 0, books.length]);
    assert.equal(posts, 0);
  });
});


test("expired session stops transfer without sending remaining books", async () => {
  let posts = 0;
  await withFetch(async (url, options) => {
    if (options?.method === "POST") {
      posts++;
      return json({ detail: "Expired token" }, 401);
    }
    return server([])(url);
  }, async () => {
    await assert.rejects(
      transferLocalBooks("https://api.test", "expired-token", [
        book("local-first"), book("local-second")
      ]),
      /authorization expired/
    );
    assert.equal(posts, 1);
  });
});

test("forbidden account stops transfer rather than treating denial as network timeout", async () => {
  let posts = 0;
  await withFetch(async (url, options) => {
    if (options?.method === "POST") {
      posts++;
      return json({ detail: "Forbidden" }, 403);
    }
    return server([])(url);
  }, async () => {
    await assert.rejects(
      transferLocalBooks("https://api.test", "forbidden-token", [
        book("local-first"), book("local-second")
      ]),
      /authorization expired/
    );
    assert.equal(posts, 1);
  });
});

test("A missing progress record is distinguishable from a temporary server failure",async()=>{
  await withFetch(async()=>json({detail:"Not found"},404),async()=>{
    await assert.rejects(
      updatePrivateReadingProgress("https://api.test","token","book-missing",3),
      error=>error instanceof PrivateBookNotFoundError
    );
  });
  await withFetch(async()=>json({detail:"Server unavailable"},503),async()=>{
    await assert.rejects(
      updatePrivateReadingProgress("https://api.test","token","book-other",3),
      error=>!(error instanceof PrivateBookNotFoundError)
    );
  });
});

test("A missing favorite record is distinguishable from expired authorization",async()=>{
  await withFetch(async()=>json({detail:"Not found"},404),async()=>{
    await assert.rejects(
      setPrivateFavorite("https://api.test","token","book-missing",true),
      error=>error instanceof PrivateBookNotFoundError
    );
  });
  await withFetch(async()=>json({detail:"Forbidden"},403),async()=>{
    await assert.rejects(
      setPrivateFavorite("https://api.test","token","book-other",true),
      /authorization expired/
    );
  });
});
