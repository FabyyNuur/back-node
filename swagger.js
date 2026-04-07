import swaggerJSDoc from "swagger-jsdoc";
import { config } from "./config.js";

const securitySchemes = {
  bearerAuth: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
};

const schemas = {
  LoginRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", example: "admin@nuurgym.com" },
      password: { type: "string", example: "admin123" },
    },
  },
  UserCreateRequest: {
    type: "object",
    required: ["email", "password", "name"],
    properties: {
      email: { type: "string", example: "caissier@nuurgym.com" },
      password: { type: "string", example: "secret123" },
      name: { type: "string", example: "Fatou" },
      role: {
        type: "string",
        enum: ["ADMIN", "CAISSIER", "CONTROLEUR"],
        example: "CAISSIER",
      },
      is_active: { type: "integer", enum: [0, 1], example: 1 },
    },
  },
  UserUpdateRequest: {
    type: "object",
    properties: {
      email: { type: "string", example: "controleur@nuurgym.com" },
      password: { type: "string", example: "newPass123" },
      name: { type: "string", example: "Mamadou" },
      role: {
        type: "string",
        enum: ["ADMIN", "CAISSIER", "CONTROLEUR"],
        example: "CONTROLEUR",
      },
      is_active: { type: "integer", enum: [0, 1], example: 1 },
    },
  },
  ActivityRequest: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", example: "Musculation" },
      registration_fee: { type: "number", example: 5000 },
      daily_ticket_price: { type: "number", example: 1000 },
      weekly_price: { type: "number", nullable: true, example: 5000 },
      monthly_price: { type: "number", nullable: true, example: 15000 },
      quarterly_price: { type: "number", nullable: true, example: 40000 },
      semester_price: { type: "number", nullable: true, example: 70000 },
      yearly_price: { type: "number", nullable: true, example: 120000 },
      subscription_only: { type: "boolean", example: false },
      color: { type: "string", example: "#F36F6F" },
      is_active: { type: "integer", enum: [0, 1], example: 1 },
    },
  },
  ClientRequest: {
    type: "object",
    required: ["first_name", "last_name"],
    properties: {
      first_name: { type: "string", example: "Awa" },
      last_name: { type: "string", example: "Diallo" },
      email: { type: "string", nullable: true, example: "awa@mail.com" },
      phone: { type: "string", nullable: true, example: "+221770000000" },
      address: { type: "string", nullable: true, example: "Dakar" },
      activity_id: {
        oneOf: [
          { type: "integer", example: 1 },
          { type: "array", items: { type: "integer" }, example: [1, 2] },
        ],
      },
      amount_paid: { type: "number", example: 15000 },
      payment_method: { type: "string", example: "CASH" },
      include_registration_fee: { type: "boolean", example: true },
      subscription_type: {
        type: "string",
        enum: ["weekly", "monthly", "quarterly", "semester", "yearly"],
        example: "monthly",
      },
    },
  },
  SubscribeRequest: {
    type: "object",
    required: ["activity_id"],
    properties: {
      activity_id: { type: "integer", example: 1 },
      amount_paid: { type: "number", example: 15000 },
      payment_method: { type: "string", example: "CASH" },
      subscription_type: {
        type: "string",
        enum: ["weekly", "monthly", "quarterly", "semester", "yearly"],
        example: "monthly",
      },
    },
  },
  TicketGenerateRequest: {
    type: "object",
    required: ["activity_id"],
    properties: {
      activity_id: { type: "integer", example: 1 },
      quantity: { type: "integer", minimum: 1, maximum: 100, example: 2 },
      payment_method: { type: "string", example: "CASH" },
      validity_option: {
        type: "string",
        enum: ["end_of_day", "24h", "3d", "7d", "30d"],
        example: "end_of_day",
      },
    },
  },
  TicketScanRequest: {
    type: "object",
    required: ["qr_code"],
    properties: {
      qr_code: {
        type: "string",
        example: "6df4fa87-6f5d-4ec2-a1f8-14cb9a39e23c",
      },
    },
  },
  TransactionCreateRequest: {
    type: "object",
    required: ["amount", "type"],
    properties: {
      amount: { type: "number", example: 5000 },
      type: { type: "string", enum: ["INCOME", "EXPENSE"], example: "EXPENSE" },
      description: {
        type: "string",
        nullable: true,
        example: "Achat matériel",
      },
      payment_method: { type: "string", example: "cash" },
    },
  },
};

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "Nuur GYM API",
    version: "1.0.0",
    description: "Documentation interactive pour tester les routes de l'API.",
  },
  servers: [
    {
      url: `http://localhost:${config.port}${config.apiPrefix}`,
      description: "Serveur local",
    },
  ],
  components: {
    securitySchemes,
    schemas,
  },
  paths: {
    "/users/login": {
      post: {
        tags: ["Auth"],
        summary: "Connexion utilisateur",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          200: { description: "Connexion reussie" },
          401: { description: "Identifiants invalides" },
        },
      },
    },
    "/users": {
      get: {
        tags: ["Users"],
        summary: "Lister les utilisateurs (admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Liste des utilisateurs" },
          401: { description: "Non authentifie" },
          403: { description: "Interdit" },
        },
      },
      post: {
        tags: ["Users"],
        summary: "Ajouter un utilisateur (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UserCreateRequest" },
            },
          },
        },
        responses: {
          201: { description: "Utilisateur cree" },
          400: { description: "Donnees invalides" },
          403: { description: "Interdit" },
        },
      },
    },
    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Recuperer un utilisateur par id (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: { description: "Utilisateur trouve" },
          404: { description: "Utilisateur introuvable" },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Modifier un utilisateur (admin)",
        description:
          "L'identifiant utilise pour la mise a jour est celui du champ de chemin `id`. Si un `id` different est envoye dans le body, il est ignore.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UserUpdateRequest" },
            },
          },
        },
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: { description: "Utilisateur modifie" },
          404: { description: "Utilisateur introuvable" },
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Supprimer un utilisateur (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: { description: "Utilisateur supprime" },
          404: { description: "Utilisateur introuvable" },
        },
      },
    },
    "/activities": {
      get: {
        tags: ["Activities"],
        summary: "Lister les activites",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Liste des activites" } },
      },
      post: {
        tags: ["Activities"],
        summary: "Ajouter une activite (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ActivityRequest" },
            },
          },
        },
        responses: { 201: { description: "Activite creee" } },
      },
    },
    "/activities/{id}": {
      get: {
        tags: ["Activities"],
        summary: "Recuperer une activite par id",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: { description: "Activite trouvee" },
          404: { description: "Activite introuvable" },
        },
      },
      put: {
        tags: ["Activities"],
        summary: "Modifier une activite (admin)",
        description:
          "L'identifiant utilise pour la mise a jour est celui du champ de chemin `id`. Si un `id` different est envoye dans le body, il est ignore.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ActivityRequest" },
            },
          },
        },
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { 200: { description: "Activite modifiee" } },
      },
      delete: {
        tags: ["Activities"],
        summary: "Supprimer une activite (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { 200: { description: "Activite supprimee" } },
      },
    },
    "/activities/{id}/details": {
      get: {
        tags: ["Activities"],
        summary: "Voir le detail d'une activite",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { 200: { description: "Detail activite" } },
      },
    },
    "/activities/{id}/deactivate-impact": {
      get: {
        tags: ["Activities"],
        summary: "Impact de desactivation (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { 200: { description: "Impact calcule" } },
      },
    },
    "/clients": {
      get: {
        tags: ["Clients"],
        summary: "Lister les clients",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Liste des clients" } },
      },
      post: {
        tags: ["Clients"],
        summary: "Ajouter un client",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ClientRequest" },
            },
          },
        },
        responses: { 201: { description: "Client cree" } },
      },
    },
    "/clients/{id}": {
      get: {
        tags: ["Clients"],
        summary: "Recuperer un client par id",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: { description: "Client trouve" },
          404: { description: "Client introuvable" },
        },
      },
      put: {
        tags: ["Clients"],
        summary: "Modifier un client",
        description:
          "L'identifiant utilise pour la mise a jour est celui du champ de chemin `id`. Si un `id` different est envoye dans le body, il est ignore.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ClientRequest" },
            },
          },
        },
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { 200: { description: "Client modifie" } },
      },
    },
    "/clients/{id}/subscribe": {
      post: {
        tags: ["Clients"],
        summary: "Abonner un client",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SubscribeRequest" },
            },
          },
        },
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { 200: { description: "Abonnement enregistre" } },
      },
    },
    "/clients/{id}/history": {
      get: {
        tags: ["Clients"],
        summary: "Historique d'un client",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: { 200: { description: "Historique client" } },
      },
    },
    "/tickets": {
      get: {
        tags: ["Tickets"],
        summary: "Lister les tickets",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Liste tickets" } },
      },
    },
    "/tickets/generate": {
      post: {
        tags: ["Tickets"],
        summary: "Generer un ticket",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TicketGenerateRequest" },
            },
          },
        },
        responses: { 201: { description: "Ticket genere" } },
      },
    },
    "/tickets/scan": {
      post: {
        tags: ["Tickets"],
        summary: "Scanner/valider un ticket",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TicketScanRequest" },
            },
          },
        },
        responses: { 200: { description: "Ticket valide" } },
      },
    },
    "/tickets/logs": {
      get: {
        tags: ["Tickets"],
        summary: "Historique des scans",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Logs des scans" } },
      },
    },
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Statistiques dashboard",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Stats globales" } },
      },
    },
    "/transactions": {
      get: {
        tags: ["Transactions"],
        summary: "Lister les transactions",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Historique des transactions" } },
      },
      post: {
        tags: ["Transactions"],
        summary: "Ajouter une transaction (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TransactionCreateRequest" },
            },
          },
        },
        responses: { 201: { description: "Transaction creee" } },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: [],
};

export const swaggerSpec = swaggerJSDoc(options);
