import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "svelte/compiler";
import { render } from "svelte/server";

test("Tela final renderiza vitória, derrota e empate; controles exclusivos do Narrador", async () => {
  const source = await readFile(
    new URL("../src/lib/components/GameEnding.svelte", import.meta.url),
    "utf8",
  );
  const compiled = compile(source, { generate: "server" }).js.code;
  const code = compiled.replace(
    /from (['"])([^'"]+)\1/g,
    (_, _quote, specifier: string) => {
      const path =
        specifier === "$lib/game/roles"
          ? new URL("../src/lib/game/roles.ts", import.meta.url).href
          : import.meta.resolve(specifier);
      return `from ${JSON.stringify(path)}`;
    },
  );
  const { default: Ending } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
  for (const [winner, title] of [
    ["city", "A cidade resistiu."],
    ["assassins", "A noite venceu."],
    ["draw", "Uma cidade em silêncio."],
    ["fool", "O Rei Louco riu por último."],
  ]) {
    for (const admin of [true, false]) {
      const { body } = render(Ending, {
        props: {
          result: {
            winner,
            rounds: 2,
            players: [
              {
                id: "a",
                name: "Ana",
                role: "doctor",
                alive: false,
                connected: true,
              },
            ],
            timeline: [
              { round: 2, phase: "night", text: "Ana morreu durante a noite." },
            ],
          },
          admin,
          connected: true,
          send: () => {},
        },
      });
      assert(body.includes(title));
      assert(body.includes("Morto"));
      assert(body.includes("Ana morreu durante a noite."));
      assert.equal(body.includes("Jogar novamente"), admin);
      assert.equal(body.includes("Fechar sala"), admin);
    }
  }
});
