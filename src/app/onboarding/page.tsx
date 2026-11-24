import { redirect } from "next/navigation";
import { chooseRole } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { requireUser, safeNext } from "@/lib/session";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireUser({ allowPending: true });
  const next = safeNext((await searchParams).next);
  if (user.role !== "PENDING") redirect(next);
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="h1">Привет, {user.name}!</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <div className="text-3xl">🏃</div>
          <h2 className="h2">Участник</h2>
          <ActionForm action={chooseRole} submitLabel="Я участвую">
            <input type="hidden" name="role" value="PARTICIPANT" />
            <input type="hidden" name="next" value={next} />
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="label">Цель, кг</span>
                <input name="goalWeight" inputMode="decimal" className="input" />
              </label>
              <label>
                <span className="label">Рост, см</span>
                <input name="heightCm" inputMode="numeric" className="input" />
              </label>
            </div>
            <label className="block">
              <span className="label">Девиз (необязательно)</span>
              <input name="motto" maxLength={140} className="input" placeholder="Минус 10 к лету!" />
            </label>
          </ActionForm>
        </div>
        <div className="card space-y-3">
          <div className="text-3xl">📣</div>
          <h2 className="h2">Болельщик</h2>
          <ActionForm action={chooseRole} submitLabel="Я болею">
            <input type="hidden" name="role" value="FAN" />
            <input type="hidden" name="next" value={next} />
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
