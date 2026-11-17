// Runs against `next dev`: the admin console over rounds seeded straight into the tables (see admin-seed.ts). Every check that counts numbers filters to one seeded tester, because other specs may share the database.
import { expect, test, type Browser } from "@playwright/test";
import { judgeRecord, seedAdminRound, seedAdminWorkspace } from "./admin-seed";
import {
  removeRoundFiles,
  resetTesters,
  secret,
  testerContext,
  testerIds,
} from "./helpers";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const CSV_HEADER =
  "tester,workspace,product URL,round,creative n,angle,rating,tags,note,edited,judge mean of medians,low confidence,round cost";

const LIVE = "Admin Spec Candle";
const DELETED = "Admin Spec Mug";
const OTHER = "Admin Spec Blanket";
const EMPTY = "Admin Spec Empty";
// Other specs share the database, and testers with the same name merge into one group, so the numbers are read through the seeded titles.
const MINE = (name: string) =>
  `tester=${encodeURIComponent(name)}&q=Admin+Spec`;

test.describe.configure({ mode: "serial" });

test.describe("admin console", () => {
  const roundIds: string[] = [];
  const costIds: string[] = [];
  let a: Awaited<ReturnType<typeof testerContext>>;
  let b: Awaited<ReturnType<typeof testerContext>>;
  let admin: Awaited<ReturnType<typeof adminContext>>;

  async function adminContext(browser: Browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/admin/sign-in");
    await page.getByLabel("Admin password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/admin");
    return { context, page };
  }

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
    b = await testerContext(browser, "b");
    const seeded = [
      await seedAdminRound({
        userId: a.uid,
        title: LIVE,
        audience: "Edited audience for the admin spec",
        creatives: [
          {
            rating: "approve",
            note: "Love it",
            edits: [
              {
                at: "2026-11-17T10:00:00Z",
                from: { headline: "Old headline", cta: "Shop now" },
                to: { headline: "New headline", cta: "Shop now" },
              },
            ],
            judge: judgeRecord(4, false),
          },
          {
            rating: "reject",
            tags: ["Copy"],
            note: 'Too pale, "washed out"\nsecond line',
            judge: judgeRecord(2, true),
          },
          { rating: null, note: "=1+1", judge: judgeRecord(3, false) },
        ],
        roundCosts: [0.1, 0.32],
        setupCost: 0.05,
      }),
      await seedAdminRound({
        userId: a.uid,
        title: DELETED,
        daysAgo: 40,
        deleted: true,
        creatives: [{ rating: "approve", judge: judgeRecord(3, false) }],
        roundCosts: [0.2],
      }),
      await seedAdminWorkspace({
        userId: a.uid,
        title: EMPTY,
        setupCost: 0.03,
        audience: "Audience of the empty workspace",
      }),
      await seedAdminRound({
        userId: b.uid,
        title: OTHER,
        creatives: [{ rating: "reject", judge: judgeRecord(4, false) }],
        roundCosts: [0.5],
      }),
    ];
    for (const item of seeded) {
      if (item.roundId) roundIds.push(item.roundId);
      costIds.push(...item.costIds);
    }
    admin = await adminContext(browser);
  });

  test.afterAll(async () => {
    await admin?.context.close();
    await secret
      .from("testers")
      .update({ is_golden: false })
      .in("user_id", Object.values(testerIds()));
    await secret.from("costs").delete().in("id", costIds);
    await removeRoundFiles(roundIds);
    await resetTesters();
    await a?.context.close();
    await b?.context.close();
  });

  test("a table of rounds grouped by tester, with tiles that exclude nothing but golden testers", async () => {
    const { page } = admin;
    await page.goto(`/admin?${MINE("E2E A")}`);

    await expect(page.getByRole("table")).toBeVisible();
    await expect(
      page.getByRole("rowgroup", { name: "E2E A" }).getByRole("row"),
    ).toHaveCount(4);
    await expect(page.getByRole("rowgroup", { name: "E2E B" })).toHaveCount(0);

    const tiles = page.getByRole("region", { name: "Summary" });
    await expect(tiles).toContainText("Rounds2");
    await expect(tiles).toContainText("4 creatives");
    await expect(tiles).toContainText("67%");
    await expect(tiles).toContainText("2 of 3 rated creatives");
    await expect(tiles).toContainText("3.0");
    await expect(tiles).toContainText("$0.70");

    await expect(
      page.getByRole("button", {
        name: `Show details for ${DELETED}, round 1`,
      }),
    ).toBeVisible();
    await expect(page.getByText("Deleted", { exact: true })).toBeVisible();
    await expect(tiles).toContainText("rounds and their workspaces");
    await expect(tiles).toContainText("Unattributed");

    const empty = page.getByRole("row", { name: new RegExp(EMPTY) });
    await expect(empty).toContainText("No rounds yet");
    await page
      .getByRole("button", { name: `Show details for ${EMPTY}, no rounds yet` })
      .click();
    const brand = page.getByRole("region", { name: "Brand kit" });
    await expect(brand).toContainText("Audience of the empty workspace");
    await expect(
      page.getByText("other workspace costs (reading, chat) $0.03"),
    ).toBeVisible();
  });

  test("an expanded row shows the brand kit, the human rating beside every judge score, and the cost", async () => {
    const { page } = admin;
    await page.goto(`/admin?${MINE("E2E A")}`);
    await page
      .getByRole("button", { name: `Show details for ${LIVE}, round 1` })
      .click();

    const brand = page.getByRole("region", { name: "Brand kit" });
    await expect(brand).toContainText("Edited audience for the admin spec");
    await expect(brand.getByRole("row", { name: /Audience/ })).toBeVisible();

    const second = page.getByRole("article", { name: "Creative 2" });
    await expect(second).toContainText("Rejected");
    await expect(second).toContainText("Copy · “Too pale");
    await expect(second).toContainText("Low confidence");
    await expect(second).toContainText("2.0 / 5");
    await expect(
      second.getByRole("row", { name: /Panel median/ }),
    ).toContainText("2");
    await expect(second.getByRole("row", { name: /claude-a/ })).toBeVisible();
    await expect(second.getByRole("row", { name: /gemini-b/ })).toBeVisible();
    await expect(
      page.getByRole("article", { name: "Creative 1" }),
    ).toContainText("Pass");
    await expect(
      page.getByRole("article", { name: "Creative 1" }),
    ).toContainText("1 text edit");
    await expect(page.getByText("round cost $0.42")).toBeVisible();
    await expect(
      page.getByText("other workspace costs (reading, chat) $0.05"),
    ).toBeVisible();
    await expect(page.getByText("Generated in 2 min 13 s")).toBeVisible();
    await expect(
      page.getByRole("article", { name: "Creative 1" }).getByRole("img"),
    ).toHaveJSProperty("complete", true);
  });

  test("search and filters narrow the rounds", async () => {
    const { page } = admin;
    await page.goto("/admin");
    await page.getByLabel("Search").fill("E2E B");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/q=E2E\+B/);
    await expect(page.getByRole("rowgroup", { name: "E2E B" })).toHaveCount(1);
    await expect(page.getByRole("rowgroup", { name: "E2E A" })).toHaveCount(0);

    await page.goto("/admin?tester=E2E+A&q=spec+mug");
    await expect(page.getByText(DELETED)).toBeVisible();
    await expect(page.getByText(LIVE)).toHaveCount(0);

    await page.goto(`/admin?${MINE("E2E A")}&date=30`);
    await expect(page.getByText(LIVE)).toBeVisible();
    await expect(page.getByText(DELETED)).toHaveCount(0);

    await page.goto(`/admin?${MINE("E2E A")}&rating=rejected`);
    await expect(page.getByText(LIVE)).toBeVisible();
    await expect(page.getByText(DELETED)).toHaveCount(0);

    await page.goto(`/admin?${MINE("E2E A")}&confidence=low`);
    await expect(page.getByText(LIVE)).toBeVisible();
    await expect(page.getByText(DELETED)).toHaveCount(0);

    await page.goto(`/admin?${MINE("E2E A")}&judge=high`);
    await expect(page.getByText(LIVE)).toBeVisible();
    await expect(page.getByText(DELETED)).toHaveCount(0);
  });

  test("a golden tester is marked and left out of the tiles", async () => {
    const { page } = admin;
    await secret
      .from("testers")
      .update({ is_golden: true })
      .eq("user_id", b.uid);
    await page.goto(`/admin?${MINE("E2E B")}`);
    await expect(page.getByRole("rowgroup", { name: "E2E B" })).toContainText(
      "Golden",
    );
    await expect(page.getByRole("region", { name: "Summary" })).toContainText(
      "Rounds0",
    );
  });

  test("the CSV has the columns, escapes quotes, commas and newlines, and neutralises formulas", async () => {
    const response = await admin.context.request.get(
      `/admin/export?${MINE("E2E A")}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toContain("attachment");
    const body = await response.text();

    expect((await response.body()).subarray(0, 3)).toEqual(
      Buffer.from([0xef, 0xbb, 0xbf]),
    );
    expect(body.replace(/^\uFEFF/, "").startsWith(`${CSV_HEADER}\r\n`)).toBe(
      true,
    );
    expect(body.trimEnd().split("\r\n")).toHaveLength(6);
    expect(body).toContain(`E2E A,${LIVE},`);
    expect(body).toContain(
      ',reject,Copy,"Too pale, ""washed out""\nsecond line",no,2.00,yes,0.4200',
    );
    expect(body).toContain(",,'=1+1,no,3.00,no,0.4200");
    expect(body).toContain(",approve,,Love it,yes,4.00,no,0.4200");
    expect(body).toContain(`E2E A,${DELETED},`);
    expect(body).toContain(`E2E A,${EMPTY},`);
    expect(body).not.toContain("E2E B");
  });

  test("a tester cookie is refused on the console and on the CSV route", async () => {
    await a.page.goto("/admin");
    await expect(a.page).toHaveURL("/admin/sign-in");

    const response = await a.context.request.get("/admin/export", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/admin/sign-in");
    expect(response.headers()["content-type"] ?? "").not.toContain("text/csv");
  });
});
