import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { chatLeads } from '@/db/schema';
import { can, getCurrentUser } from '@/server/auth/rbac';
import { csvCell } from '@/lib/csv';

// CSV export of chat-captured leads, highest score first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, 'messages:write')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const rows = await db
    .select()
    .from(chatLeads)
    .orderBy(desc(chatLeads.score), desc(chatLeads.createdAt));

  const header = [
    'Captured',
    'Score',
    'Status',
    'Name',
    'Email',
    'Phone',
    'Company',
    'Website',
    'Industry',
    'Services',
    'Budget',
    'Timeline',
    'Project summary',
    'Internal note',
    'Conversation',
  ];

  const lines = [
    header.join(','),
    ...rows.map((lead) =>
      [
        lead.createdAt.toISOString(),
        String(lead.score),
        lead.status,
        lead.name,
        lead.email,
        lead.phone,
        lead.company,
        lead.website,
        lead.industry,
        lead.servicesInterested.join('; '),
        lead.budget,
        lead.timeline,
        lead.projectSummary,
        lead.internalNote,
        `/admin/ai/conversations/${lead.conversationId}`,
      ]
        .map((value) => csvCell(String(value ?? '')))
        .join(','),
    ),
  ];

  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="elenor-ai-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
