import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUserProfile } from "@/lib/auth/session";
import { createLeadAction } from "@/lib/crm/actions";
import { CreateLeadForm } from "@/components/crm/create-lead-form";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const profile = await requireUserProfile();
  if (profile.role === "member") redirect("/crm");

  // Runs the existing create logic, then goes back to the CRM list on
  // success (or stays here with the error message on failure).
  async function submitLead(formData: FormData) {
    "use server";
    const result = await createLeadAction(formData);
    if (result?.error) {
      redirect(`/crm/new?error=${encodeURIComponent(result.error)}`);
    }
    redirect("/crm");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="relative flex items-center justify-center py-1">
        <Link
          href="/crm"
          aria-label="Back to CRM"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold">Add Lead</h1>
      </div>

      {searchParams?.error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {searchParams.error}
        </p>
      )}

      <CreateLeadForm action={submitLead} />
    </div>
  );
}
