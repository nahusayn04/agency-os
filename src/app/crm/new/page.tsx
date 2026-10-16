import { redirect } from "next/navigation";

// Lead creation now happens in a popup on /crm ("+ New Lead").
// Kept only so old links and bookmarks still land somewhere sensible.
export default function NewLeadPage() {
  redirect("/crm");
}
