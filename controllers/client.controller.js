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

const clientCtrl = {
  list: (req, res) => {
    try {
      // Jointure pour récupérer les infos du client et son abonnement actif s'il y en a un
      const clients = db
        .prepare(
          `
                SELECT c.*, s.status as subscription_status, a.name as activity_name 
                FROM clients c
                LEFT JOIN subscriptions s ON c.id = s.client_id AND s.status = 'ACTIVE'
                LEFT JOIN activities a ON s.activity_id = a.id
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

      // 2. Créer l'abonnement si une activité est sélectionnée
      if (activity_id) {
        const durationDays = getSubscriptionDurationDays(subscription_type);
        const startDate = new Date().toISOString();
        const endDate = new Date(
          Date.now() + durationDays * 24 * 60 * 60 * 1000,
        ).toISOString();

        db.prepare(
          `
                    INSERT INTO subscriptions (client_id, activity_id, start_date, end_date, status)
                    VALUES (?, ?, ?, ?, 'ACTIVE')
                `,
        ).run(clientId, activity_id, startDate, endDate);
      }

      // 3. Enregistrer le paiement en caisse si le montant > 0
      if (amount_paid > 0) {
        let description = `Inscription de ${first_name} ${last_name}`;
        if (include_registration_fee) description += " (incluant frais)";

        db.prepare(
          `
                    INSERT INTO transactions (amount, type, description, payment_method)
                    VALUES (?, 'INCOME', ?, ?)
                `,
        ).run(amount_paid, description, payment_method || "CASH");
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
      return res.status(500).json({ error: error.message });
    }
  },

  update: (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, email, phone, address } = req.body;

    if (!first_name || !last_name) {
      return res
        .status(400)
        .json({ message: "Le prénom et le nom sont obligatoires." });
    }

    try {
      const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
      if (!client)
        return res.status(404).json({ message: "Client introuvable." });

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

      return res.status(200).json({ message: "Client mis à jour avec succès" });
    } catch (error) {
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

        // Nouvel abonnement de 30 jours
        db.prepare(
          `
                    INSERT INTO subscriptions (client_id, activity_id, start_date, end_date, status)
                    VALUES (?, ?, ?, ?, 'ACTIVE')
                `,
        ).run(id, activity_id, startDate, endDate);

        // Enregistrer l'encaissement
        if (amount_paid > 0) {
          db.prepare(
            `
                        INSERT INTO transactions (amount, type, description, payment_method)
                        VALUES (?, 'INCOME', ?, ?)
                    `,
          ).run(
            amount_paid,
            `Renouvellement abonnement ${client.first_name} ${client.last_name} (${activity.name})`,
            payment_method || "CASH",
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
};

export default clientCtrl;
