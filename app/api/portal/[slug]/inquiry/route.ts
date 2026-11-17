export const dynamic = 'force-dynamic';
export async function generateStaticParams() {
  return [];
}

/**
 * PORTAL INQUIRY API
 *
 * Handles contact form submissions from the portal
 * Creates an inquiry record and notifies the practitioner
 *
 * AUTHORITY, by method (the access matrix declares this route public because
 * POST must be, so GET and PATCH authorize independently, here):
 *   POST   public contact form        — anyone may write to a practitioner
 *   GET    list a portal's inquiries  — only the practitioner who owns the portal
 *   PATCH  set an inquiry's status    — only the practitioner who owns the portal
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/postgres';
import crypto from 'crypto';
import { requirePractitioner } from '@/lib/auth/getCurrentPractitioner';
import { getPractitionerFeaturesBySlug } from '@/lib/practitioner/features';
import { sendInquiryNotification } from '@/lib/portal/notifications';
import { logAction } from '@/lib/focus/weightTracking';

/**
 * Who may read or change a portal's inquiries: the practitioner who owns it.
 *
 * The slug is public, so it names a portal and authorizes nothing. Identity is
 * the verified session (never a header, query string or body field), and
 * ownership is the portal row's own member_id.
 *
 *   no valid session                      → 401
 *   signed in, not a practitioner         → 403 (decided before the slug is consulted)
 *   practitioner, portal not theirs       → 404 'Portal not found'
 *   slug does not exist / is not active   → 404 'Portal not found'
 *
 * 404 rather than 403 for a portal that exists but is not theirs, so the answer
 * is identical to a slug that does not exist and a signed-in practitioner cannot
 * use this route to learn which portals exist.
 */
async function authorizePortalOwner(
  request: NextRequest,
  slug: string
): Promise<{ practitionerId: string } | { error: Response }> {
  const auth = await requirePractitioner(request);
  if ('error' in auth) return { error: auth.error };

  const owned = await db.query(
    `SELECT id FROM practitioners
     WHERE slug = $1 AND member_id = $2 AND status = 'active'`,
    [slug, auth.identity.memberId]
  );
  if (owned.rows.length === 0) {
    return { error: NextResponse.json({ error: 'Portal not found' }, { status: 404 }) };
  }
  return { practitionerId: owned.rows[0].id };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { name, email, phone, timezone, topic, message } = body;

    // Validate required fields
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get practitioner
    const practitionerResult = await db.query(
      `SELECT id, member_id, name, email, business_name
       FROM practitioners
       WHERE slug = $1 AND status = 'active'`,
      [slug]
    );

    if (practitionerResult.rows.length === 0) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    const practitioner = practitionerResult.rows[0];
    const practitionerId = practitioner.id;

    // Check if inquiry form is enabled
    const features = await getPractitionerFeaturesBySlug(slug);
    if (!features.inquiryFormEnabled) {
      return NextResponse.json(
        { error: 'Contact form is not available for this portal' },
        { status: 403 }
      );
    }

    // Create the inquiry
    const inquiryId = crypto.randomUUID();
    await db.query(
      `INSERT INTO portal_inquiries
       (id, portal_slug, practitioner_id, name, email, phone, timezone, topic, message, source, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'portal_inquiry_form', 'new', NOW())`,
      [
        inquiryId,
        slug,
        practitionerId,
        name || null,
        email || null,
        phone || null,
        timezone || null,
        topic || null,
        message,
      ]
    );

    // Create/update marketing contact if email provided
    if (email) {
      const existingContact = await db.query(
        `SELECT id FROM marketing_contacts WHERE practitioner_id = $1 AND email = $2`,
        [practitionerId, email]
      );

      if (existingContact.rows.length === 0) {
        await db.query(
          `INSERT INTO marketing_contacts
           (id, practitioner_id, email, name, status, source, lead_score, created_at)
           VALUES ($1, $2, $3, $4, 'inquiry', 'contact_form', 50, NOW())`,
          [crypto.randomUUID(), practitionerId, email, name || 'Unknown']
        );
      } else {
        await db.query(
          `UPDATE marketing_contacts
           SET lead_score = GREATEST(lead_score, 50), updated_at = NOW()
           WHERE id = $1`,
          [existingContact.rows[0].id]
        );
      }
    }

    // Send notification to practitioner
    sendInquiryNotification(
      {
        name,
        email,
        phone,
        topic,
        message,
        source: 'portal_inquiry_form',
      },
      {
        name: practitioner.name,
        email: practitioner.email,
        portalSlug: slug,
        businessName: practitioner.business_name,
      }
    ).then(async (result) => {
      // Log weight for practitioner (silent, Phase 1)
      if (result.success && practitioner.member_id) {
        try {
          await logAction(practitioner.member_id, 'email_send', {
            source: 'portal-inquiry',
            metadata: { portalSlug: slug }
          });
        } catch (e) {
          console.warn('[Portal Inquiry] Weight logging skipped:', e);
        }
      }
    }).catch((err) => console.error('[Portal Inquiry] Notification error:', err));

    return NextResponse.json({
      success: true,
      inquiry_id: inquiryId,
      message: email
        ? `Thank you for reaching out! ${practitioner.name} will respond to ${email} within 24-48 hours.`
        : `Thank you for your message. Since no email was provided, please check back or reach out again if you haven't heard back.`,
    });
  } catch (error) {
    console.error('Portal inquiry error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to list inquiries — only the practitioner who owns the portal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const guard = await authorizePortalOwner(request, slug);
    if ('error' in guard) return guard.error;
    const practitionerId = guard.practitionerId;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // new, replied, archived
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = `
      SELECT
        id,
        name,
        email,
        phone,
        timezone,
        topic,
        message,
        source,
        status,
        created_at
      FROM portal_inquiries
      WHERE practitioner_id = $1
    `;
    const queryParams: (string | number)[] = [practitionerId];

    if (status) {
      query += ` AND status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM portal_inquiries WHERE practitioner_id = $1`;
    const countParams: string[] = [practitionerId];
    if (status) {
      countQuery += ` AND status = $2`;
      countParams.push(status);
    }
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      inquiries: result.rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Portal inquiry list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH endpoint to update inquiry status — only the practitioner who owns the portal
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const guard = await authorizePortalOwner(request, slug);
    if ('error' in guard) return guard.error;

    const body = await request.json();
    const { inquiry_id, status } = body;

    if (!inquiry_id || !status) {
      return NextResponse.json(
        { error: 'inquiry_id and status are required' },
        { status: 400 }
      );
    }

    if (!['new', 'replied', 'archived'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: new, replied, or archived' },
        { status: 400 }
      );
    }

    const result = await db.query(
      `UPDATE portal_inquiries
       SET status = $1
       WHERE id = $2 AND portal_slug = $3
       RETURNING id, status`,
      [status, inquiry_id, slug]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      inquiry: result.rows[0],
    });
  } catch (error) {
    console.error('Portal inquiry update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
