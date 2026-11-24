import { FileField } from "@/components/FileField";
import {
  contributeToFund,
  createChallenge,
  createPost,
  donate,
  renameUser,
  saveFundRequisites,
  saveFundSettings,
  savePredictions,
  updateRequisites,
  adminUpdateRequisites,
  setPlaceholderUsername,
  submitResult,
  updateProfile,
} from "@/app/actions";
import { ActionForm } from "./ActionForm";

export function PostComposer() {
  return (
    <ActionForm action={createPost} submitLabel="Опубликовать" resetOnSuccess className="card space-y-3">
      <textarea name="text" rows={3} maxLength={4000} required className="input block" />
      <FileField name="images" label="Фото" multiple />
    </ActionForm>
  );
}

type ResultDefaults = {
  weight?: number;
  waistCm?: number | null;
  stepsDays?: number;
  cardioDays?: number;
  strengthSessions?: number;
  penalty?: number;
  note?: string | null;
};

function NumField({ name, label, value, max, hint }: { name: string; label: string; value?: number | null; max?: number; hint?: string }) {
  return (
    <label>
      <span className="label" title={hint}>
        {label}
      </span>
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        defaultValue={value ?? undefined}
        placeholder="0"
        className="input"
      />
    </label>
  );
}

/**
 * Админ вносит результат участника. На старте и в финале — только вес и талия,
 * в обычную неделю — вес и показатели активности, из которых считаются баллы.
 */
export function AdminResultForm({
  participantId,
  week,
  kind,
  defaults,
}: {
  participantId: string;
  week: number;
  kind: "start" | "weekly" | "final";
  defaults?: ResultDefaults;
}) {
  return (
    <ActionForm action={submitResult} submitLabel={defaults ? "Обновить" : "Сохранить"} className="space-y-3">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="week" value={week} />
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <label>
          <span className="label">Вес, кг</span>
          <input name="weight" inputMode="decimal" required defaultValue={defaults?.weight} className="input" />
        </label>
        {kind === "weekly" ? (
          <>
            <NumField name="stepsDays" label="Дней 10k шагов" value={defaults?.stepsDays} max={7} />
            <NumField name="cardioDays" label="Дней кардио 60+" value={defaults?.cardioDays} max={7} />
            <NumField name="strengthSessions" label="Силовых 45+" value={defaults?.strengthSessions} max={7} />
            <NumField name="penalty" label="Штраф, баллы" value={defaults?.penalty} max={100} />
          </>
        ) : (
          <label>
            <span className="label">Талия, см</span>
            <input name="waistCm" inputMode="decimal" required defaultValue={defaults?.waistCm ?? undefined} className="input" />
          </label>
        )}
        <label className={kind === "weekly" ? "" : "col-span-2 md:col-span-4"}>
          <span className="label">Комментарий</span>
          <input name="note" maxLength={1000} defaultValue={defaults?.note ?? undefined} className="input" />
        </label>
      </div>
    </ActionForm>
  );
}

export function RenameForm({ user }: { user: { id: string; name: string } }) {
  return (
    <ActionForm action={renameUser} submitLabel="Ок" className="flex items-center gap-2" submitClassName="btn-ghost !py-1 !px-2 !text-xs">
      <input type="hidden" name="userId" value={user.id} />
      <input name="name" defaultValue={user.name} maxLength={60} className="input !py-1 !text-sm w-40" />
    </ActionForm>
  );
}

export function UsernameForm({ user }: { user: { id: string; username: string | null } }) {
  return (
    <ActionForm action={setPlaceholderUsername} submitLabel="Ок" className="flex items-center gap-2" submitClassName="btn-ghost !py-1 !px-2 !text-xs">
      <input type="hidden" name="userId" value={user.id} />
      <span className="text-xs muted">@</span>
      <input name="username" defaultValue={user.username ?? ""} maxLength={64} className="input !py-1 !text-sm w-36" />
    </ActionForm>
  );
}

function SbpFields({ sbpPhone, sbpBank }: { sbpPhone: string | null; sbpBank: string | null }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <label>
        <span className="label">Телефон для СБП</span>
        <input name="sbpPhone" type="tel" required defaultValue={sbpPhone ?? undefined} placeholder="+7 900 000-00-00" className="input" />
      </label>
      <label>
        <span className="label">Банк</span>
        <input name="sbpBank" required maxLength={60} defaultValue={sbpBank ?? undefined} placeholder="Т-Банк" className="input" />
      </label>
    </div>
  );
}

/** Реквизиты участника для донатов: сам участник или админ (тогда передаётся userId). */
export function RequisitesForm({ user, byAdmin }: { user: { id: string; sbpPhone: string | null; sbpBank: string | null }; byAdmin?: boolean }) {
  if (byAdmin)
    return (
      <ActionForm action={adminUpdateRequisites} submitLabel="Ок" className="flex flex-wrap items-center gap-2" submitClassName="btn-ghost !py-1 !px-2 !text-xs">
        <input type="hidden" name="userId" value={user.id} />
        <span className="text-xs muted">СБП</span>
        <input name="sbpPhone" type="tel" defaultValue={user.sbpPhone ?? ""} placeholder="+7 900 000-00-00" className="input !py-1 !text-sm w-40" />
        <input name="sbpBank" maxLength={60} defaultValue={user.sbpBank ?? ""} placeholder="Банк" className="input !py-1 !text-sm w-28" />
      </ActionForm>
    );
  return (
    <ActionForm action={updateRequisites} submitLabel="Сохранить">
      <SbpFields sbpPhone={user.sbpPhone} sbpBank={user.sbpBank} />
    </ActionForm>
  );
}

