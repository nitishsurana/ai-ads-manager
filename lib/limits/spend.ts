import "server-only";
import { getSpendTodayUsd } from "@/lib/db/queries";
import { getEnv } from "@/lib/env";

export async function spendCapReached() {
  return (await getSpendTodayUsd()) >= getEnv().SPEND_CAP_USD_DAILY;
}
