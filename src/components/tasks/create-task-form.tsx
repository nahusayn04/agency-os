import { getAssignableMembers } from "@/lib/tasks/actions";
import { requireUserProfile } from "@/lib/auth/session";
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

function formatAssigneeLabel(
  user: { name: string; email: string; is_active?: boolean },
  currentUserId: string,
  userId: string
): string {
  const base = user.name;
  if (userId === currentUserId) {
    return `${base} — You`;
  }
  if (user.is_active === false) {
    return `${base} — Inactive`;
  }
  return base;
}

const section = "space-y-4 rounded-2xl border bg-card p-4 shadow-card";
const sectionTitle = "text-sm font-semibold";

export async function CreateTaskForm({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const profile = await requireUserProfile();
  const members = await getAssignableMembers();

  return (
    <form action={action} className="space-y-4">
      <section className={section}>
        <h2 className={sectionTitle}>Task</h2>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" placeholder="What needs to be done?" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} placeholder="Details (optional)" />
        </div>
      </section>

      <section className={section}>
        <h2 className={sectionTitle}>Details</h2>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue="medium">
            <SelectTrigger id="priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" name="deadline" type="datetime-local" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assigned_to">Assign to</Label>
          <Select name="assigned_to" required>
            <SelectTrigger id="assigned_to" className="w-full">
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {formatAssigneeLabel(member, profile.id, member.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Submit stays pinned at the bottom (above the mobile tab bar). */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 border-t bg-card/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-2xl lg:border">
        <SubmitButton loadingText="Creating task..." className="h-11 w-full">
          Create task
        </SubmitButton>
      </div>
    </form>
  );
}