export function ProfileForm({ user }: { user: { goalWeight: number | null; heightCm: number | null; motto: string | null } }) {
  return (
    <ActionForm action={updateProfile} submitLabel="Сохранить">
      <div className="grid sm:grid-cols-2 gap-3">
        <label>
          <span className="label">Цель, кг</span>
          <input name="goalWeight" inputMode="decimal" defaultValue={user.goalWeight ?? undefined} className="input" />
        </label>
        <label>
          <span className="label">Рост, см</span>
          <input name="heightCm" inputMode="numeric" defaultValue={user.heightCm ?? undefined} className="input" />
        </label>
      </div>
      <label className="block">
        <span className="label">Девиз</span>
        <input name="motto" maxLength={140} defaultValue={user.motto ?? undefined} className="input" />
      </label>
    </ActionForm>
  );
}

/** Ставки участника на финальный вес остальных. */
export function PredictionsForm({ others }: { others: { id: string; name: string; currentWeight: number | null; prediction: number | null }[] }) {
  return (
    <ActionForm action={savePredictions} submitLabel="Сохранить ставки">
      <div className="grid sm:grid-cols-2 gap-3">
        {others.map((o) => (
          <label key={o.id}>
            <span className="label">
              {o.name}
              {o.currentWeight ? ` · сейчас ${o.currentWeight} кг` : ""}
            </span>
            <input name={`p_${o.id}`} inputMode="decimal" defaultValue={o.prediction ?? undefined} className="input" />
          </label>
        ))}
      </div>
    </ActionForm>
  );
}

export function ChallengeForm({ targetId }: { targetId: string }) {
  return (
    <ActionForm action={createChallenge} submitLabel="Перейти к оплате" resetOnSuccess>
      <input type="hidden" name="targetId" value={targetId} />
      <label className="block">
        <span className="label">Что сделать</span>
        <input name="title" required maxLength={120} className="input" />
      </label>
      <label className="block">
        <span className="label">Подробности</span>
        <textarea name="description" rows={2} maxLength={1000} className="input" />
      </label>
      <label className="block">
        <span className="label">Срок</span>
        <input name="dueDate" type="date" className="input" />
      </label>
      <div>
        <span className="label">Вознаграждение</span>
        <AmountPicker name="reward" amounts={[500, 1000, 2000, 5000]} defaultAmount={1000} />
      </div>
      <label className="block">
        <span className="label">Своя сумма, ₽</span>
        <input name="reward" inputMode="numeric" className="input" />
      </label>
    </ActionForm>
  );
}

export function DonateForm({ toId }: { toId: string }) {
  return (
    <ActionForm action={donate} submitLabel="Перейти к переводу" resetOnSuccess>
      <input type="hidden" name="toId" value={toId} />
      <div className="flex gap-2 flex-wrap">
        {[100, 300, 500, 1000].map((a) => (
          <label key={a} className="chip cursor-pointer has-[:checked]:bg-[var(--color-accent)] has-[:checked]:text-white has-[:checked]:border-transparent !px-3 !py-1.5 !text-sm">
            <input type="radio" name="amount" value={a} className="sr-only" defaultChecked={a === 300} />
            {a} ₽
          </label>
        ))}
      </div>
      <label className="block">
        <span className="label">Пожелание</span>
        <input name="message" maxLength={300} className="input" />
      </label>
    </ActionForm>
  );
}

function AmountPicker({ name = "amount", amounts, defaultAmount }: { name?: string; amounts: number[]; defaultAmount: number }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {amounts.map((a) => (
        <label key={a} className="chip cursor-pointer has-[:checked]:bg-[var(--color-accent)] has-[:checked]:text-white has-[:checked]:border-transparent !px-3 !py-1.5 !text-sm">
          <input type="radio" name={name} value={a} className="sr-only" defaultChecked={a === defaultAmount} />
          {a.toLocaleString("ru-RU")} ₽
        </label>
      ))}
    </div>
  );
}

export function FundContributeForm() {
  return (
    <ActionForm action={contributeToFund} submitLabel="Перейти к переводу" resetOnSuccess>
      <AmountPicker amounts={[300, 500, 1000, 3000]} defaultAmount={500} />
      <label className="block">
        <span className="label">Своя сумма, ₽</span>
        <input name="amount" inputMode="numeric" className="input" />
      </label>
      <label className="block">
        <span className="label">Комментарий</span>
        <input name="message" maxLength={300} className="input" />
      </label>
    </ActionForm>
  );
}

export function FundSettingsForm({ baseAmount, keeperId, admins }: { baseAmount: number; keeperId: string | null; admins: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveFundSettings} submitLabel="Сохранить">
      <div className="grid sm:grid-cols-2 gap-3">
        <label>
          <span className="label">Базовая сумма, ₽</span>
          <input name="baseAmount" inputMode="numeric" defaultValue={baseAmount || undefined} placeholder="0" className="input" />
        </label>
        <label>
          <span className="label">Хранитель фонда</span>
          <select name="keeperId" defaultValue={keeperId ?? ""} className="input">
            <option value="">—</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </ActionForm>
  );
}

export function FundRequisitesForm({ sbpPhone, sbpBank }: { sbpPhone: string | null; sbpBank: string | null }) {
  return (
    <ActionForm action={saveFundRequisites} submitLabel="Сохранить">
      <SbpFields sbpPhone={sbpPhone} sbpBank={sbpBank} />
    </ActionForm>
  );
}
