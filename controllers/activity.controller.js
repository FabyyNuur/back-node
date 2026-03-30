import db from "../db.js";

const activityCtrl = {
  list: (req, res) => {
    try {
      const activities = db.prepare(`SELECT * FROM activities`).all();
      return res.status(200).json({ data: activities });
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
    } = req.body;

    if (!name)
      return res
        .status(400)
        .json({ message: "Le nom de l'activité est requis." });

    try {
      const result = db
        .prepare(
          `
                INSERT INTO activities (name, registration_fee, daily_ticket_price, weekly_price, monthly_price, quarterly_price, semester_price, yearly_price, subscription_only, color)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    } = req.body;

    try {
      const result = db
        .prepare(
          `
                UPDATE activities SET 
                    name = ?, registration_fee = ?, daily_ticket_price = ?, weekly_price = ?, monthly_price = ?, quarterly_price = ?, semester_price = ?, yearly_price = ?, subscription_only = ?, color = ?
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
