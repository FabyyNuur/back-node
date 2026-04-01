import db from "../db.js";
import crypto from "crypto";

const getSubscriptionDurationDays = (subscriptionType) => {
  switch (subscriptionType) {
    case "weekly":
      return 7;
    case "quarterly":
      return 90;
    case "semester":
      return 180;
    case "yearly":
      return 365;
    case "monthly":
    default:
      return 30;
  }
};

const normalizeActivityIds = (activity_id) =>
  Array.isArray(activity_id) ? activity_id : [activity_id];

const getInactiveOrMissingActivity = (activityIds = []) => {
  const findActivityStmt = db.prepare(
    `SELECT id, name, is_active FROM activities WHERE id = ?`,
  );
  return activityIds
    .map((actId) => findActivityStmt.get(actId))
    .find((activity) => !activity || Number(activity.is_active) !== 1);
};

const clientCtrl = {
  list: (req, res) => {
    try {
      const clients = db
        .prepare(
          `
          SELECT 
            c.*, 
            sub.activity_details,
            sub.activity_name,
            sub.activity_ids,
            sub.subscription_end_date,
            CASE 
                WHEN sub.active_count > 0 THEN 'ACTIVE' 
                ELSE 'EXPIRED' 
            END AS subscription_status
          FROM clients c
          LEFT JOIN (
            SELECT 
              s.client_id,
              GROUP_CONCAT(a.name || '|' || s.end_date, '; ') AS activity_details,
              GROUP_CONCAT(a.name, ', ') AS activity_name,
              GROUP_CONCAT(a.id) AS activity_ids,
              MAX(s.end_date) AS subscription_end_date,
              COUNT(s.id) AS active_count
            FROM subscriptions s
            JOIN activities a ON s.activity_id = a.id
            WHERE s.status = 'ACTIVE'
            GROUP BY s.client_id
          ) sub ON c.id = sub.client_id
          ORDER BY c.created_at DESC
          `,
        )
        .all();
      return res.status(200).json({ data: clients });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },

  add: (req, res) => {
    const {
      first_name,
      last_name,
      email,
      phone,
      address,
      activity_id,
      amount_paid,
      payment_method,
      include_registration_fee,
      subscription_type,
    } = req.body;

    if (!first_name || !last_name) {
      return res
        .status(400)
        .json({ message: "Le prénom et le nom sont obligatoires." });
    }

    const qr_code = crypto.randomUUID(); // Génère un code unique pour le QR du membre

    // Utiliser une transaction pour créer de façon sécurisée le client, l'abonnement et la transaction financière
    const createClientTx = db.transaction(() => {
      // 1. Insérer le client
      const clientResult = db
        .prepare(
          `
                INSERT INTO clients (first_name, last_name, email, phone, address, qr_code)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
        )
        .run(
          first_name,
          last_name,
          email || null,
          phone || null,
          address || null,
          qr_code,
        );
      const clientId = clientResult.lastInsertRowid;

      // 2. Créer l'abonnement si une ou plusieurs activités sont sélectionnées
      if (activity_id) {
        const activityIds = normalizeActivityIds(activity_id);
        const invalidActivity = getInactiveOrMissingActivity(activityIds);
        if (invalidActivity) {
          throw new Error("Une ou plusieurs activités sont introuvables ou désactivées.");
        }
        const durationDays = getSubscriptionDurationDays(subscription_type);
        const startDate = new Date().toISOString();
        const endDate = new Date(
          Date.now() + durationDays * 24 * 60 * 60 * 1000,
        ).toISOString();

        const insertSub = db.prepare(
          `
                    INSERT INTO subscriptions (client_id, activity_id, start_date, end_date, status, amount_paid, payment_method)
                    VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
                `,
        );

        activityIds.forEach((actId, index) => {
          const proportionalAmount = index === 0 ? amount_paid : 0; 
          insertSub.run(clientId, actId, startDate, endDate, proportionalAmount, payment_method || "CASH");
        });
      }

      // 3. Enregistrer le paiement en caisse si le montant > 0
      if (amount_paid > 0) {
        let description = `Inscription de ${first_name} ${last_name}`;
        if (include_registration_fee) description += " (incluant frais)";

        db.prepare(
          `
                    INSERT INTO transactions (amount, type, description, payment_method, client_id)
                    VALUES (?, 'INCOME', ?, ?, ?)
                `,
        ).run(amount_paid, description, payment_method || "CASH", clientId);
      }

      return clientId;
    });

    try {
      const newClientId = createClientTx();
      return res.status(201).json({
        message: "Client inscrit avec succès",
        id: newClientId,
        qr_code: qr_code,
      });
    } catch (error) {
      if (error.message.includes("désactivées")) {
        return res.status(403).json({ message: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  update: (req, res) => {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      address,
      activity_id,
      amount_paid,
      payment_method,
      subscription_type,
    } = req.body;

    if (!first_name || !last_name) {
      return res
        .status(400)
        .json({ message: "Le prénom et le nom sont obligatoires." });
    }

    try {
      const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
      if (!client)
        return res.status(404).json({ message: "Client introuvable." });

      const updateTx = db.transaction(() => {
        db.prepare(
          `
          UPDATE clients 
          SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ?
          WHERE id = ?
          `,
        ).run(
          first_name,
          last_name,
          email || null,
          phone || null,
          address || null,
          id,
        );

        if (activity_id) {
          const activityIds = normalizeActivityIds(activity_id);
          const invalidActivity = getInactiveOrMissingActivity(activityIds);
          if (invalidActivity) {
            throw new Error("Une ou plusieurs activités sont introuvables ou désactivées.");
          }
          const durationDays = getSubscriptionDurationDays(subscription_type);
          const startDate = new Date().toISOString();
          const endDate = new Date(
            Date.now() + durationDays * 24 * 60 * 60 * 1000,
          ).toISOString();

          db.prepare(
            `UPDATE subscriptions SET status = 'EXPIRED' WHERE client_id = ? AND status = 'ACTIVE'`,
          ).run(id);

          const insertSub = db.prepare(
            `
            INSERT INTO subscriptions (client_id, activity_id, start_date, end_date, status, amount_paid, payment_method)
            VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
            `,
          );
          
          activityIds.forEach((actId, index) => {
            const proportionalAmount = index === 0 ? amount_paid : 0;
            insertSub.run(id, actId, startDate, endDate, proportionalAmount, payment_method || "CASH");
          });

          if (amount_paid > 0) {
            db.prepare(
              `
              INSERT INTO transactions (amount, type, description, payment_method, client_id)
              VALUES (?, 'INCOME', ?, ?, ?)
              `,
            ).run(
              amount_paid,
              `MàJ Abonnement ${first_name} ${last_name}`,
              payment_method || "CASH",
              id,
            );
          }
        }
      });

      updateTx();
      return res.status(200).json({ message: "Client mis à jour avec succès" });
    } catch (error) {
      if (error.message.includes("désactivées")) {
        return res.status(403).json({ message: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  subscribe: (req, res) => {
    const { id } = req.params;
    const { activity_id, amount_paid, payment_method, subscription_type } =
      req.body;

    if (!activity_id) {
      return res
        .status(400)
        .json({ message: "L'activité est requise pour l'abonnement." });
    }

    try {
      const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
      if (!client)
        return res.status(404).json({ message: "Client introuvable." });

      const activity = db
        .prepare(`SELECT * FROM activities WHERE id = ?`)
        .get(activity_id);
      if (!activity)
        return res.status(404).json({ message: "Activité introuvable." });
      if (Number(activity.is_active) !== 1) {
        return res.status(403).json({ message: "Cette activité est désactivée." });
      }

      const renewTx = db.transaction(() => {
        const durationDays = getSubscriptionDurationDays(subscription_type);
        const startDate = new Date().toISOString();
        const endDate = new Date(
          Date.now() + durationDays * 24 * 60 * 60 * 1000,
        ).toISOString();

        // Marquer les anciens abonnements actifs comme expirés
        db.prepare(
          `
                    UPDATE subscriptions SET status = 'EXPIRED' 
                    WHERE client_id = ? AND status = 'ACTIVE'
                `,
        ).run(id);

        // Nouvel abonnement
        db.prepare(
          `
                    INSERT INTO subscriptions (client_id, activity_id, start_date, end_date, status, amount_paid, payment_method)
                    VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
                `,
        ).run(id, activity_id, startDate, endDate, amount_paid, payment_method || "CASH");

        // Enregistrer l'encaissement
        if (amount_paid > 0) {
          db.prepare(
            `
                        INSERT INTO transactions (amount, type, description, payment_method, client_id)
                        VALUES (?, 'INCOME', ?, ?, ?)
                    `,
          ).run(
            amount_paid,
            `Renouvellement abonnement ${client.first_name} ${client.last_name} (${activity.name})`,
            payment_method || "CASH",
            id,
          );
        }
      });

      renewTx();
      return res
        .status(200)
        .json({ message: "Abonnement renouvelé avec succès" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
  
  history: (req, res) => {
    const { id } = req.params;
    try {
      const history = db
        .prepare(
          `
          SELECT s.*, a.name as activity_name 
          FROM subscriptions s
          JOIN activities a ON s.activity_id = a.id
          WHERE s.client_id = ?
          ORDER BY datetime(s.end_date) DESC
        `,
        )
        .all(id);
      return res.status(200).json({ data: history });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
};

export default clientCtrl;
