// Runs against `next dev` with PROVIDERS=fake (the Playwright config sets it): the chat model is scripted and intakes replay golden/fixtures.
import { expect, test } from "@playwright/test";
import {
  resetTesters,
  secret,
  sendMessage,
  TESTER_NAMES,
  testerContext,
} from "./helpers";

const REPLAY_URL = "https://plain.example/products/blue-mug";
const MALFORMED_URL = "htps://www.allbirds.com/products/mens-tree-runners";
const NAVIGATE_TIMEOUT = 30_000;
const FAILED_INTAKE_TIMEOUT = 60_000;

test.afterAll(resetTesters);
test.describe.configure({ mode: "serial" });

test.describe("chat", () => {
  let a: Awaited<ReturnType<typeof testerContext>>;
  let threadId: string;

  test.beforeAll(async ({ browser }) => {
    a = await testerContext(browser, "a");
  });
  test.afterAll(async () => {
    await a?.context.close();
  });

  test("the empty screen shows the steps and examples that fill the composer", async () => {
    const { page } = a;
    await expect(
      page.getByRole("heading", { name: "Start with a product link" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(3);
    await expect(
      page.getByText(
        `Hi ${TESTER_NAMES.a}. Paste a Shopify product link to start.`,
      ),
    ).toBeVisible();

    const examples = page.getByRole("button", { name: /\/products\// });
    await expect(examples).toHaveCount(3);
    await examples.first().click();
    await expect(page.getByLabel("Message")).toHaveValue(
      /^goertzenpottery\.com\/products\/a-a-a-mark-s-mug .+/,
    );
    await page.getByLabel("Message").fill("");
  });

  test("a message with a campaign, a fact and a link starts the intake", async () => {
    const { page, uid } = a;
    const text = `Diwali gifting for young professionals. 20% off for Diwali. ${REPLAY_URL}`;
    await sendMessage(page, text);
    await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, {
      timeout: NAVIGATE_TIMEOUT,
    });

    const chat = page.getByRole("log", { name: "Conversation" });
    await expect(chat.getByText(REPLAY_URL, { exact: true })).toBeVisible();
    await expect(
      chat.getByText(
        "Diwali gifting for young professionals. 20% off for Diwali.",
      ),
    ).toBeVisible();
    await expect(
      chat.getByText(
        "Got it. Added Occasion: Diwali; Audience: Young professionals; Fact: 20% off for Diwali.",
      ),
    ).toBeVisible();
    await expect(chat.getByText("Added to the creative brief")).toBeVisible();
    await expect(chat.getByText("confirm it on the right")).toBeVisible();
    await expect(chat.getByText("Audience", { exact: true })).toBeVisible();

    const { data: thread } = await secret
      .from("threads")
      .select("id, campaign")
      .eq("user_id", uid)
      .single();
    threadId = thread?.id ?? "";
    expect(thread?.campaign).toEqual({
      occasion: "Diwali",
      audience: "Young professionals",
    });
    const { data: facts } = await secret
      .from("facts")
      .select("text, kind, status")
      .eq("thread_id", threadId);
    expect(facts).toEqual([
      { text: "20% off for Diwali", kind: "offer", status: "pending" },
    ]);
    const { data: intakes } = await secret
      .from("intakes")
      .select("url")
      .eq("thread_id", threadId);
    expect(intakes).toEqual([{ url: REPLAY_URL }]);

    await expect(
      chat
        .getByRole("alert")
        .getByText("Only Shopify product pages are supported for now."),
    ).toBeVisible({ timeout: FAILED_INTAKE_TIMEOUT });
    await expect(page.getByLabel("Message")).toHaveAttribute(
      "placeholder",
      "Paste a Shopify product link…",
    );
  });

  test("a malformed link fails with its message", async () => {
    const { page } = a;
    await sendMessage(page, MALFORMED_URL);
    await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, {
      timeout: NAVIGATE_TIMEOUT,
    });
    await expect(
      page
        .getByRole("log", { name: "Conversation" })
        .getByRole("alert")
        .getByText(
          "That doesn't look like a valid link. Check it and try again.",
        ),
    ).toBeVisible({ timeout: FAILED_INTAKE_TIMEOUT });
    await expect(
      page.getByRole("heading", { name: "We couldn’t read this product" }),
    ).toBeVisible();
  });

  test("a message without a link only updates the brief", async () => {
    const { page } = a;
    await page.goto("/");
    await sendMessage(
      page,
      "Mother's Day for new moms. Free gift wrap on all orders.",
    );
    const chat = page.getByRole("log", { name: "Conversation" });
    await expect(
      chat.getByText(
        "Got it. Added Occasion: Mother's Day; Audience: New moms; Fact: Free gift wrap on all orders.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL("/");
    await expect(
      chat.getByText("Free gift wrap on all orders · "),
    ).toBeVisible();

    const { data: intakes } = await secret
      .from("intakes")
      .select("id")
      .eq("thread_id", threadId);
    expect(intakes).toHaveLength(2);
    const { data: facts } = await secret
      .from("facts")
      .select("text, status")
      .eq("thread_id", threadId)
      .order("created_at");
    expect(facts).toEqual([
      { text: "20% off for Diwali", status: "pending" },
      { text: "Free gift wrap on all orders", status: "pending" },
    ]);
  });

  test("another tester can't reach this thread through the chat route", async ({
    browser,
  }) => {
    const b = await testerContext(browser, "b");
    const message = {
      id: "intruderintruder1",
      role: "user",
      parts: [{ type: "text", text: "Diwali for everyone" }],
    };
    const crossThread = await b.context.request.post("/api/chat", {
      data: { threadId, message },
    });
    expect(crossThread.status()).toBe(404);

    const { data: intake } = await secret
      .from("intakes")
      .select("id")
      .eq("thread_id", threadId)
      .limit(1)
      .single();
    const reading = await b.page.goto(`/r/${intake?.id}`);
    expect(reading?.status()).toBe(404);

    const bare = await browser.newContext();
    const anonymous = await bare.request.post("/api/chat", {
      data: { threadId, message },
    });
    expect(anonymous.status()).toBe(401);

    const { data: leaked } = await secret
      .from("messages")
      .select("id")
      .eq("thread_id", threadId)
      .eq("ui_id", "intruderintruder1");
    expect(leaked).toEqual([]);
    await Promise.all([b.context.close(), bare.close()]);
  });
});
