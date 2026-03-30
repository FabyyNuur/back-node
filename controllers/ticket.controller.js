import db from "../db.js";
import crypto from "crypto";

const computeValidUntil = (validity_option) => {
  const now = new Date();

  switch (validity_option) {
    case "24h":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case "3d":
      return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    case "end_of_day":
    default: {
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      return endOfDay.toISOString();
    }
  }
};

const ticketCtrl = {
  list: (req, res) => {
    try {
      const tickets = db
        .prepare(
          `
                SELECT t.*, a.name as activity_name 
                FROM tickets t
                JOIN activities a ON t.activity_id = a.id
                ORDER BY t.created_at DESC
            `,
        )
        .all();
      return res.status(200).json({ data: tickets });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  generate: (req, res) => {
    const {
      activity_id,
      quantity = 1,
      payment_method,
      validity_option = "end_of_day",
    } = req.body;

    if (!activity_id || quantity < 1 || quantity > 100) {
      return res
        .status(400)
        .json({
          message:
            "Requête invalide. L'activité est requise et la quantité doit être entre 1 et 100.",
        });
    }

    try {
      const activity = db
        .prepare(`SELECT * FROM activities WHERE id = ?`)
        .get(activity_id);
      if (!activity)
        return res.status(404).json({ message: "Activité introuvable." });
      if (activity.subscription_only === 1)
        return res
          .status(403)
          .json({
            message:
              "Cette activité est réservée aux abonnés. Pas de tickets vendus au détail.",
          });

      const price = activity.daily_ticket_price;
      if (price <= 0)
        return res
          .status(400)
          .json({
            message:
              "Le prix du ticket journalier n'est pas configuré pour cette activité.",
          });

      const valid_until = computeValidUntil(validity_option);

      const ticketsToInsert = [];
      const insertTicket = db.prepare(
        `INSERT INTO tickets (activity_id, price, qr_code, valid_until) VALUES (?, ?, ?, ?)`,
      );

      // Transaction pour générer les tickets et l'encaissement global
      db.transaction(() => {
        // Génération des N tickets
        for (let i = 0; i < quantity; i++) {
          const qr_code = crypto.randomUUID();
          insertTicket.run(activity_id, price, qr_code, valid_until);
          ticketsToInsert.push({
            activity_id,
            qr_code,
            price,
            valid_until,
            activity_name: activity.name,
            validity_option,
          });
        }

        // Transaction de caisse
        const totalAmount = price * quantity;
        db.prepare(
          `
                    INSERT INTO transactions (amount, type, description, payment_method) 
                    VALUES (?, 'INCOME', ?, ?)
                `,
        ).run(
          totalAmount,
          `Achat de ${quantity} ticket(s) ${activity.name} - validité ${validity_option}`,
          payment_method || "CASH",
        );
      })();

      return res
        .status(201)
        .json({
          message: `${quantity} ticket(s) généré(s) avec succès.`,
          data: ticketsToInsert,
        });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  validateQr: (req, res) => {
    const { qr_code } = req.body;
    if (!qr_code)
      return res
        .status(400)
        .json({ message: "Le QR Code est requis pour validation." });

    try {
      // 1. Vérifier si c'est un ticket ponctuel
      const ticket = db
        .prepare(`SELECT * FROM tickets WHERE qr_code = ?`)
        .get(qr_code);
      if (ticket) {
        if (ticket.status === "USED") {
          db.prepare(
            `INSERT INTO access_logs (qr_code_scanned, is_valid, details) VALUES (?, ?, ?)`,
          ).run(qr_code, 0, "Ticket déjà utilisé");
          return res
            .status(403)
            .json({ message: "Ticket refusé : déjà consommé." });
        }
        if (new Date(ticket.valid_until) < new Date()) {
          db.prepare(
            `UPDATE tickets SET status = 'EXPIRED' WHERE id = ? AND status != 'USED'`,
          ).run(ticket.id);
          db.prepare(
            `INSERT INTO access_logs (qr_code_scanned, is_valid, details) VALUES (?, ?, ?)`,
          ).run(qr_code, 0, "Ticket expiré");
          return res
            .status(403)
            .json({ message: "Ticket refusé : Date expirée." });
        }

        // Valider le ticket
        db.transaction(() => {
          db.prepare(`UPDATE tickets SET status = 'USED' WHERE id = ?`).run(
            ticket.id,
          );
          db.prepare(
            `INSERT INTO access_logs (qr_code_scanned, is_valid, details) VALUES (?, ?, ?)`,
          ).run(qr_code, 1, "Accès validé (Ticket journalier)");
        })();
        return res
          .status(200)
          .json({ message: "Accès Autorisé (Ticket valide)." });
      }

      // 2. Vérifier si c'est un QR Code d'abonné (Membre)
      const client = db
        .prepare(`SELECT * FROM clients WHERE qr_code = ?`)
        .get(qr_code);
      if (client) {
        const sub = db
          .prepare(
            `SELECT * FROM subscriptions WHERE client_id = ? AND status = 'ACTIVE' AND end_date > ?`,
          )
          .get(client.id, new Date().toISOString());
        if (!sub) {
          db.prepare(
            `INSERT INTO access_logs (qr_code_scanned, is_valid, details) VALUES (?, ?, ?)`,
          ).run(
            qr_code,
            0,
            `Abonnement expiré ou inactif pour ${client.first_name}`,
          );
          return res
            .status(403)
            .json({
              message: `Accès refusé pour le membre ${client.first_name}: Aucun abonnement actif en cours.`,
            });
        }

        db.prepare(
          `INSERT INTO access_logs (qr_code_scanned, is_valid, details) VALUES (?, ?, ?)`,
        ).run(
          qr_code,
          1,
          `Accès Abonné: ${client.first_name} ${client.last_name}`,
        );
        return res
          .status(200)
          .json({
            message: `Accès Autorisé : Bonjour ${client.first_name} ${client.last_name}.`,
          });
      }

      // 3. QR Code Inconnu 
      db.prepare(
        `INSERT INTO access_logs (qr_code_scanned, is_valid, details) VALUES (?, ?, ?)`,
      ).run(qr_code, 0, "QR Code Inconnu");
      return res
        .status(404)
        .json({
          message: "QR Code Invalide ou Inconnu dans la base Nuur GYM.",
        });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  getLogs: (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const filter = req.query.filter || 'all';
      const offset = (page - 1) * limit;

      let where = '';
      if (filter === 'valid') where = 'WHERE is_valid = 1';
      else if (filter === 'refused') where = 'WHERE is_valid = 0';

      const total = db
        .prepare(`SELECT COUNT(*) as count FROM access_logs ${where}`)
        .get().count;

      const logs = db
        .prepare(`SELECT * FROM access_logs ${where} ORDER BY scanned_at DESC LIMIT ? OFFSET ?`)
        .all(limit, offset);

      return res.status(200).json({
        data: logs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
};

export default ticketCtrl;
