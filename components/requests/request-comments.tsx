import {
  formatDateTime,
  memberDisplayName,
  type MemberLabelMap,
} from "@/lib/requests/presentation";
import type { RequestComment } from "@/lib/requests/queries";

type RequestCommentsProps = {
  comments: RequestComment[];
  memberLabels: MemberLabelMap;
};

export function RequestComments({ comments, memberLabels }: RequestCommentsProps) {
  if (comments.length === 0) {
    return <p className="mt-5 text-sm text-muted">No comments yet.</p>;
  }

  return (
    <div className="mt-5 space-y-5">
      {comments.map((comment) => (
        <article key={comment.id} className="border-l-2 border-line pl-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">
              {memberDisplayName(comment.author_id, memberLabels, "Former member")}
            </p>
            <time className="text-xs text-muted" dateTime={comment.created_at}>
              {formatDateTime(comment.created_at)}
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
            {comment.body}
          </p>
        </article>
      ))}
    </div>
  );
}
