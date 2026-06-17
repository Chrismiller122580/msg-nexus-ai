import { neon } from '@neondatabase/serverless';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

interface CommentRow {
  id: number;
  comment: string;
}

async function getComments(): Promise<{ comments: CommentRow[]; schemaMissing: boolean }> {
  if (!process.env.DATABASE_URL) {
    return { comments: [], schemaMissing: false };
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql.query('SELECT id, comment FROM comments ORDER BY created_at DESC LIMIT 20');
    return { comments: rows as CommentRow[], schemaMissing: false };
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
    if (code === '42P01') {
      return { comments: [], schemaMissing: true };
    }
    throw err;
  }
}

export default async function CommentsPage() {
  async function create(formData: FormData) {
    'use server';

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }

    const sql = neon(process.env.DATABASE_URL);
    const comment = formData.get('comment');

    if (typeof comment !== 'string' || !comment.trim()) {
      return;
    }

    await sql.query('INSERT INTO comments (comment) VALUES ($1)', [comment.trim()]);
    revalidatePath('/comments');
  }

  const { comments, schemaMissing } = await getComments();
  const dbConfigured = Boolean(process.env.DATABASE_URL);

  return (
    <div className="min-h-screen bg-background text-foreground p-8 max-w-lg mx-auto">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>

      <h1 className="text-2xl font-semibold mt-6 mb-2">Neon comments demo</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Quick Postgres connectivity test using <code className="text-xs">@neondatabase/serverless</code>.
      </p>

      {!dbConfigured && (
        <p className="text-sm text-red-500 mb-4" role="alert">
          DATABASE_URL is not set. Add it to your environment variables and run{' '}
          <code className="text-xs">npm run db:push</code>.
        </p>
      )}

      {schemaMissing && (
        <p className="text-sm text-amber-600 mb-4" role="alert">
          The <code className="text-xs">comments</code> table is missing. Run{' '}
          <code className="text-xs">npm run db:push</code> against your Neon database to create it.
        </p>
      )}

      <form action={create} className="flex gap-2 mb-8">
        <input
          type="text"
          placeholder="Write a comment"
          name="comment"
          required
          disabled={!dbConfigured || schemaMissing}
          className="flex-1 bg-input border border-input-border rounded-2xl px-4 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!dbConfigured || schemaMissing}
          className="btn btn-primary disabled:opacity-50"
        >
          Submit
        </button>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Recent comments</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-2">
            {comments.map((row) => (
              <li key={row.id} className="card px-4 py-2 text-sm">
                {row.comment}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}