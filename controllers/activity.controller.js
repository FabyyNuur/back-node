import db from "../db.js";

const DEACTIVATE_IMPACT_DISCLAIMER =
  "Estimation indicative au prorata du temps restant sur la période enregistrée (montant payé sur cette ligne d'abonnement). " +
  "Pour les offres pack ou multi-activités, le montant peut être sur une seule ligne : vérifiez la comptabilité et vos conditions contractuelles avant tout remboursement. " +
  "Aucun engagement légal de ce montant.";

function estimateRefundProrata(startDateStr, endDateStr, amountPaid) {
  const paid = Number(amountPaid) || 0;
  const start = new Date(startDateStr).getTime();
  const end = new Date(endDateStr).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { estimatedRefund: 0, note: "période_invalide" };
  }
  const periodMs = Math.max(1, end - start);
  const remainingMs = Math.max(0, Math.min(end - now, periodMs));
  const estimatedRefund = Math.round(paid * (remainingMs / periodMs));
  const note = paid === 0 ? "montant_ligne_zero" : null;
  return { estimatedRefund, note };
}

const activityCtrl = {
  list: (req, res) => {
    try {
      const normalizedRole = req.user?.role
        ? String(req.user.role).toUpperCase()
        : null;
      const isAdmin = normalizedRole === "ADMIN";
      const activities = isAdmin
        ? db.prepare(`SELECT * FROM activities`).all()
        : db.prepare(`SELECT * FROM activities WHERE is_active = 1`).all();
      return res.status(200).json({ data: activities });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  getById: (req, res) => {
    const { id } = req.params;

    try {
      const activity = db
        .prepare(`SELECT * FROM activities WHERE id = ?`)
        .get(id);
      if (!activity) {
        return res.status(404).json({ message: "Activité non trouvée" });
      }

      if (Number(activity.is_active) !== 1 && req.user?.role !== "ADMIN") {
        return res.status(404).json({ message: "Activité non trouvée" });
      }

      return res.status(200).json({ data: activity });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  details: (req, res) => {
    const { id } = req.params;

    try {
      const activity = db
        .prepare(
          `
          SELECT * FROM activities WHERE id = ?
        `,
        )
        .get(id);

      if (!activity) {
        return res.status(404).json({ message: "Activité non trouvée" });
      }
      if (Number(activity.is_active) !== 1 && req.user?.role !== "ADMIN") {
        return res.status(404).json({ message: "Activité non trouvée" });
      }

      const subscriptions = db
        .prepare(
          `
          SELECT
            s.id AS subscription_id,
            s.start_date,
            MAX(s.end_date) AS end_date,
            s.status,
            c.id AS client_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.qr_code,
            (
              SELECT MAX(al.scanned_at)
              FROM access_logs al
              WHERE al.qr_code_scanned = c.qr_code
                AND al.is_valid = 1
            ) AS last_access_at
          FROM subscriptions s
          JOIN clients c ON c.id = s.client_id
          WHERE s.activity_id = ?
          GROUP BY c.id
          ORDER BY datetime(end_date) DESC
        `,
        )
        .all(id);

      const tickets = db
        .prepare(
          `
          SELECT
            t.id AS ticket_id,
            t.qr_code,
            t.price,
            t.created_at,
            t.valid_until,
            t.status,
            (
              SELECT MAX(al.scanned_at)
              FROM access_logs al
              WHERE al.qr_code_scanned = t.qr_code
                AND al.is_valid = 1
            ) AS last_access_at
          FROM tickets t
          WHERE t.activity_id = ?
          ORDER BY datetime(t.created_at) DESC
        `,
        )
        .all(id);

      return res.status(200).json({
        data: {
          activity,
          subscriptions,
          tickets,
          metrics: {
            subscribers_count: subscriptions.length,
            active_subscribers_count: subscriptions.filter(
              (item) =>
                item.status === "ACTIVE" &&
                new Date(item.end_date) > new Date(),
            ).length,
            tickets_count: tickets.length,
          },
        },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  deactivateImpact: (req, res) => {
    const { id } = req.params;
    try {
      const activity = db
        .prepare(`SELECT id, name, is_active FROM activities WHERE id = ?`)
        .get(id);
      if (!activity) {
        return res.status(404).json({ message: "Activité non trouvée" });
      }

      const rows = db
        .prepare(
          `
          SELECT
            s.id AS subscription_id,
            s.client_id,
            s.start_date,
            s.end_date,
            COALESCE(s.amount_paid, 0) AS amount_paid,
            c.first_name,
            c.last_name
          FROM subscriptions s
          JOIN clients c ON c.id = s.client_id
          WHERE s.activity_id = ?
            AND s.status = 'ACTIVE'
            AND datetime(s.end_date) > datetime('now')
          ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE
        `,
        )
        .all(id);

      const affected_subscriptions = rows.map((row) => {
        const { estimatedRefund, note } = estimateRefundProrata(
          row.start_date,
          row.end_date,
          row.amount_paid,
        );
        return {
          subscription_id: row.subscription_id,
          client_id: row.client_id,
          first_name: row.first_name,
          last_name: row.last_name,
          start_date: row.start_date,
          end_date: row.end_date,
          amount_paid: Number(row.amount_paid) || 0,
          estimated_refund_fcfa: estimatedRefund,
          note,
        };
      });

      const total_estimated_refund_fcfa = affected_subscriptions.reduce(
        (sum, item) => sum + item.estimated_refund_fcfa,
        0,
      );

      return res.status(200).json({
        data: {
          activity_id: activity.id,
          activity_name: activity.name,
          affected_subscriptions,
          total_estimated_refund_fcfa,
          affected_count: affected_subscriptions.length,
          disclaimer: DEACTIVATE_IMPACT_DISCLAIMER,
        },
      });
    } catch (error) {
      const msg = error?.message || "Erreur serveur";
      return res.status(500).json({ message: msg, error: msg });
    }
  },

  add: (req, res) => {
    const {
      name,
      registration_fee,
      daily_ticket_price,
      weekly_price,
      monthly_price,
      quarterly_price,
      semester_price,
      yearly_price,
      subscription_only,
      color,
      is_active,
    } = req.body;

    if (!name)
      return res
        .status(400)
        .json({ message: "Le nom de l'activité est requis." });

    try {
      const result = db
        .prepare(
          `
                INSERT INTO activities (name, registration_fee, daily_ticket_price, weekly_price, monthly_price, quarterly_price, semester_price, yearly_price, subscription_only, color, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        )
        .run(
          name,
          registration_fee || 0,
          daily_ticket_price || 0,
          weekly_price || null,
          monthly_price || null,
          quarterly_price || null,
          semester_price || null,
          yearly_price || null,
          subscription_only ? 1 : 0,
          color || "#F36F6F",
          is_active === false || Number(is_active) === 0 ? 0 : 1,
        );

      return res
        .status(201)
        .json({ message: "Activité créée", id: result.lastInsertRowid });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  update: (req, res) => {
    const { id } = req.params;
    const {
      name,
      registration_fee,
      daily_ticket_price,
      weekly_price,
      monthly_price,
      quarterly_price,
      semester_price,
      yearly_price,
      subscription_only,
      color,
      is_active,
    } = req.body;

    try {
      const result = db
        .prepare(
          `
                UPDATE activities SET 
                    name = ?, registration_fee = ?, daily_ticket_price = ?, weekly_price = ?, monthly_price = ?, quarterly_price = ?, semester_price = ?, yearly_price = ?, subscription_only = ?, color = ?, is_active = ?
                WHERE id = ?
            `,
        )
        .run(
          name,
          registration_fee || 0,
          daily_ticket_price || 0,
          weekly_price || null,
          monthly_price || null,
          quarterly_price || null,
          semester_price || null,
          yearly_price || null,
          subscription_only ? 1 : 0,
          color || "#F36F6F",
          is_active === false || Number(is_active) === 0 ? 0 : 1,
          id,
        );

      if (result.changes === 0)
        return res.status(404).json({ message: "Activité non trouvée" });

      return res.status(200).json({ message: "Activité mise à jour" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  remove: (req, res) => {
    const { id } = req.params;
    try {
      const result = db.prepare(`DELETE FROM activities WHERE id = ?`).run(id);
      if (result.changes === 0)
        return res.status(404).json({ message: "Activité non trouvée" });

      return res.status(200).json({ message: "Activité supprimée" });
    } catch (error) {
      return res.status(500).json({
        error:
          "Impossible de supprimer, cette activité est sûrement liée à des abonnements.",
      });
    }
  },
};

export default activityCtrl;
