import { getAssignableUsers } from "@/lib/crm/actions";
import { requireUserProfile } from "@/lib/auth/session";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/types/crm";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const section = "space-y-4 rounded-2xl border bg-card p-4 shadow-card";
const sectionTitle = "text-sm font-semibold";

export async function CreateLeadForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const profile = await requireUserProfile();
  const users = await getAssignableUsers();

  return (
    <form action={action} className="space-y-4">
      <section className={section}>
        <h2 className={sectionTitle}>Lead information</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Contact person" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_name">Address</Label>
          <Input id="business_name" name="business_name" placeholder="Clinic / shop, city" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="+91" required />
        </div>
      </section>

      <section className={section}>
        <h2 className={sectionTitle}>Deal</h2>
        <div className="space-y-2">
          <Label htmlFor="stage">Stage</Label>
          <Select name="stage" defaultValue="new_lead" required>
            <SelectTrigger id="stage" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {LEAD_STAGE_LABELS[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="assigned_to">Assigned to</Label>
          <Select name="assigned_to" required>
            <SelectTrigger id="assigned_to" className="w-full">
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                  {user.id === profile.id ? " — You" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal_value">Deal value</Label>
          <Input id="deal_value" name="deal_value" type="number" step="0.01" inputMode="decimal" placeholder="0" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} placeholder="What was discussed?" required />
        </div>
      </section>

      <section className={section}>
        <h2 className={sectionTitle}>Optional</h2>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="name@email.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_contact">Last contact</Label>
          <Input id="last_contact" name="last_contact" type="datetime-local" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="next_followup">Next follow-up</Label>
          <Input id="next_followup" name="next_followup" type="datetime-local" />
        </div>
      </section>

      {/* Submit stays pinned at the bottom (above the mobile tab bar), like
          the native Add screens. */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 border-t bg-card/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-2xl lg:border">
        <SubmitButton loadingText="Saving..." className="h-11 w-full">
          Submit
        </SubmitButton>
      </div>
    </form>
  );
}
