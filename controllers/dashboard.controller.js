import db from "../db.js";

const dashboardCtrl = {
  getStats: (req, res) => {
    try {
      const { period = "day" } = req.query;
      const now = new Date();
      let startOfPeriod, endOfPeriod;

      // Formatter pour SQLite (YYYY-MM-DD HH:MM:SS) - UTC par défaut
      const toSqlFormat = (date) => {
        return date
          .toISOString()
          .replace("T", " ")
          .replace("Z", "")
          .split(".")[0];
      };

      // Détermine la plage de dates selon la période choisie (Calculs en UTC)
      switch (period) {
        case "day":
          startOfPeriod = toSqlFormat(
            new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                0,
                0,
                0,
              ),
            ),
          );
          endOfPeriod = toSqlFormat(
            new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                23,
                59,
                59,
              ),
            ),
          );
          break;
        case "week":
          const day = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1; // Lundi = 0
          const monday = new Date(now);
          monday.setUTCDate(now.getUTCDate() - day);
          monday.setUTCHours(0, 0, 0, 0);
          startOfPeriod = toSqlFormat(monday);
          endOfPeriod = toSqlFormat(
            new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                23,
                59,
                59,
              ),
            ),
          );
          break;
        case "month":
          startOfPeriod = toSqlFormat(
            new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0),
            ),
          );
          const nextMonth = new Date(
            Date.UTC(
              now.getUTCFullYear(),
              now.getUTCMonth() + 1,
              0,
              23,
              59,
              59,
            ),
          );
          endOfPeriod = toSqlFormat(nextMonth);
          break;
        case "year":
          startOfPeriod = toSqlFormat(
            new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0)),
          );
          endOfPeriod = toSqlFormat(
            new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59)),
          );
          break;
        case "all":
          startOfPeriod = "1970-01-01 00:00:00";
          endOfPeriod = "2100-12-31 23:59:59";
          break;
        default:
          startOfPeriod = toSqlFormat(
            new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                0,
                0,
                0,
              ),
            ),
          );
          endOfPeriod = toSqlFormat(
            new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                23,
                59,
                59,
              ),
            ),
          );
      }

      // 1. Revenus de la période (Insensible à la casse)
      const incomeRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME' AND created_at BETWEEN ? AND ?`,
        )
        .get(startOfPeriod, endOfPeriod);
      const periodIncome = incomeRow.sum || 0;

      // 2. Dépenses de la période (Insensible à la casse)
      const expenseRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'EXPENSE' AND created_at BETWEEN ? AND ?`,
        )
        .get(startOfPeriod, endOfPeriod);
      const periodExpense = expenseRow.sum || 0;

      // 3. Tickets vendus dans la période
      const ticketsSoldRow = db
        .prepare(
          `SELECT COUNT(*) as count FROM tickets WHERE created_at BETWEEN ? AND ?`,
        )
        .get(startOfPeriod, endOfPeriod);
      const ticketsSold = ticketsSoldRow.count || 0;

      // 4. Nouveaux Membres (inscriptions dans la période)
      const newMembersRow = db
        .prepare(
          `SELECT COUNT(*) as count FROM clients WHERE created_at BETWEEN ? AND ?`,
        )
        .get(startOfPeriod, endOfPeriod);
      const newMembers = newMembersRow.count || 0;

      // 5. Total Membres Actifs (Globalement)
      const activeMembersRow = db
        .prepare(
          `SELECT COUNT(DISTINCT client_id) as count FROM subscriptions WHERE status = 'ACTIVE' AND datetime(end_date) >= datetime('now')`,
        )
        .get();
      const activeMembers = activeMembersRow?.count || 0;

      // 6. Solde Caisse Global (Calculé sur TOUTES les transactions)
      const totalIncomeRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME'`,
        )
        .get();
      const totalExpenseRow = db
        .prepare(
          `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'EXPENSE'`,
        )
        .get();
      const totalIncome = totalIncomeRow.sum || 0;
      const totalExpense = totalExpenseRow.sum || 0;
      const caisseBalance = totalIncome - totalExpense;

      // 7. Transactions récentes (10 dernières)
      const recentTransactions = db
        .prepare(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10`)
        .all();

      // 8. Historique Scanner QR d'Accès récents
      const recentLogs = db
        .prepare(
          `SELECT * FROM access_logs WHERE scanned_at BETWEEN ? AND ? ORDER BY scanned_at DESC LIMIT 5`,
        )
        .all(startOfPeriod, endOfPeriod);

      // 9. Données du Graphique selon la période
      let chartLabels = [];
      let chartRevenues = [];
      let chartExpenses = [];

      switch (period) {
        case "day":
          // Tranches de 4 heures pour la journée en cours
          for (let h = 0; h <= 20; h += 4) {
            const label = `${h.toString().padStart(2, "0")}:00`;
            chartLabels.push(label);

            const dStart = new Date(now);
            dStart.setUTCHours(h, 0, 0, 0);
            const dEnd = new Date(dStart);
            dEnd.setUTCHours(h + 3, 59, 59, 999);

            const incomeRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME' AND created_at BETWEEN ? AND ?`,
              )
              .get(toSqlFormat(dStart), toSqlFormat(dEnd));
            chartRevenues.push(incomeRow.sum || 0);

            const expenseRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'EXPENSE' AND created_at BETWEEN ? AND ?`,
              )
              .get(toSqlFormat(dStart), toSqlFormat(dEnd));
            chartExpenses.push(expenseRow.sum || 0);
          }
          break;

        case "week":
          // 7 jours de la semaine (Lundi à Dimanche)
          const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
          const currentDayOfWeek =
            now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1;
          const startOfWeek = new Date(now);
          startOfWeek.setUTCDate(now.getUTCDate() - currentDayOfWeek);
          startOfWeek.setUTCHours(0, 0, 0, 0);

          for (let i = 0; i < 7; i++) {
            chartLabels.push(weekDays[i]);

            const dStartW = new Date(startOfWeek);
            dStartW.setUTCDate(startOfWeek.getUTCDate() + i);
            const dEndW = new Date(dStartW);
            dEndW.setUTCHours(23, 59, 59, 999);

            const incomeRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME' AND created_at BETWEEN ? AND ?`,
              )
              .get(toSqlFormat(dStartW), toSqlFormat(dEndW));
            chartRevenues.push(incomeRow.sum || 0);

            const expenseRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'EXPENSE' AND created_at BETWEEN ? AND ?`,
              )
              .get(toSqlFormat(dStartW), toSqlFormat(dEndW));
            chartExpenses.push(expenseRow.sum || 0);
          }
          break;

        case "month":
          // Par tranches de 5 jours pour le mois en cours
          const daysInMonth = new Date(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            0,
          ).getDate();
          for (let d = 1; d <= daysInMonth; d += 5) {
            chartLabels.push(`J${d}`);

            const dStartM = new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), d, 0, 0, 0),
            );
            const dEndM = new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                Math.min(d + 4, daysInMonth),
                23,
                59,
                59,
              ),
            );

            const incomeRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME' AND created_at BETWEEN ? AND ?`,
              )
              .get(toSqlFormat(dStartM), toSqlFormat(dEndM));
            chartRevenues.push(incomeRow.sum || 0);

            const expenseRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'EXPENSE' AND created_at BETWEEN ? AND ?`,
              )
              .get(toSqlFormat(dStartM), toSqlFormat(dEndM));
            chartExpenses.push(expenseRow.sum || 0);
          }
          break;

        case "year":
          // Les 12 mois de l'année en cours
          const monthsNames = [
            "Jan",
            "Fév",
            "Mar",
            "Avr",
            "Mai",
            "Juin",
            "Juil",
            "Aoû",
            "Sep",
            "Oct",
            "Nov",
            "Déc",
          ];
          for (let m = 0; m < 12; m++) {
            chartLabels.push(monthsNames[m]);

            const dStartY = new Date(
              Date.UTC(now.getUTCFullYear(), m, 1, 0, 0, 0),
            );
            const dEndY = new Date(
              Date.UTC(now.getUTCFullYear(), m + 1, 0, 23, 59, 59),
            );

            const incomeRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME' AND created_at BETWEEN ? AND ?`,
              )
              .get(toSqlFormat(dStartY), toSqlFormat(dEndY));
            chartRevenues.push(incomeRow.sum || 0);

            const expenseRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'EXPENSE' AND created_at BETWEEN ? AND ?`,
              )
              .get(toSqlFormat(dStartY), toSqlFormat(dEndY));
            chartExpenses.push(expenseRow.sum || 0);
          }
          break;

        case "all":
          // Par année pour l'historique total (dernières 5 ans)
          for (
            let y = now.getUTCFullYear() - 4;
            y <= now.getUTCFullYear();
            y++
          ) {
            chartLabels.push(y.toString());
            const dStartA = `${y}-01-01 00:00:00`;
            const dEndA = `${y}-12-31 23:59:59`;

            const incomeRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'INCOME' AND created_at BETWEEN ? AND ?`,
              )
              .get(dStartA, dEndA);
            chartRevenues.push(incomeRow.sum || 0);

            const expenseRow = db
              .prepare(
                `SELECT SUM(amount) as sum FROM transactions WHERE UPPER(type) = 'EXPENSE' AND created_at BETWEEN ? AND ?`,
              )
              .get(dStartA, dEndA);
            chartExpenses.push(expenseRow.sum || 0);
          }
          break;
      }

      return res.status(200).json({
        stats: {
          periodIncome,
          periodExpense,
          ticketsSold,
          newMembers,
          activeMembers,
          totalIncome,
          caisseBalance,
          period,
        },
        recentTransactions,
        recentLogs,
        chart: {
          labels: chartLabels,
          revenues: chartRevenues,
          expenses: chartExpenses,
        },
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      return res.status(500).json({ error: error.message });
    }
  },
};

export default dashboardCtrl;
