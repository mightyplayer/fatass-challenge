import { FeedCard } from "@/components/FeedItems";
import { PostComposer } from "@/components/Forms";
import { getFeed } from "@/lib/feed";
import { getViewer } from "@/lib/session";
import { isAdmin } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await getViewer();
  const items = await getFeed(user?.id ?? null);
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="h1">Лента</h1>
      {user?.role === "PARTICIPANT" && <PostComposer />}
      {items.length === 0 && <p className="muted">Пока тихо.</p>}
      {items.map((item) => (
        <FeedCard key={`${item.type}-${item.data.id}`} item={item} viewerId={user?.id ?? null} isAdmin={isAdmin(user)} />
      ))}
    </div>
  );
}
