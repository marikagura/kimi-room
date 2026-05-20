import { redirect } from "next/navigation";

// Settings 已搬到 /backstage/settings (LLM key + 头像 + 名字 + demo + meds).
// /backstage/character 是 SP + memory inject (人设 voice).
// 老链接 redirect · backwards compat.

export default function SettingsRedirect() {
  redirect("/backstage/settings");
}
